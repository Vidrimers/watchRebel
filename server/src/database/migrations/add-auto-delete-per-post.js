import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../../rebel.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('🔄 Добавление auto_delete в посты...');

  db.run(`ALTER TABLE advertising_posts ADD COLUMN auto_delete INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('❌ advertising_posts:', err.message);
    else console.log('✅ advertising_posts.auto_delete');
  });

  db.run(`ALTER TABLE announcements ADD COLUMN auto_delete INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('❌ announcements:', err.message);
    else console.log('✅ announcements.auto_delete');
  });

  setTimeout(() => db.close(), 1000);
});
