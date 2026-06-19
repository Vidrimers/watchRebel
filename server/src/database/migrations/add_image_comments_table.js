import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Миграция: Создание таблицы image_comments для комментариев к изображениям
 * Дата: 2026-03-03
 * Задача: 101.1 - Комментарии к изображениям в галерее
 */

const dbPath = path.join(__dirname, '../../../rebel.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('🔄 Создание таблицы image_comments...');

  db.run(`
    CREATE TABLE IF NOT EXISTS image_comments (
      id TEXT PRIMARY KEY,
      image_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      parent_comment_id TEXT,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      edited_at DATETIME,
      FOREIGN KEY (image_id) REFERENCES post_images(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_comment_id) REFERENCES image_comments(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('❌ Ошибка создания таблицы image_comments:', err.message);
    } else {
      console.log('✅ Таблица image_comments успешно создана');
    }
    db.close();
  });
});
