import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Миграция: Добавление поля image_url в таблицу post_comments
 * Дата: 2026-03-03
 * Задача: Поддержка изображений в комментариях к постам
 */

const dbPath = path.join(__dirname, '../../../rebel.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('🔄 Добавление поля image_url в таблицу post_comments...');

  // Проверяем существует ли уже колонка
  db.all("PRAGMA table_info(post_comments)", (err, columns) => {
    if (err) {
      console.error('❌ Ошибка проверки структуры таблицы:', err.message);
      db.close();
      return;
    }

    const hasImageUrl = columns.some(col => col.name === 'image_url');

    if (hasImageUrl) {
      console.log('ℹ️  Поле image_url уже существует');
      db.close();
      return;
    }

    // Добавляем колонку
    db.run(`
      ALTER TABLE post_comments 
      ADD COLUMN image_url TEXT
    `, (err) => {
      if (err) {
        console.error('❌ Ошибка добавления поля image_url:', err.message);
      } else {
        console.log('✅ Поле image_url успешно добавлено в таблицу post_comments');
      }
      db.close();
    });
  });
});
