/**
 * Миграция для обновления существующих уведомлений
 * Убираем имена пользователей из content, оставляем только шаблоны
 * Имена будут подставляться динамически при отображении
 */

import { executeQuery } from '../db.js';

export async function updateNotificationContentTemplates() {
  console.log('🔄 Начинаем миграцию уведомлений...');

  try {
    // Получаем все уведомления с related_user_id
    const notificationsResult = await executeQuery(
      `SELECT n.id, n.content, n.type, n.related_user_id
       FROM notifications n
       WHERE n.related_user_id IS NOT NULL`
    );

    if (!notificationsResult.success) {
      console.error('❌ Ошибка получения уведомлений:', notificationsResult.error);
      return { success: false, error: notificationsResult.error };
    }

    const notifications = notificationsResult.data;
    console.log(`📊 Найдено уведомлений для обновления: ${notifications.length}`);

    let updatedCount = 0;

    for (const notification of notifications) {
      const { id, content, type, related_user_id } = notification;
      
      let newContent = content;
      let shouldUpdate = false;

      // Паттерны для разных типов уведомлений
      // Убираем любое слово/имя из начала до ключевых фраз
      const patterns = [
        { regex: /^.+?\s+(зарегистрировался по вашей реферальной ссылке!)$/, template: '$1' },
        { regex: /^.+?\s+(добавил .+ в свой список)$/, template: '$1' },
        { regex: /^.+?\s+(оценил .+ на \d+\/10)$/, template: '$1' },
        { regex: /^.+?\s+(написал отзыв на .+)$/, template: '$1' },
        { regex: /^.+?\s+(отреагировал на вашу запись:.+)$/, template: '$1' },
        { regex: /^.+?\s+(написал на вашей стене)$/, template: '$1' },
        { regex: /^.+?\s+(совершил действие с .+)$/, template: '$1' }
      ];

      // Пробуем каждый паттерн
      for (const pattern of patterns) {
        const match = content.match(pattern.regex);
        if (match) {
          newContent = match[1];
          shouldUpdate = true;
          break;
        }
      }

      // Если content изменился, обновляем
      if (shouldUpdate && newContent !== content) {
        const updateResult = await executeQuery(
          'UPDATE notifications SET content = ? WHERE id = ?',
          [newContent, id]
        );

        if (updateResult.success) {
          updatedCount++;
          console.log(`✅ Обновлено уведомление ${id}: "${content}" -> "${newContent}"`);
        } else {
          console.error(`❌ Ошибка обновления уведомления ${id}:`, updateResult.error);
        }
      }
    }

    console.log(`✅ Миграция завершена. Обновлено уведомлений: ${updatedCount}`);
    return { success: true, updatedCount };

  } catch (error) {
    console.error('❌ Ошибка миграции уведомлений:', error);
    return { success: false, error: error.message };
  }
}

// Если запускается напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
  updateNotificationContentTemplates()
    .then(result => {
      if (result.success) {
        console.log('✅ Миграция успешно выполнена');
        process.exit(0);
      } else {
        console.error('❌ Миграция завершилась с ошибкой');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Критическая ошибка:', error);
      process.exit(1);
    });
}
