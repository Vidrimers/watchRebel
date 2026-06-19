import { getDatabase } from '../db.js';

/**
 * Миграция для добавления текстового статуса пользователя
 * Добавляет поле: user_status (TEXT, nullable, максимум 100 символов)
 */
export async function addUserStatusMigration() {
  const db = getDatabase();
  
  console.log('Запуск миграции: добавление поля user_status...');
  
  return new Promise((resolve) => {
    const migration = `
      -- Добавляем поле user_status в таблицу users
      ALTER TABLE users ADD COLUMN user_status TEXT;
    `;

    db.exec(migration, (err) => {
      if (err) {
        // Проверяем, не является ли ошибка "duplicate column name" (поле уже существует)
        if (err.message.includes('duplicate column name')) {
          console.log('⚠ Поле user_status уже существует, пропускаем миграцию');
          resolve({ success: true });
        } else {
          console.error('Ошибка при выполнении миграции:', err.message);
          resolve({ success: false, error: err.message });
        }
      } else {
        console.log('✓ Миграция успешно выполнена: добавлено поле user_status');
        resolve({ success: true });
      }
    });
  });
}

export default { addUserStatusMigration };
