import { getDatabase } from '../db.js';

/**
 * Миграция: добавление колонок email-уведомлений в notification_settings
 */
export async function addEmailNotificationSettingsMigration() {
  const db = getDatabase();
  
  console.log('Запуск миграции: добавление email-уведомлений в notification_settings...');

  const columns = [
    'email_friend_added_to_list BOOLEAN DEFAULT 1',
    'email_friend_rated_media BOOLEAN DEFAULT 1',
    'email_friend_posted_review BOOLEAN DEFAULT 1',
    'email_friend_reacted_to_post BOOLEAN DEFAULT 1',
    'email_new_message BOOLEAN DEFAULT 1',
    'email_new_friend_request BOOLEAN DEFAULT 1',
    'email_admin_announcement BOOLEAN DEFAULT 1',
  ];

  return new Promise((resolve) => {
    const migrations = columns.map(col => {
      const columnName = col.split(' ')[0];
      return `ALTER TABLE notification_settings ADD COLUMN ${col}`;
    });

    let completed = 0;
    let errors = 0;

    migrations.forEach(sql => {
      db.run(sql, (err) => {
        if (err) {
          if (err.message.includes('duplicate column')) {
            // Колонка уже существует — это нормально
          } else {
            console.error('Ошибка миграции email-уведомлений:', err.message);
            errors++;
          }
        }
        completed++;
        
        if (completed === migrations.length) {
          if (errors > 0) {
            console.error(`⚠️ Миграция email-уведомлений завершена с ${errors} ошибками`);
          } else {
            console.log('✅ Миграция email-уведомлений выполнена успешно');
          }
          resolve({ success: errors === 0 });
        }
      });
    });
  });
}

export default { addEmailNotificationSettingsMigration };
