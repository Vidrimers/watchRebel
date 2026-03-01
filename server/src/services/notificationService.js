import { executeQuery } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Проверить, включено ли уведомление для пользователя
 * @param {string} userId - ID пользователя
 * @param {string} notificationType - Тип уведомления
 * @returns {Promise<boolean>} - true если уведомление включено, false если выключено
 */
export async function checkNotificationEnabled(userId, notificationType) {
  try {
    // Получаем настройки уведомлений пользователя
    const settingsResult = await executeQuery(
      'SELECT * FROM notification_settings WHERE user_id = ?',
      [userId]
    );

    // Если настроек нет, считаем что все уведомления включены (дефолт)
    if (!settingsResult.success || settingsResult.data.length === 0) {
      console.log(`ℹ️ Настройки уведомлений не найдены для пользователя ${userId}, используем дефолтные (все включены)`);
      return true;
    }

    const settings = settingsResult.data[0];

    // Маппинг типов уведомлений на поля в БД
    const typeMapping = {
      'friend_added_to_list': 'friend_added_to_list',
      'friend_rated_media': 'friend_rated_media',
      'friend_posted_review': 'friend_posted_review',
      'friend_reacted_to_post': 'friend_reacted_to_post',
      'new_message': 'new_message',
      'new_friend_request': 'new_friend_request',
      'admin_announcement': 'admin_announcement'
    };

    const fieldName = typeMapping[notificationType];

    if (!fieldName) {
      console.warn(`⚠️ Неизвестный тип уведомления: ${notificationType}`);
      return true; // По умолчанию разрешаем неизвестные типы
    }

    const isEnabled = Boolean(settings[fieldName]);

    if (!isEnabled) {
      console.log(`🔕 Уведомление типа "${notificationType}" отключено для пользователя ${userId}`);
    }

    return isEnabled;
  } catch (error) {
    console.error('Ошибка проверки настроек уведомлений:', error);
    // В случае ошибки разрешаем отправку уведомления
    return true;
  }
}

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
 * Отправить уведомление в Telegram через HTTP запрос к Telegram Bot API
 * @param {string} userId - Telegram ID пользователя
 * @param {string} message - Текст уведомления
 * @param {Object} options - Дополнительные опции
 * @returns {Promise<Object>} - Результат отправки
 */
