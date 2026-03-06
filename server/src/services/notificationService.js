import { executeQuery } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';
import { clients } from './websocketService.js';

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
      `INSERT INTO notifications (id, user_id, type, content, related_user_id, related_post_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
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

    // Получаем информацию о посте
    const postResult = await executeQuery(
      'SELECT post_type, content, tmdb_id, media_type FROM wall_posts WHERE id = ?',
      [postId]
    );

    let postInfo = '';
    if (postResult.success && postResult.data.length > 0) {
      const post = postResult.data[0];
      
      // Если это отзыв, извлекаем название фильма из content (первая строка)
      if (post.post_type === 'review' && post.content) {
        const lines = post.content.split('\n');
        const mediaTitle = lines[0] || '';
        const mediaTypeText = post.media_type === 'movie' ? 'фильме' : 'сериале';
        postInfo = ` на ваш отзыв о ${mediaTypeText} "${mediaTitle}"`;
      } else {
        postInfo = ' на вашу запись';
      }
    } else {
      postInfo = ' на вашу запись';
    }

    let content;
    let telegramMessage;

    if (isSelfReaction) {
      // Уведомление о самолайке - здесь имя не нужно
      content = `Самолайк активирован ${emoji}`;
      telegramMessage = `😎 <b>Самолайк активирован!</b>\n\n${content}`;
    } else {
      // Получаем информацию о пользователе для Telegram (актуальное имя на момент отправки)
      const userResult = await executeQuery(
        'SELECT display_name FROM users WHERE id = ?',
        [reactorId]
      );

      if (!userResult.success || userResult.data.length === 0) {
        return { success: false, error: 'Пользователь не найден' };
      }

      const reactorName = userResult.data[0].display_name;
      
      // В БД сохраняем шаблон с эмодзи и информацией о посте
      content = `отреагировал${postInfo}: ${emoji}`;
      
      // Для Telegram используем актуальное имя
      telegramMessage = `🔔 <b>Новая реакция!</b>\n\n${reactorName} ${content}`;
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
 * @param {string} postId - ID поста на стене (опционально)
 * @returns {Promise<Object>} - Результат создания и отправки уведомлений
 */
export async function notifyFriendActivity(friendId, actionType, mediaInfo, postId = null) {
  try {
    // Получаем информацию о друге для Telegram (актуальное имя на момент отправки)
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

    // Формируем шаблон уведомления без имени (имя будет подставляться динамически)
    let contentTemplate = '';
    let telegramContent = '';
    switch (actionType) {
      case 'added_to_list':
        contentTemplate = `добавил "${mediaInfo.title}" в свой список`;
        telegramContent = `${friendName} ${contentTemplate}`;
        break;
      case 'rated':
        contentTemplate = `оценил "${mediaInfo.title}" на ${mediaInfo.rating}/10`;
        telegramContent = `${friendName} ${contentTemplate}`;
        break;
      case 'reviewed':
        contentTemplate = `написал отзыв на "${mediaInfo.title}"`;
        telegramContent = `${friendName} ${contentTemplate}`;
        break;
      default:
        contentTemplate = `совершил действие с "${mediaInfo.title}"`;
        telegramContent = `${friendName} ${contentTemplate}`;
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

      // Создаем уведомление в базе данных с шаблоном
      const notificationResult = await createNotification(
        userId,
        'friend_activity',
        contentTemplate,
        friendId,
        postId  // Передаем postId если есть
      );

      if (notificationResult.success) {
        // Отправляем уведомление в Telegram с актуальным именем
        const telegramMessage = `🔔 <b>Активность друга!</b>\n\n${telegramContent}`;
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
 * Экранировать специальные символы для Telegram MarkdownV2
 * В MarkdownV2 нужно экранировать: _ * [ ] ( ) ~ ` > # + - = | { } . !
 * НО мы НЕ экранируем символы форматирования, которые пользователь вводит намеренно
 * @param {string} text - Текст для экранирования
 * @returns {string} - Экранированный текст
 */
