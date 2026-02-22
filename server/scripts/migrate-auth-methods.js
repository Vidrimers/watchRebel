import { addAuthMethodsMigration } from '../src/database/migrations/add_auth_methods.js';
import { closeDatabase } from '../src/database/db.js';

/**
 * Скрипт для запуска миграции добавления полей авторизации
 */
async function runMigration() {
  console.log('Запуск миграции для добавления полей авторизации...');
  
  const result = await addAuthMethodsMigration();
  
  if (result.success) {
    console.log('✅ Миграция успешно выполнена!');
  } else {
    console.error('❌ Ошибка выполнения миграции:', result.error);
    process.exit(1);
  }
  
  await closeDatabase();
  process.exit(0);
}

runMigration();
