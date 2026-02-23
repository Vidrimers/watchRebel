import { runMigrations } from './migrations.js';
import { closeDatabase } from './db.js';
import { createLoginAttemptsTable } from '../middleware/loginAttempts.js';

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
    
    // Создаем таблицу для отслеживания попыток входа
    console.log('Создание таблицы login_attempts...');
    await createLoginAttemptsTable();
    console.log('Таблица login_attempts создана!');
  } else {
    console.error('Ошибка инициализации базы данных:', result.error);
    process.exit(1);
  }
  
  await closeDatabase();
}

// Запускаем инициализацию
initDatabase();
