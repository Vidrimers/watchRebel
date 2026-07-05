import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../../rebel.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('🔄 Создание таблицы ad_requests...');

  db.run(`
    CREATE TABLE IF NOT EXISTS ad_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      telegram TEXT NOT NULL,
      extra_contact TEXT,
      channel_site INTEGER DEFAULT 0,
      channel_tg INTEGER DEFAULT 0,
      site_pin_qty INTEGER DEFAULT 0,
      site_repeat_qty INTEGER DEFAULT 0,
      site_interval INTEGER DEFAULT 0,
      tg_mailing_qty INTEGER DEFAULT 0,
      tg_repeat_qty INTEGER DEFAULT 0,
      tg_interval INTEGER DEFAULT 0,
      auto_delete_off INTEGER DEFAULT 0,
      total_cost INTEGER DEFAULT 0,
      currency TEXT DEFAULT 'RUB',
      ad_description TEXT,
      ad_link TEXT,
      ad_text TEXT,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `, (err) => {
    if (err) {
      console.error('❌ Ошибка создания таблицы ad_requests:', err.message);
    } else {
      console.log('✓ Таблица ad_requests создана');
    }
  });

  db.close();
});
