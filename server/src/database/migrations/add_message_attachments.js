import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Миграция: Добавление поля attachments в таблицу messages
 * Дата: 2024
 */

const dbPath = path.join(__dirname, '../../../rebel.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('🔄 Добавление поля attachments в таблицу messages...');

  db.run(`
    ALTER TABLE messages 
    ADD COLUMN attachments TEXT DEFAULT NULL
  `, (err) => {
    if (err) {
      console.error('❌ Ошибка миграции:', err.message);
    } else {
      console.log('✅ Поле attachments успешно добавлено');
    }
    db.close();
  });
});
