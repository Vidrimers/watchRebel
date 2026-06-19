import { getDatabase } from '../db.js';

/**
 * Миграция: Добавление таблицы настроек уведомлений
 * Создает таблицу notification_settings для управления предпочтениями пользователей
 */
export async function addNotificationSettings() {
  const db = getDatabase();
  
  console.log('Запуск миграции: добавление таблицы notification_settings...');
  
  return new Promise((resolve) => {
    const migration = `
      -- Таблица настроек уведомлений
      CREATE TABLE IF NOT EXISTS notification_settings (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        friend_added_to_list BOOLEAN DEFAULT 1,
        friend_rated_media BOOLEAN DEFAULT 1,
        friend_posted_review BOOLEAN DEFAULT 1,
        friend_reacted_to_post BOOLEAN DEFAULT 1,
        new_message BOOLEAN DEFAULT 1,
        new_friend_request BOOLEAN DEFAULT 1,
        admin_announcement BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Индекс для быстрого поиска настроек по user_id
      CREATE INDEX IF NOT EXISTS idx_notification_settings_user ON notification_settings(user_id);
    `;

    db.exec(migration, (err) => {
      if (err) {
        console.error('Ошибка при создании таблицы notification_settings:', err.message);
        resolve({ success: false, error: err.message });
      } else {
        console.log('✓ Таблица notification_settings успешно создана');
        resolve({ success: true });
      }
    });
  });
}

export default { addNotificationSettings };
