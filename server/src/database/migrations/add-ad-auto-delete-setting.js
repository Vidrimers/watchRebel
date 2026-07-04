import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../../rebel.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('🔄 Добавление настройки ad_auto_delete...');

  db.run(`
    INSERT OR IGNORE INTO site_settings (id, key, value, updated_at)
    VALUES ('ad_auto_delete', 'ad_auto_delete', '0', datetime('now'))
  `, (err) => {
    if (err) {
      console.error('❌ Ошибка миграции:', err.message);
    } else {
      console.log('✅ Настройка ad_auto_delete добавлена (выключена по умолчанию)');
    }
    db.close();
  });
});
