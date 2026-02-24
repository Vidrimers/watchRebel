import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Путь к базе данных
const dbPath = join(__dirname, '..', 'rebel.db');

console.log('🔄 Миграция: Добавление поля user_status');
console.log(`📁 База данных: ${dbPath}`);

const db = new sqlite3.Database(dbPath);

// Проверяем наличие колонки
db.all("PRAGMA table_info(users)", [], async (err, columns) => {
  if (err) {
    console.error('❌ Ошибка получения информации о таблице:', err.message);
    db.close();
    return;
  }

  const columnNames = columns.map(col => col.name);
  console.log('📋 Существующие колонки:', columnNames);

  const hasUserStatus = columnNames.includes('user_status');

  if (hasUserStatus) {
    console.log('✅ Поле user_status уже существует, миграция не требуется');
    db.close();
    return;
  }

  // Выполняем миграцию
  console.log('\n🔧 Добавление поля user_status...');

  db.run('ALTER TABLE users ADD COLUMN user_status TEXT', (err) => {
    if (err) {
      console.error('❌ Ошибка выполнения миграции:', err.message);
      db.close();
      return;
    }

    console.log('✓ Поле user_status успешно добавлено');
    console.log('\n✅ Миграция успешно завершена!');
    db.close();
  });
});
