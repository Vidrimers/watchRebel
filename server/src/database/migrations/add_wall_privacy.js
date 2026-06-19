import { getDatabase } from '../db.js';

/**
 * Миграция для добавления настройки приватности стены
 * Добавляет поле: wall_privacy (TEXT, default 'all')
 * Значения: 'all' (все), 'friends' (только друзья), 'none' (никто)
 */
export async function addWallPrivacyMigration() {
  const db = getDatabase();
  
  console.log('Запуск миграции: добавление поля wall_privacy...');
  
  return new Promise((resolve) => {
    const migration = `
      -- Добавляем поле wall_privacy в таблицу users
      ALTER TABLE users ADD COLUMN wall_privacy TEXT DEFAULT 'all';
    `;

    db.exec(migration, (err) => {
      if (err) {
        // Проверяем, не является ли ошибка "duplicate column name" (поле уже существует)
        if (err.message.includes('duplicate column name')) {
          console.log('⚠ Поле wall_privacy уже существует, пропускаем миграцию');
          resolve({ success: true });
        } else {
          console.error('Ошибка при выполнении миграции:', err.message);
          resolve({ success: false, error: err.message });
        }
      } else {
        console.log('✓ Миграция успешно выполнена: добавлено поле wall_privacy');
        resolve({ success: true });
      }
    });
  });
}

export default { addWallPrivacyMigration };