export async function sendTelegramNotification(userId, message, options = {}) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      console.error('❌ TELEGRAM_BOT_TOKEN не найден в переменных окружения');
      return { success: false, error: 'Bot token not configured' };
    }

    // Отправляем сообщение напрямую через Telegram Bot API
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const payload = {
      chat_id: userId,
      text: message,
      parse_mode: options.parse_mode || 'HTML',
      ...options
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!data.ok) {
      console.error(`❌ Ошибка отправки Telegram уведомления пользователю ${userId}:`, data.description);
      return { success: false, error: data.description };
    }

    console.log(`✅ Telegram уведомление отправлено пользователю ${userId}`);
    return { success: true, messageId: data.result.message_id };
  } catch (error) {
    console.error('❌ Ошибка отправки Telegram уведомления:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Создать и отправить уведомление о реакции
 * @param {string} postOwnerId - ID владельца поста
 * @param {string} reactorId - ID пользователя, который поставил реакцию
 * @param {string} emoji - Эмоджи реакции
 * @param {string} postId - ID поста
 * @param {boolean} isSelfReaction - Флаг самолайка (опционально)
 * @returns {Promise<Object>} - Результат создания и отправки уведомления
 */
export async function notifyReaction(postOwnerId, reactorId, emoji, postId, isSelfReaction = false) {
  try {
    // Проверяем настройки уведомлений пользователя
    const isEnabled = await checkNotificationEnabled(postOwnerId, 'friend_reacted_to_post');
    
    if (!isEnabled) {
      console.log(`🔕 Уведомление о реакции не отправлено пользователю ${postOwnerId} (отключено в настройках)`);
      return { success: true, skipped: true, reason: 'disabled_in_settings' };
    }

    let content;
    let telegramMessage;

    if (isSelfReaction) {
      // Уведомление о самолайке
      content = `Самолайк активирован ${emoji}`;
      telegramMessage = `😎 <b>Самолайк активирован!</b>\n\n${content}`;
    } else {
      // Получаем информацию о пользователе, который поставил реакцию
      const userResult = await executeQuery(
        'SELECT display_name FROM users WHERE id = ?',
        [reactorId]
      );

      if (!userResult.success || userResult.data.length === 0) {
        return { success: false, error: 'Пользователь не найден' };
      }

      const reactorName = userResult.data[0].display_name;
      content = `${reactorName} отреагировал на вашу запись: ${emoji}`;
      telegramMessage = `🔔 <b>Новая реакция!</b>\n\n${content}`;
    }

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

    // Определяем тип уведомления для проверки настроек
    let notificationType = '';
    switch (actionType) {
      case 'added_to_list':
        notificationType = 'friend_added_to_list';
        break;
      case 'rated':
        notificationType = 'friend_rated_media';
        break;
      case 'reviewed':
        notificationType = 'friend_posted_review';
        break;
      default:
        notificationType = 'friend_added_to_list'; // Дефолт
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

      // Проверяем настройки уведомлений пользователя
      const isEnabled = await checkNotificationEnabled(userId, notificationType);
      
      if (!isEnabled) {
        console.log(`🔕 Уведомление об активности друга не отправлено пользователю ${userId} (отключено в настройках)`);
        results.push({ userId, success: true, skipped: true, reason: 'disabled_in_settings' });
        continue;
      }

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

/**
 * Отправить уведомление о действии модерации
 * @param {string} userId - ID пользователя, которого модерируют
 * @param {string} actionType - Тип действия ('post_ban' | 'permanent_ban' | 'unban' | 'announcement')
 * @param {Object} actionData - Данные о действии (reason, duration, expiresAt, content)
 * @returns {Promise<Object>} - Результат отправки уведомления
 */
export async function notifyModeration(userId, actionType, actionData = {}) {
  try {
    // Проверяем настройки для объявлений
    if (actionType === 'announcement') {
      const isEnabled = await checkNotificationEnabled(userId, 'admin_announcement');
      
      if (!isEnabled) {
        console.log(`🔕 Уведомление-объявление не отправлено пользователю ${userId} (отключено в настройках)`);
        return { success: true, skipped: true, reason: 'disabled_in_settings' };
      }
    }

    let message = '';

    switch (actionType) {
      case 'post_ban':
        {
          const expiresDate = new Date(actionData.expiresAt);
          const formattedDate = expiresDate.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          message = `🚫 <b>Ограничение на создание постов</b>\n\n` +
                   `<b>Причина:</b> ${actionData.reason}\n` +
                   `<b>Длительность:</b> ${actionData.durationMinutes} минут\n` +
                   `<b>До:</b> ${formattedDate}\n\n` +
                   `Вы не сможете создавать посты до указанного времени.`;
        }
        break;

      case 'permanent_ban':
        message = `⛔ <b>Ваш аккаунт заблокирован</b>\n\n` +
                 `<b>Причина:</b> ${actionData.reason}\n\n` +
                 `Блокировка постоянная. Если вы считаете, что это ошибка, обратитесь к администратору.`;
        break;

      case 'unban':
        message = `✅ <b>Ваш аккаунт разблокирован</b>\n\n` +
                 `Все ограничения сняты. Добро пожаловать обратно!`;
        break;

      case 'announcement':
        message = `📢 <b>Объявление от администрации</b>\n\n${actionData.content}`;
        break;

      default:
        message = `⚠️ <b>Действие модерации</b>\n\nВаш аккаунт был изменен администратором.`;
    }

    // Отправляем уведомление в Telegram
    const result = await sendTelegramNotification(userId, message);

    if (result.success) {
      console.log(`✅ Уведомление о модерации (${actionType}) отправлено пользователю ${userId}`);
    } else {
      console.error(`❌ Ошибка отправки уведомления о модерации пользователю ${userId}:`, result.error);
    }

    return result;
  } catch (error) {
    console.error('Ошибка отправки уведомления о модерации:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Отправить уведомление о переименовании пользователя администратором
 * @param {string} userId - ID пользователя, которого переименовали
 * @param {string} oldName - Старое имя пользователя
 * @param {string} newName - Новое имя пользователя
 * @param {string} reason - Причина переименования (опционально)
 * @returns {Promise<Object>} - Результат отправки уведомления
 */
export async function sendRenameNotification(userId, oldName, newName, reason = null) {
  try {
    let message = `⚠️ <b>Ваше имя было изменено администратором</b>\n\n` +
                 `<b>Старое имя:</b> ${oldName}\n` +
                 `<b>Новое имя:</b> ${newName}`;

    // Добавляем причину, если она указана
    if (reason && reason.trim().length > 0) {
      message += `\n\n<b>Причина:</b>\n${reason.trim()}`;
    }

    // Отправляем уведомление в Telegram
    const result = await sendTelegramNotification(userId, message);

    if (result.success) {
      console.log(`✅ Уведомление о переименовании отправлено пользователю ${userId}`);
    } else {
      console.error(`❌ Ошибка отправки уведомления о переименовании пользователю ${userId}:`, result.error);
    }

    return result;
  } catch (error) {
    console.error('Ошибка отправки уведомления о переименовании:', error);
    return { success: false, error: error.message };
  }
}

export default {
  checkNotificationEnabled,
  createNotification,
  sendTelegramNotification,
  notifyReaction,
  notifyFriendActivity,
  notifyModeration,
  sendRenameNotification
};
