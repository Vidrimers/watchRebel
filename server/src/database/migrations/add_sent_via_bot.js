import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Миграция: Добавление поля sent_via_bot в таблицу messages
 * Дата: 2024
 */

const dbPath = path.join(__dirname, '../../../rebel.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('🔄 Добавление поля sent_via_bot в таблицу messages...');

  db.run(`
    ALTER TABLE messages 
    ADD COLUMN sent_via_bot BOOLEAN DEFAULT 0
  `, (err) => {
    if (err) {
      console.error('❌ Ошибка миграции:', err.message);
    } else {
      console.log('✅ Поле sent_via_bot успешно добавлено');
    }
    db.close();
  });
});
