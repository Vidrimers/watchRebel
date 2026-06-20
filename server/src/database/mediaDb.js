import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MEDIA_DB_PATH = process.env.NODE_ENV === 'test'
  ? path.join(__dirname, '../../test-media.db')
  : path.join(__dirname, '../../media.db');

let mediaDb = null;

export function getMediaDatabase() {
  if (!mediaDb) {
    mediaDb = new sqlite3.Database(MEDIA_DB_PATH, (err) => {
      if (err) {
        console.error('Ошибка подключения к media.db:', err.message);
      } else {
        console.log('Подключение к media.db установлено');
        initMediaCacheTable();
      }
    });
  }
  return mediaDb;
}

function initMediaCacheTable() {
  const db = mediaDb;
  db.exec(`
    CREATE TABLE IF NOT EXISTS media_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tmdb_id INTEGER NOT NULL,
      media_type TEXT NOT NULL CHECK(media_type IN ('movie', 'tv')),
      title TEXT,
      original_title TEXT,
      poster_path TEXT,
      backdrop_path TEXT,
      vote_average REAL DEFAULT 0,
      vote_count INTEGER DEFAULT 0,
      overview TEXT,
      genres TEXT,
      runtime INTEGER,
      release_date TEXT,
      number_of_seasons INTEGER,
      number_of_episodes INTEGER,
      status TEXT,
      credits TEXT,
      videos TEXT,
      images TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tmdb_id, media_type)
    );
    CREATE INDEX IF NOT EXISTS idx_media_cache_tmdb ON media_cache(tmdb_id, media_type);
  `, (err) => {
    if (err) {
      if (err.message?.includes('no such column: credits')) {
        console.log('Обновление media_cache таблицы...');
        db.exec(`ALTER TABLE media_cache ADD COLUMN credits TEXT`, () => {
          db.exec(`ALTER TABLE media_cache ADD COLUMN videos TEXT`, () => {
            db.exec(`ALTER TABLE media_cache ADD COLUMN images TEXT`, () => {
              console.log('media_cache обновлена: добавлены credits, videos, images');
            });
          });
        });
      } else {
        console.error('Ошибка создания media_cache таблицы:', err.message);
      }
    } else {
      console.log('Таблица media_cache готова');
    }
  });

  // Таблица кэша персон (актёры, режиссёры)
  db.exec(`
    CREATE TABLE IF NOT EXISTS person_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tmdb_id INTEGER NOT NULL UNIQUE,
      name TEXT,
      also_known_as TEXT,
      biography TEXT,
      birthday TEXT,
      deathday TEXT,
      place_of_birth TEXT,
      profile_path TEXT,
      popularity REAL DEFAULT 0,
      known_for TEXT,
      images TEXT,
      combined_credits TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_person_cache_tmdb ON person_cache(tmdb_id);
  `, (err) => {
    if (err) {
      console.error('Ошибка создания person_cache таблицы:', err.message);
    } else {
      console.log('Таблица person_cache готова');
    }
  });
}

export function executeMediaQuery(query, params = []) {
  return new Promise((resolve) => {
    try {
      const db = getMediaDatabase();
      const queryType = query.trim().toUpperCase().split(' ')[0];

      if (queryType === 'SELECT') {
        db.all(query, params, (err, rows) => {
          if (err) {
            console.error('Media DB query error:', err.message);
            resolve({ success: false, error: err.message });
          } else {
            resolve({ success: true, data: rows });
          }
        });
      } else {
        db.run(query, params, function(err) {
          if (err) {
            console.error('Media DB query error:', err.message);
            resolve({ success: false, error: err.message });
          } else {
            resolve({ success: true, changes: this.changes, lastInsertRowid: this.lastID });
          }
        });
      }
    } catch (error) {
      console.error('Media DB error:', error.message);
      resolve({ success: false, error: error.message });
    }
  });
}

export function closeMediaDatabase() {
  return new Promise((resolve) => {
    if (mediaDb) {
      mediaDb.close((err) => {
        if (err) console.error('Ошибка закрытия media.db:', err.message);
        mediaDb = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

export default { getMediaDatabase, executeMediaQuery, closeMediaDatabase };
