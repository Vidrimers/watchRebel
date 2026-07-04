import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../../rebel.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('🔄 Добавление настроек pricing_info...');

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO site_settings (id, key, value, updated_at)
    VALUES (?, ?, ?, datetime('now'))
  `);

  stmt.run('pricing_info_title', 'pricing_info_title', 'Информация о рекламе');
  stmt.run('pricing_info_content', 'pricing_info_content', '');
  stmt.finalize();

  console.log('✅ Настройки pricing_info_title и pricing_info_content добавлены');
  db.close();
});
