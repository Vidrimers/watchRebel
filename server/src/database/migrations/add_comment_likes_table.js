import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Миграция: Создание таблицы comment_likes для лайков комментариев
 * Дата: 2026-03-03
 * Задача: 102.16.1 - Лайки к комментариям
 */

const dbPath = path.join(__dirname, '../../../rebel.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('🔄 Создание таблицы comment_likes...');

  db.run(`
    CREATE TABLE IF NOT EXISTS comment_likes (
      id TEXT PRIMARY KEY,
      comment_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (comment_id) REFERENCES post_comments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(comment_id, user_id)
    )
  `, (err) => {
    if (err) {
      console.error('❌ Ошибка создания таблицы comment_likes:', err.message);
    } else {
      console.log('✅ Таблица comment_likes успешно создана');
    }
    db.close();
  });
});