function escapeMarkdownV2(text) {
  // Для простоты не экранируем ничего - пользователь сам контролирует форматирование
  // Telegram API сам обработает ошибки форматирования
  return text;
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
        // Для объявлений используем текст как есть, без дополнительной обёртки
        // parse_mode будет установлен в MarkdownV2 при отправке
        message = actionData.content;
        break;

      default:
        message = `⚠️ <b>Действие модерации</b>\n\nВаш аккаунт был изменен администратором.`;
    }

    // Отправляем уведомление в Telegram
    // Для объявлений используем MarkdownV2, для остальных - HTML
    const parseMode = actionType === 'announcement' ? 'MarkdownV2' : 'HTML';
    const result = await sendTelegramNotification(userId, message, { parse_mode: parseMode });

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

/**
 * Создать и отправить уведомление о посте на стене
 * @param {string} wallOwnerId - ID владельца стены
 * @param {string} authorId - ID автора поста
 * @param {string} postId - ID поста
 * @returns {Promise<Object>} - Результат создания и отправки уведомления
 */
export async function notifyWallPost(wallOwnerId, authorId, postId) {
  try {
    // Получаем информацию об авторе для Telegram (актуальное имя на момент отправки)
    const authorResult = await executeQuery(
      'SELECT display_name FROM users WHERE id = ?',
      [authorId]
    );

    if (!authorResult.success || authorResult.data.length === 0) {
      return { success: false, error: 'Автор не найден' };
    }

    const authorName = authorResult.data[0].display_name;
    
    // В БД сохраняем шаблон без имени, имя будет подставляться динамически
    const contentTemplate = 'написал на вашей стене';
    
    // Для Telegram используем актуальное имя
    const telegramMessage = `📝 <b>Новый пост на вашей стене!</b>\n\n${authorName} ${contentTemplate}`;

    // Создаем уведомление в базе данных
    const notificationResult = await createNotification(
      wallOwnerId,
      'wall_post',
      contentTemplate,
      authorId,
      postId
    );

    if (!notificationResult.success) {
      return notificationResult;
    }

    // Отправляем уведомление в Telegram
    await sendTelegramNotification(wallOwnerId, telegramMessage);

    console.log(`✅ Уведомление о посте на стене отправлено пользователю ${wallOwnerId}`);

    return notificationResult;
  } catch (error) {
    console.error('Ошибка отправки уведомления о посте на стене:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Создать и отправить уведомление о загрузке изображений на стене
 * @param {string} wallOwnerId - ID владельца стены
 * @param {string} authorId - ID автора, загрузившего изображения
 * @param {string} postId - ID поста
 * @param {number} imageCount - Количество загруженных изображений
 * @returns {Promise<Object>} - Результат создания и отправки уведомления
 */
export async function notifyWallPostImages(wallOwnerId, authorId, postId, imageCount) {
  try {
    // Получаем информацию об авторе для Telegram (актуальное имя на момент отправки)
    const authorResult = await executeQuery(
      'SELECT display_name FROM users WHERE id = ?',
      [authorId]
    );

    if (!authorResult.success || authorResult.data.length === 0) {
      return { success: false, error: 'Автор не найден' };
    }

    const authorName = authorResult.data[0].display_name;
    
    // Формируем текст в зависимости от количества изображений
    const photoWord = imageCount === 1 ? 'фото' : imageCount < 5 ? 'фотографии' : 'фотографий';
    
    // В БД сохраняем шаблон без имени, имя будет подставляться динамически
    const contentTemplate = `добавил ${imageCount} ${photoWord} на вашей стене`;
    
    // Для Telegram используем актуальное имя
    const telegramMessage = `📷 <b>Новые фото на вашей стене!</b>\n\n${authorName} ${contentTemplate}`;

    // Создаем уведомление в базе данных
    const notificationResult = await createNotification(
      wallOwnerId,
      'wall_post',
      contentTemplate,
      authorId,
      postId
    );

    if (!notificationResult.success) {
      return notificationResult;
    }

    // Отправляем уведомление в Telegram
    await sendTelegramNotification(wallOwnerId, telegramMessage);

    console.log(`✅ Уведомление о загрузке ${imageCount} изображений отправлено пользователю ${wallOwnerId}`);

    return notificationResult;
  } catch (error) {
    console.error('Ошибка отправки уведомления о загрузке изображений:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Создать и отправить уведомление о комментарии к изображению
 * @param {string} postId - ID поста с изображением
 * @param {string} imageId - ID изображения
 * @param {string} commentAuthorId - ID автора комментария
 * @returns {Promise<Object>} - Результат создания и отправки уведомления
 */
export async function notifyImageComment(postId, imageId, commentAuthorId) {
  try {
    // Получаем владельца поста
    const postResult = await executeQuery(
      'SELECT user_id FROM wall_posts WHERE id = ?',
      [postId]
    );

    if (!postResult.success || postResult.data.length === 0) {
      return { success: false, error: 'Пост не найден' };
    }

    const postOwnerId = postResult.data[0].user_id;

    // Не отправляем уведомление, если пользователь комментирует свое же изображение
    if (postOwnerId === commentAuthorId) {
      return { success: true, message: 'Уведомление не отправлено (автор комментирует свое изображение)' };
    }

    // Получаем информацию об авторе комментария
    const authorResult = await executeQuery(
      'SELECT display_name FROM users WHERE id = ?',
      [commentAuthorId]
    );

    if (!authorResult.success || authorResult.data.length === 0) {
      return { success: false, error: 'Автор комментария не найден' };
    }

    const authorName = authorResult.data[0].display_name;
    
    // В БД сохраняем шаблон без имени
    const contentTemplate = 'прокомментировал ваше фото';
    
    // Для Telegram используем актуальное имя
    const telegramMessage = `💬 <b>Новый комментарий к фото!</b>\n\n${authorName} ${contentTemplate}`;

    // Создаем уведомление в базе данных
    const notificationResult = await createNotification(
      postOwnerId,
      'image_comment',
      contentTemplate,
      commentAuthorId,
      postId
    );

    if (!notificationResult.success) {
      return notificationResult;
    }

    // Отправляем уведомление в Telegram
    await sendTelegramNotification(postOwnerId, telegramMessage);

    console.log(`✅ Уведомление о комментарии к изображению отправлено пользователю ${postOwnerId}`);

    return notificationResult;
  } catch (error) {
    console.error('Ошибка отправки уведомления о комментарии к изображению:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Создать и отправить уведомление об ответе на комментарий к изображению
 * @param {string} parentCommentId - ID родительского комментария
 * @param {string} replyAuthorId - ID автора ответа
 * @param {string} postId - ID поста
 * @param {string} imageId - ID изображения
 * @returns {Promise<Object>} - Результат создания и отправки уведомления
 */
export async function notifyCommentReply(parentCommentId, replyAuthorId, postId, imageId) {
  try {
    // Получаем автора родительского комментария
    const parentCommentResult = await executeQuery(
      'SELECT user_id FROM image_comments WHERE id = ?',
      [parentCommentId]
    );

    if (!parentCommentResult.success || parentCommentResult.data.length === 0) {
      return { success: false, error: 'Родительский комментарий не найден' };
    }

    const parentCommentAuthorId = parentCommentResult.data[0].user_id;

    // Не отправляем уведомление, если пользователь отвечает сам себе
    if (parentCommentAuthorId === replyAuthorId) {
      return { success: true, message: 'Уведомление не отправлено (пользователь отвечает сам себе)' };
    }

    // Получаем информацию об авторе ответа
    const authorResult = await executeQuery(
      'SELECT display_name FROM users WHERE id = ?',
      [replyAuthorId]
    );

    if (!authorResult.success || authorResult.data.length === 0) {
      return { success: false, error: 'Автор ответа не найден' };
    }

    const authorName = authorResult.data[0].display_name;
    
    // В БД сохраняем шаблон без имени
    const contentTemplate = 'ответил на ваш комментарий';
    
    // Для Telegram используем актуальное имя
    const telegramMessage = `💬 <b>Ответ на ваш комментарий!</b>\n\n${authorName} ${contentTemplate}`;

    // Создаем уведомление в базе данных
    const notificationResult = await createNotification(
      parentCommentAuthorId,
      'comment_reply',
      contentTemplate,
      replyAuthorId,
      postId
    );

    if (!notificationResult.success) {
      return notificationResult;
    }

    // Отправляем уведомление в Telegram
    await sendTelegramNotification(parentCommentAuthorId, telegramMessage);

    console.log(`✅ Уведомление об ответе на комментарий отправлено пользователю ${parentCommentAuthorId}`);

    return notificationResult;
  } catch (error) {
    console.error('Ошибка отправки уведомления об ответе на комментарий:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Отправить уведомление о комментарии к посту
 * @param {string} postAuthorId - ID автора поста
 * @param {string} commentAuthorId - ID автора комментария
 * @param {string} postId - ID поста
 * @param {string} commentId - ID комментария
 * @returns {Promise<Object>} - Результат создания и отправки уведомления
 */
export async function notifyPostComment(postAuthorId, commentAuthorId, postId, commentId) {
  try {
    // Не отправляем уведомление, если пользователь комментирует свой пост
    if (postAuthorId === commentAuthorId) {
      return { success: true, message: 'Уведомление не отправлено (пользователь комментирует свой пост)' };
    }

    // Получаем информацию об авторе комментария
    const authorResult = await executeQuery(
      'SELECT display_name FROM users WHERE id = ?',
      [commentAuthorId]
    );

    if (!authorResult.success || authorResult.data.length === 0) {
      return { success: false, error: 'Автор комментария не найден' };
    }

    const authorName = authorResult.data[0].display_name;
    
    // В БД сохраняем шаблон без имени
    const contentTemplate = 'прокомментировал ваш пост';
    
    // Для Telegram используем актуальное имя
    const telegramMessage = `💬 <b>Новый комментарий!</b>\n\n${authorName} ${contentTemplate}`;

    // Создаем уведомление в базе данных
    const notificationResult = await createNotification(
      postAuthorId,
      'post_comment',
      contentTemplate,
      commentAuthorId,
      postId
    );

    if (!notificationResult.success) {
      return notificationResult;
    }

    // Отправляем уведомление в Telegram
    await sendTelegramNotification(postAuthorId, telegramMessage);

    console.log(`✅ Уведомление о комментарии к посту отправлено пользователю ${postAuthorId}`);

    return notificationResult;
  } catch (error) {
    console.error('Ошибка отправки уведомления о комментарии к посту:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Отправить уведомление об ответе на комментарий к посту
 * @param {string} parentCommentAuthorId - ID автора родительского комментария
 * @param {string} replyAuthorId - ID автора ответа
 * @param {string} postId - ID поста
 * @param {string} commentId - ID комментария-ответа
 * @returns {Promise<Object>} - Результат создания и отправки уведомления
 */
export async function notifyPostCommentReply(parentCommentAuthorId, replyAuthorId, postId, commentId) {
  try {
    // Не отправляем уведомление, если пользователь отвечает сам себе
    if (parentCommentAuthorId === replyAuthorId) {
      return { success: true, message: 'Уведомление не отправлено (пользователь отвечает сам себе)' };
    }

    // Получаем информацию об авторе ответа
    const authorResult = await executeQuery(
      'SELECT display_name FROM users WHERE id = ?',
      [replyAuthorId]
    );

    if (!authorResult.success || authorResult.data.length === 0) {
      return { success: false, error: 'Автор ответа не найден' };
    }

    const authorName = authorResult.data[0].display_name;
    
    // В БД сохраняем шаблон без имени
    const contentTemplate = 'ответил на ваш комментарий';
    
    // Для Telegram используем актуальное имя
    const telegramMessage = `💬 <b>Ответ на ваш комментарий!</b>\n\n${authorName} ${contentTemplate}`;

    // Создаем уведомление в базе данных
    const notificationResult = await createNotification(
      parentCommentAuthorId,
      'post_comment_reply',
      contentTemplate,
      replyAuthorId,
      postId
    );

    if (!notificationResult.success) {
      return notificationResult;
    }

    // Отправляем уведомление в Telegram
    await sendTelegramNotification(parentCommentAuthorId, telegramMessage);

    console.log(`✅ Уведомление об ответе на комментарий к посту отправлено пользователю ${parentCommentAuthorId}`);

    return notificationResult;
  } catch (error) {
    console.error('Ошибка отправки уведомления об ответе на комментарий к посту:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Отправить уведомление о лайке комментария
 * @param {string} commentAuthorId - ID автора комментария
 * @param {string} likerId - ID пользователя, который лайкнул
 * @param {string} postId - ID поста
 * @param {string} commentId - ID комментария
 * @returns {Promise<Object>} - Результат создания и отправки уведомления
 */
export async function notifyCommentLike(commentAuthorId, likerId, postId, commentId) {
  try {
    // Не отправляем уведомление, если пользователь лайкает свой комментарий
    if (commentAuthorId === likerId) {
      return { success: true, message: 'Уведомление не отправлено (пользователь лайкает свой комментарий)' };
    }

    // Получаем информацию о пользователе, который лайкнул
    const likerResult = await executeQuery(
      'SELECT display_name FROM users WHERE id = ?',
      [likerId]
    );

    if (!likerResult.success || likerResult.data.length === 0) {
      return { success: false, error: 'Пользователь не найден' };
    }

    const likerName = likerResult.data[0].display_name;
    
    // В БД сохраняем шаблон без имени
    const contentTemplate = 'лайкнул ваш комментарий';
    
    // Для Telegram используем актуальное имя
    const telegramMessage = `❤️ <b>Новый лайк комментария!</b>\n\n${likerName} ${contentTemplate}`;

    // Создаем уведомление в базе данных
    const notificationResult = await createNotification(
      commentAuthorId,
      'comment_like',
      contentTemplate,
      likerId,
      postId
    );

    if (!notificationResult.success) {
      return notificationResult;
    }

    // Отправляем уведомление в Telegram
    await sendTelegramNotification(commentAuthorId, telegramMessage);

    console.log(`✅ Уведомление о лайке комментария отправлено пользователю ${commentAuthorId}`);

    return notificationResult;
  } catch (error) {
    console.error('Ошибка отправки уведомления о лайке комментария:', error);
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
  sendRenameNotification,
  notifyWallPost,
  notifyWallPostImages,
  notifyImageComment,
  notifyCommentReply,
  notifyPostComment,
  notifyPostCommentReply,
  notifyCommentLike
};

/**
 * Отправить уведомления друзьям о новом отзыве
 * @param {string} authorId - ID автора отзыва
 * @param {number} tmdbId - ID фильма/сериала в TMDb
 * @param {string} mediaType - Тип медиа ('movie' | 'tv')
 * @param {string} mediaTitle - Название фильма/сериала
 * @param {string} postId - ID поста с отзывом
 * @returns {Promise<Object>} - Результат отправки уведомлений
 */
export async function notifyFriendPostedReview(authorId, tmdbId, mediaType, mediaTitle, postId) {
  try {
    console.log(`🔔 [notifyFriendPostedReview] СТАРТ. AuthorId: ${authorId}, MediaTitle: ${mediaTitle}, PostId: ${postId}`);
    
    // Получаем информацию об авторе
    const authorResult = await executeQuery(
      'SELECT id, display_name, telegram_username FROM users WHERE id = ?',
      [authorId]
    );

    if (!authorResult.success || authorResult.data.length === 0) {
      console.error('❌ [notifyFriendPostedReview] Автор отзыва не найден');
      return { success: false, error: 'Автор не найден' };
    }

    const author = authorResult.data[0];
    const authorName = author.display_name || author.telegram_username || 'Пользователь';
    console.log(`✅ [notifyFriendPostedReview] Автор найден: ${authorName} (${authorId})`);

    // Получаем список друзей автора
    console.log(`🔍 [notifyFriendPostedReview] Запрос друзей для пользователя ${authorId}`);
    const friendsResult = await executeQuery(
      `SELECT DISTINCT 
        CASE 
          WHEN user_id = ? THEN friend_id 
          ELSE user_id 
        END as friend_id
       FROM friends 
       WHERE user_id = ? OR friend_id = ?`,
      [authorId, authorId, authorId]
    );

    if (!friendsResult.success) {
      console.error('❌ [notifyFriendPostedReview] Ошибка получения списка друзей:', friendsResult.error);
      return { success: false, error: friendsResult.error };
    }

    console.log(`📊 [notifyFriendPostedReview] Найдено друзей: ${friendsResult.data.length}`);
    
    if (friendsResult.data.length === 0) {
      console.log('⚠️ [notifyFriendPostedReview] У пользователя нет друзей для уведомления');
      return { success: true, message: 'Нет друзей для уведомления' };
    }

    const friends = friendsResult.data;
    console.log(`📢 [notifyFriendPostedReview] Начинаем отправку уведомлений ${friends.length} друзьям`);

    // Отправляем уведомления каждому другу
    const notifications = [];
    
    for (const friend of friends) {
      const friendId = friend.friend_id;
      console.log(`👤 [notifyFriendPostedReview] Обработка друга: ${friendId}`);

      // Проверяем настройки уведомлений друга
      const isEnabled = await checkNotificationEnabled(friendId, 'friend_posted_review');
      console.log(`⚙️ [notifyFriendPostedReview] Настройки уведомлений для ${friendId}: ${isEnabled ? 'включены' : 'отключены'}`);
      
      if (!isEnabled) {
        console.log(`⏭️ [notifyFriendPostedReview] Пропускаем уведомление для ${friendId} (отключено в настройках)`);
        continue;
      }

      // Создаем уведомление на сайте
      const content = `${authorName} написал отзыв на "${mediaTitle}"`;
      console.log(`📝 [notifyFriendPostedReview] Создаем уведомление для ${friendId}: "${content}"`);
      
      const notificationResult = await createNotification(
        friendId,
        'friend_posted_review',
        content,
        authorId,
        postId
      );

      if (notificationResult.success) {
        console.log(`✅ [notifyFriendPostedReview] Уведомление создано для ${friendId}`);
        notifications.push(notificationResult.notification);

        // Отправляем WebSocket уведомление
        try {
          const ws = clients.get(friendId);
          if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({
              type: 'notification',
              notification: notificationResult.notification
            }));
            console.log(`✅ [notifyFriendPostedReview] WebSocket уведомление отправлено для ${friendId}`);
          } else {
            console.log(`⚠️ [notifyFriendPostedReview] WebSocket не подключен для ${friendId}`);
          }
        } catch (err) {
          console.error(`❌ [notifyFriendPostedReview] Ошибка отправки WebSocket уведомления для ${friendId}:`, err);
        }

        // Отправляем уведомление в Telegram
        try {
          const telegramMessage = `📝 ${authorName} написал отзыв на "${mediaTitle}"\n\n` +
            `Посмотреть: ${process.env.PUBLIC_URL}/media/${mediaType}/${tmdbId}?reviewPost=${postId}`;

          await sendTelegramNotification(friendId, telegramMessage);
          console.log(`✅ [notifyFriendPostedReview] Telegram уведомление отправлено для ${friendId}`);
        } catch (error) {
          console.error(`❌ [notifyFriendPostedReview] Ошибка отправки Telegram уведомления для ${friendId}:`, error.message);
        }
      } else {
        console.error(`❌ [notifyFriendPostedReview] Не удалось создать уведомление для ${friendId}:`, notificationResult.error);
      }
    }

    console.log(`✅ [notifyFriendPostedReview] ЗАВЕРШЕНО. Отправлено ${notifications.length} уведомлений о новом отзыве`);

    return {
      success: true,
      notifications,
      count: notifications.length
    };

  } catch (error) {
    console.error('Ошибка отправки уведомлений о новом отзыве:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Отправить уведомление админу о новом багрепорте
 * @param {string} bugReportId - ID багрепорта
 * @param {string} bugReportTitle - Заголовок багрепорта
 * @param {string} authorId - ID автора багрепорта
 * @returns {Promise<Object>} - Результат отправки уведомления
 */
export async function notifyAdminNewBugReport(bugReportId, bugReportTitle, authorId) {
  try {
    console.log(`🔔 [notifyAdminNewBugReport] СТАРТ. BugReportId: ${bugReportId}, AuthorId: ${authorId}`);

    // Получаем ID админа из переменных окружения
    const adminId = process.env.TELEGRAM_ADMIN_ID;
    
    if (!adminId) {
      console.error('❌ [notifyAdminNewBugReport] TELEGRAM_ADMIN_ID не найден в переменных окружения');
      return { success: false, error: 'Admin ID not configured' };
    }

    // Проверяем, что админ существует в таблице users
    const adminCheckResult = await executeQuery(
      'SELECT id, is_admin FROM users WHERE id = ?',
      [adminId]
    );

    const adminExistsInDb = adminCheckResult.success && adminCheckResult.data.length > 0;

    if (!adminExistsInDb) {
      console.warn(`⚠️ [notifyAdminNewBugReport] Админ ${adminId} не найден в таблице users, отправляем только Telegram уведомление`);
    }

    // Получаем информацию об авторе багрепорта для Telegram
    const authorResult = await executeQuery(
      'SELECT display_name FROM users WHERE id = ?',
      [authorId]
    );

    const authorName = authorResult.success && authorResult.data.length > 0 
      ? authorResult.data[0].display_name 
      : 'Пользователь';

    // Создаем уведомление на сайте только если админ существует в БД
    let notificationResult = null;
    if (adminExistsInDb) {
      // Проверяем, что автор существует в таблице users (для relatedUserId)
      const authorCheckResult = await executeQuery(
        'SELECT id FROM users WHERE id = ?',
        [authorId]
      );

      const authorExistsInDb = authorCheckResult.success && authorCheckResult.data.length > 0;

      // В content сохраняем шаблон без имени, имя будет подставляться динамически
      const content = authorExistsInDb 
        ? `отправил багрепорт: "${bugReportTitle}"`
        : `Новый багрепорт: "${bugReportTitle}"`;
      
      console.log(`📝 [notifyAdminNewBugReport] Создаем уведомление`);

      notificationResult = await createNotification(
        adminId,
        'new_bug_report',
        content,
        authorExistsInDb ? authorId : null, // relatedUserId только если автор существует
        null // related_post_id должен быть null, т.к. bugReportId не из таблицы wall_posts
      );

      if (!notificationResult.success) {
        console.error(`❌ [notifyAdminNewBugReport] Не удалось создать уведомление:`, notificationResult.error);
        // Не возвращаем ошибку, продолжаем отправку в Telegram
      } else {
        console.log(`✅ [notifyAdminNewBugReport] Уведомление создано`);

        // Отправляем WebSocket уведомление
        try {
          const ws = clients.get(adminId);
          if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({
              type: 'notification',
              notification: notificationResult.notification
            }));
            console.log(`✅ [notifyAdminNewBugReport] WebSocket уведомление отправлено`);
          } else {
            console.log(`⚠️ [notifyAdminNewBugReport] WebSocket не подключен для админа ${adminId}`);
          }
        } catch (err) {
          console.error(`❌ [notifyAdminNewBugReport] Ошибка отправки WebSocket уведомления:`, err);
        }
      }
    }

    // Отправляем уведомление в Telegram
    try {
      const telegramMessage = `🐛 <b>Новый багрепорт!</b>\n\n` +
        `<b>От:</b> ${authorName}\n` +
        `<b>Заголовок:</b> ${bugReportTitle}\n\n` +
        `Посмотреть: ${process.env.PUBLIC_URL}/admin/bug-reports`;

      await sendTelegramNotification(adminId, telegramMessage);
      console.log(`✅ [notifyAdminNewBugReport] Telegram уведомление отправлено`);
    } catch (error) {
      console.error(`❌ [notifyAdminNewBugReport] Ошибка отправки Telegram уведомления:`, error.message);
    }

    console.log(`✅ [notifyAdminNewBugReport] ЗАВЕРШЕНО`);

    return {
      success: true,
      notification: notificationResult.notification
    };

  } catch (error) {
    console.error('Ошибка отправки уведомления админу о новом багрепорте:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Отправить уведомление пользователю об изменении статуса багрепорта
 * @param {string} userId - ID пользователя, который создал багрепорт
 * @param {string} bugReportTitle - Заголовок багрепорта
 * @param {string} newStatus - Новый статус ('new' | 'in_progress' | 'resolved' | 'rejected')
 * @param {string} bugReportId - ID багрепорта
 * @returns {Promise<Object>} - Результат отправки уведомления
 */
export async function notifyBugReportStatusChanged(userId, bugReportTitle, newStatus, bugReportId) {
  try {
    console.log(`🔔 [notifyBugReportStatusChanged] СТАРТ. UserId: ${userId}, Status: ${newStatus}, BugReportId: ${bugReportId}`);

    // Маппинг статусов на русский язык и эмодзи
    const statusMap = {
      'new': { text: 'Новый', emoji: '🆕' },
      'in_progress': { text: 'В работе', emoji: '⚙️' },
      'resolved': { text: 'Решено', emoji: '✅' },
      'rejected': { text: 'Отклонено', emoji: '❌' }
    };

    const statusInfo = statusMap[newStatus] || { text: newStatus, emoji: '📝' };

    // Создаем уведомление на сайте
    const content = `Статус вашего багрепорта "${bugReportTitle}" изменён на: ${statusInfo.text}`;
    console.log(`📝 [notifyBugReportStatusChanged] Создаем уведомление: "${content}"`);

    const notificationResult = await createNotification(
      userId,
      'bug_report_status_changed',
      content,
      null,
      null  // related_post_id должен быть null, т.к. это багрепорт, а не пост
    );

    if (!notificationResult.success) {
      console.error(`❌ [notifyBugReportStatusChanged] Не удалось создать уведомление:`, notificationResult.error);
      return { success: false, error: notificationResult.error };
    }

    console.log(`✅ [notifyBugReportStatusChanged] Уведомление создано`);

    // Отправляем WebSocket уведомление
    try {
      const ws = clients.get(userId);
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'notification',
          notification: notificationResult.notification
        }));
        console.log(`✅ [notifyBugReportStatusChanged] WebSocket уведомление отправлено`);
      } else {
        console.log(`⚠️ [notifyBugReportStatusChanged] WebSocket не подключен для пользователя ${userId}`);
      }
    } catch (err) {
      console.error(`❌ [notifyBugReportStatusChanged] Ошибка отправки WebSocket уведомления:`, err);
    }

    // Отправляем уведомление в Telegram
    try {
      const telegramMessage = `${statusInfo.emoji} Статус вашего багрепорта изменён\n\n` +
        `Багрепорт: "${bugReportTitle}"\n` +
        `Новый статус: ${statusInfo.text}\n\n` +
        `Посмотреть: ${process.env.PUBLIC_URL}/my-bug-reports`;

      await sendTelegramNotification(userId, telegramMessage);
      console.log(`✅ [notifyBugReportStatusChanged] Telegram уведомление отправлено`);
    } catch (error) {
      console.error(`❌ [notifyBugReportStatusChanged] Ошибка отправки Telegram уведомления:`, error.message);
    }

    console.log(`✅ [notifyBugReportStatusChanged] ЗАВЕРШЕНО`);

    return {
      success: true,
      notification: notificationResult.notification
    };

  } catch (error) {
    console.error('Ошибка отправки уведомления об изменении статуса багрепорта:', error);
    return { success: false, error: error.message };
  }
}
