import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Миграция: Создание таблицы post_images для хранения изображений в постах
 * Дата: 2026-03-03
 */

const dbPath = path.join(__dirname, '../../../rebel.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('🔄 Создание таблицы post_images...');

  db.run(`
    CREATE TABLE IF NOT EXISTS post_images (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      image_url TEXT NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES wall_posts(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('❌ Ошибка создания таблицы post_images:', err.message);
    } else {
      console.log('✅ Таблица post_images успешно создана');
    }
    db.close();
  });
});
