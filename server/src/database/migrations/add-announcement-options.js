import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../../rebel.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('🔄 Добавление опций в таблицу announcements...');

  const columns = [
    'ALTER TABLE announcements ADD COLUMN pin_duration INTEGER DEFAULT 0',
    'ALTER TABLE announcements ADD COLUMN repeat_count INTEGER DEFAULT 0',
    'ALTER TABLE announcements ADD COLUMN repeat_interval_hours INTEGER DEFAULT 0',
    'ALTER TABLE announcements ADD COLUMN repeat_channel TEXT DEFAULT NULL'
  ];

  let completed = 0;
  for (const sql of columns) {
    db.run(sql, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('❌ Ошибка:', err.message);
      }
      completed++;
      if (completed === columns.length) {
        console.log('✅ Колонки pin_duration, repeat_count, repeat_interval_hours, repeat_channel добавлены в announcements');
        db.close();
      }
    });
  }
});
