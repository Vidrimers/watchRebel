import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Миграция: Создание таблицы post_comments для комментариев к постам
 * Дата: 2026-03-03
 * Задача: 102.1 - Комментарии к постам с пагинацией
 */

const dbPath = path.join(__dirname, '../../../rebel.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('🔄 Создание таблицы post_comments...');

  db.run(`
    CREATE TABLE IF NOT EXISTS post_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      parent_comment_id TEXT,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      edited_at DATETIME,
      FOREIGN KEY (post_id) REFERENCES wall_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_comment_id) REFERENCES post_comments(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('❌ Ошибка создания таблицы post_comments:', err.message);
    } else {
      console.log('✅ Таблица post_comments успешно создана');
    }
    db.close();
  });
});
