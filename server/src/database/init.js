import { runMigrations } from './migrations.js';
import { closeDatabase } from './db.js';

/**
 * Инициализация базы данных
 * Запускает миграции и создает rebel.db
 */
async function initDatabase() {
  console.log('Инициализация базы данных...');
  
  const result = await runMigrations();
  
  if (result.success) {
    console.log('База данных успешно инициализирована!');
    console.log('Файл rebel.db создан в директории server/');
  } else {
    console.error('Ошибка инициализации базы данных:', result.error);
    process.exit(1);
  }
  
  await closeDatabase();
}

// Запускаем инициализацию
initDatabase();
