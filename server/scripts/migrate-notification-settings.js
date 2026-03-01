import { addNotificationSettingsMigration } from '../src/database/migrations/add_notification_settings.js';
import { closeDatabase } from '../src/database/db.js';

/**
 * Скрипт для запуска миграции настроек уведомлений
 * Создает таблицу notification_settings
 */
async function runMigration() {
  console.log('Запуск миграции для добавления таблицы настроек уведомлений...');
  
  const result = await addNotificationSettingsMigration();
  
  if (result.success) {
    console.log('✓ Миграция успешно завершена!');
  } else {
    console.error('✗ Ошибка при выполнении миграции:', result.error);
    process.exit(1);
  }
  
  await closeDatabase();
  process.exit(0);
}

runMigration();
