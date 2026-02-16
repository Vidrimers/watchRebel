import { executeQuery } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Создать уведомление в базе данных
 * @param {string} userId - ID пользователя, который получит уведомление
 * @param {string} type - Тип уведомления ('reaction' | 'friend_activity')
 * @param {string} content - Текст уведомления
 * @param {string} relatedUserId - ID пользователя, который вызвал уведомление (опционально)
 * @param {string} relatedPostId - ID связанного поста (опционально)
 * @returns {Promise<Object>} - Результат создания уведомления
 */
export async function createNotification(userId, type, content, relatedUserId = null, relatedPostId = null) {
  try {
    const notificationId = uuidv4();
    
    const result = await executeQuery(
      `INSERT INTO notifications (id, user_id, type, content, related_user_id, related_post_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [notificationId, userId, type, content, relatedUserId, relatedPostId]
    );

    if (!result.success) {
      console.error('Ошибка создания уведомления:', result.error);
      return { success: false, error: result.error };
    }

    // Получаем созданное уведомление
    const notificationResult = await executeQuery(
      'SELECT * FROM notifications WHERE id = ?',
      [notificationId]
    );

    if (!notificationResult.success || notificationResult.data.length === 0) {
      return { success: false, error: 'Не удалось получить созданное уведомление' };
    }

    const notification = notificationResult.data[0];

    console.log(`✅ Уведомление создано для пользователя ${userId}`);

    return {
      success: true,
      notification: {
        id: notification.id,
        userId: notification.user_id,
        type: notification.type,
        content: notification.content,
        relatedUserId: notification.related_user_id,
        relatedPostId: notification.related_post_id,
        isRead: Boolean(notification.is_read),
        createdAt: notification.created_at
      }
    };
  } catch (error) {
    console.error('Ошибка создания уведомления:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Отправить уведомление в Telegram
 * Эта функция будет вызывать sendNotification из telegram-bot
 * @param {string} userId - Telegram ID пользователя
 * @param {string} message - Текст уведомления
 * @param {Object} options - Дополнительные опции
 * @returns {Promise<Object>} - Результат отправки
 */
export async function sendTelegramNotification(userId, message, options = {}) {
  try {
    // Динамический импорт для избежания циклических зависимостей
    const { sendNotification } = await import('../../../telegram-bot/src/index.js');
    
    const result = await sendNotification(userId, message, options);
    return result;
  } catch (error) {
    console.error('Ошибка отправки Telegram уведомления:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Создать и отправить уведомление о реакции
 * @param {string} postOwnerId - ID владельца поста
 * @param {string} reactorId - ID пользователя, который поставил реакцию
 * @param {string} emoji - Эмоджи реакции
 * @param {string} postId - ID поста
 * @returns {Promise<Object>} - Результат создания и отправки уведомления
 */
export async function notifyReaction(postOwnerId, reactorId, emoji, postId) {
  try {
    // Получаем информацию о пользователе, который поставил реакцию
    const userResult = await executeQuery(
      'SELECT display_name FROM users WHERE id = ?',
      [reactorId]
    );

    if (!userResult.success || userResult.data.length === 0) {
      return { success: false, error: 'Пользователь не найден' };
    }

    const reactorName = userResult.data[0].display_name;
    const content = `${reactorName} отреагировал на вашу запись: ${emoji}`;

    // Создаем уведомление в базе данных
    const notificationResult = await createNotification(
      postOwnerId,
      'reaction',
      content,
      reactorId,
      postId
    );

    if (!notificationResult.success) {
      return notificationResult;
    }

    // Отправляем уведомление в Telegram
    const telegramMessage = `🔔 <b>Новая реакция!</b>\n\n${content}`;
    await sendTelegramNotification(postOwnerId, telegramMessage);

    return notificationResult;
  } catch (error) {
    console.error('Ошибка отправки уведомления о реакции:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Создать и отправить уведомление об активности друга
 * @param {string} friendId - ID друга, который совершил действие
 * @param {string} actionType - Тип действия ('added_to_list' | 'rated' | 'reviewed')
 * @param {Object} mediaInfo - Информация о медиа (tmdbId, mediaType, title)
 * @returns {Promise<Object>} - Результат создания и отправки уведомлений
 */
export async function notifyFriendActivity(friendId, actionType, mediaInfo) {
  try {
    // Получаем информацию о друге
    const friendResult = await executeQuery(
      'SELECT display_name FROM users WHERE id = ?',
      [friendId]
    );

    if (!friendResult.success || friendResult.data.length === 0) {
      return { success: false, error: 'Друг не найден' };
    }

    const friendName = friendResult.data[0].display_name;

    // Получаем список друзей пользователя
    const friendsResult = await executeQuery(
      'SELECT user_id FROM friends WHERE friend_id = ?',
      [friendId]
    );

    if (!friendsResult.success) {
      return { success: false, error: 'Ошибка получения списка друзей' };
    }

    // Формируем текст уведомления в зависимости от типа действия
    let content = '';
    switch (actionType) {
      case 'added_to_list':
        content = `${friendName} добавил "${mediaInfo.title}" в свой список`;
        break;
      case 'rated':
        content = `${friendName} оценил "${mediaInfo.title}" на ${mediaInfo.rating}/10`;
        break;
      case 'reviewed':
        content = `${friendName} написал отзыв на "${mediaInfo.title}"`;
        break;
      default:
        content = `${friendName} совершил действие с "${mediaInfo.title}"`;
    }

    // Создаем уведомления для всех друзей
    const results = [];
    for (const friend of friendsResult.data) {
      const userId = friend.user_id;

      // Создаем уведомление в базе данных
      const notificationResult = await createNotification(
        userId,
        'friend_activity',
        content,
        friendId,
        null
      );

      if (notificationResult.success) {
        // Отправляем уведомление в Telegram
        const telegramMessage = `🔔 <b>Активность друга!</b>\n\n${content}`;
        await sendTelegramNotification(userId, telegramMessage);
        
        results.push({ userId, success: true });
      } else {
        results.push({ userId, success: false, error: notificationResult.error });
      }
    }

    console.log(`✅ Уведомления об активности друга отправлены: ${results.length} получателей`);

    return {
      success: true,
      notificationsSent: results.length,
      results
    };
  } catch (error) {
    console.error('Ошибка отправки уведомлений об активности друга:', error);
    return { success: false, error: error.message };
  }
}

export default {
  createNotification,
  sendTelegramNotification,
  notifyReaction,
  notifyFriendActivity
};
