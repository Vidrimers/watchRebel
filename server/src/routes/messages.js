import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendTelegramNotification, checkNotificationEnabled } from '../services/notificationService.js';
import { sendMessageToUser } from '../services/websocketService.js';
import { uploadMessageFiles } from '../middleware/upload.js';

const router = express.Router();

/**
 * GET /api/messages/conversations
 * Получить список всех диалогов текущего пользователя
 * Диалоги отсортированы по дате последнего сообщения (новые сверху)
 */
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Получаем все диалоги пользователя с информацией о собеседнике и последнем сообщении
    const query = `
      SELECT
        c.id,
        c.user1_id,
        c.user2_id,
        c.last_message_at,
        c.created_at,
        CASE
          WHEN c.user1_id = ? THEN u2.id
          ELSE u1.id
        END as other_user_id,
        CASE
          WHEN c.user1_id = ? THEN u2.display_name
          ELSE u1.display_name
        END as other_user_name,
        CASE
          WHEN c.user1_id = ? THEN u2.avatar_url
          ELSE u1.avatar_url
        END as other_user_avatar,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_content,
        (SELECT attachments FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_attachments,
        (SELECT deleted_for_users FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_deleted_for,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND receiver_id = ? AND is_read = 0) as unread_count
      FROM conversations c
      LEFT JOIN users u1 ON c.user1_id = u1.id
      LEFT JOIN users u2 ON c.user2_id = u2.id
      WHERE c.user1_id = ? OR c.user2_id = ?
      ORDER BY c.last_message_at DESC
    `;

    const conversationsResult = await executeQuery(query, [userId, userId, userId, userId, userId, userId]);

    if (!conversationsResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения диалогов',
        code: 'DATABASE_ERROR' 
      });
    }

    // Фильтруем диалоги: скрываем те, где последнее сообщение скрыто для текущего пользователя
    const visibleConversations = conversationsResult.data.filter(c => {
      if (!c.last_message_deleted_for) return true;
      try {
        const deleted = JSON.parse(c.last_message_deleted_for);
        return !deleted.includes(userId);
      } catch {
        return true;
      }
    });

    const conversations = visibleConversations.map(c => {
      // Формируем текст последнего сообщения
      let lastMessage = c.last_message_content;
      
      // Если есть вложения, показываем информацию о них
      if (c.last_message_attachments) {
        try {
          const attachments = JSON.parse(c.last_message_attachments);
          if (attachments && attachments.length > 0) {
            // Определяем тип первого вложения
            const firstAttachment = attachments[0];
            const mimeType = firstAttachment.mimeType || '';
            
            let attachmentType = 'файл';
            if (mimeType.startsWith('image/')) attachmentType = 'изображение';
            else if (mimeType.startsWith('video/')) attachmentType = 'видео';
            else if (mimeType.startsWith('audio/')) attachmentType = 'аудио';
            else attachmentType = 'документ';
            
            if (attachments.length === 1) {
              lastMessage = `📎 ${attachmentType}`;
            } else {
              lastMessage = `📎 ${attachments.length} файл(ов)`;
            }
            
            // Если есть текст вместе с вложениями, добавляем его
            if (c.last_message_content && c.last_message_content.trim().length > 0) {
              lastMessage += `: ${c.last_message_content}`;
            }
          }
        } catch (e) {
          // Если ошибка парсинга, используем обычный текст
          console.error('Ошибка парсинга attachments:', e);
        }
      }
      
      return {
        id: c.id,
        otherUser: {
          id: c.other_user_id,
          displayName: c.other_user_name,
          avatarUrl: c.other_user_avatar
        },
        lastMessage: lastMessage,
        unreadCount: c.unread_count || 0,
        lastMessageAt: c.last_message_at ? c.last_message_at + 'Z' : null,
        createdAt: c.created_at ? c.created_at + 'Z' : null
      };
    });

    res.json(conversations);

  } catch (error) {
    console.error('Ошибка получения диалогов:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/messages/:conversationId
 * Получить все сообщения из конкретного диалога
 * Query params: limit (default: 20), offset (default: 0)
 * Сообщения отсортированы по дате создания (старые сверху)
 * Автоматически отмечает непрочитанные сообщения как прочитанные
 */
router.get('/:conversationId', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    // Проверяем, что пользователь является участником диалога
    const conversationCheck = await executeQuery(
      'SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [conversationId, userId, userId]
    );

    if (!conversationCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки диалога',
        code: 'DATABASE_ERROR' 
      });
    }

    if (conversationCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Диалог не найден или у вас нет доступа',
        code: 'CONVERSATION_NOT_FOUND' 
      });
    }

    // Получаем общее количество сообщений
    const countQuery = `
      SELECT COUNT(*) as total
      FROM messages
      WHERE conversation_id = ?
    `;
    
    const countResult = await executeQuery(countQuery, [conversationId]);
    const totalMessages = countResult.success ? countResult.data[0].total : 0;

    // Получаем сообщения с пагинацией (сортируем по убыванию, берем limit, потом разворачиваем)
    const messagesQuery = `
      SELECT * FROM (
        SELECT 
          m.*,
          u.display_name as sender_name,
          u.avatar_url as sender_avatar
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ?
          AND (m.deleted_for_users IS NULL OR m.deleted_for_users = '[]' OR NOT m.deleted_for_users LIKE '%"${userId}"%')
        ORDER BY m.created_at DESC
        LIMIT ? OFFSET ?
      ) ORDER BY created_at ASC
    `;

    const messagesResult = await executeQuery(messagesQuery, [conversationId, limit, offset]);

    if (!messagesResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения сообщений',
        code: 'DATABASE_ERROR' 
      });
    }

    // Отмечаем все непрочитанные сообщения как прочитанные
    await executeQuery(
      'UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND receiver_id = ? AND is_read = 0',
      [conversationId, userId]
    );

    const messages = messagesResult.data.map(m => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      receiverId: m.receiver_id,
      content: m.content,
      isRead: Boolean(m.is_read),
      sentViaBot: Boolean(m.sent_via_bot),
      attachments: m.attachments ? JSON.parse(m.attachments) : null,
      location: m.location ? JSON.parse(m.location) : null,
      suggestedMedia: m.suggested_media ? JSON.parse(m.suggested_media) : null,
      createdAt: m.created_at ? m.created_at + 'Z' : null,
      sender: {
        displayName: m.sender_name,
        avatarUrl: m.sender_avatar
      }
    }));

    res.json({
      messages,
      pagination: {
        total: totalMessages,
        limit,
        offset,
        hasMore: offset + messages.length < totalMessages
      }
    });

  } catch (error) {
    console.error('Ошибка получения сообщений:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/messages
 * Отправить новое сообщение
 * Body: { receiverId: string, content: string, sentViaBot: boolean }
 * Files: attachments[] (опционально, до 10 файлов, макс 50MB каждый)
 * Автоматически создает диалог, если его еще нет
 */
router.post('/', authenticateToken, uploadMessageFiles.array('attachments', 10), async (req, res) => {
  try {
    const { receiverId, content, sentViaBot, location, suggestedMedia } = req.body;
    const senderId = req.user.id;
    const files = req.files || [];

    // Валидация
    if (!receiverId) {
      return res.status(400).json({ 
        error: 'Не указан получатель',
        code: 'MISSING_RECEIVER' 
      });
    }

    // Проверяем что есть либо текст, либо файлы, либо локация, либо предложение медиа
    if ((!content || content.trim().length === 0) && files.length === 0 && !location && !suggestedMedia) {
      return res.status(400).json({ 
        error: 'Сообщение не может быть пустым',
        code: 'EMPTY_MESSAGE' 
      });
    }

    if (senderId === receiverId) {
      return res.status(400).json({ 
        error: 'Нельзя отправить сообщение самому себе',
        code: 'SELF_MESSAGE' 
      });
    }

    // Проверяем, существует ли получатель
    const receiverCheck = await executeQuery(
      'SELECT * FROM users WHERE id = ?',
      [receiverId]
    );

    if (!receiverCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки получателя',
        code: 'DATABASE_ERROR' 
      });
    }

    if (receiverCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Получатель не найден',
        code: 'RECEIVER_NOT_FOUND' 
      });
    }

    // Проверяем, существует ли диалог между пользователями
    // Диалог может быть создан в любом порядке (user1_id, user2_id)
    const conversationCheck = await executeQuery(
      `SELECT * FROM conversations 
       WHERE (user1_id = ? AND user2_id = ?) 
          OR (user1_id = ? AND user2_id = ?)`,
      [senderId, receiverId, receiverId, senderId]
    );

    if (!conversationCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки диалога',
        code: 'DATABASE_ERROR' 
      });
    }

    let conversationId;

    // Если диалога нет, создаем новый
    if (conversationCheck.data.length === 0) {
      conversationId = uuidv4();
      
      // Всегда сохраняем user1_id < user2_id для консистентности
      const [user1Id, user2Id] = [senderId, receiverId].sort();

      const createConversationResult = await executeQuery(
        `INSERT INTO conversations (id, user1_id, user2_id, last_message_at, created_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
        [conversationId, user1Id, user2Id]
      );

      if (!createConversationResult.success) {
        return res.status(500).json({ 
          error: 'Ошибка создания диалога',
          code: 'DATABASE_ERROR' 
        });
      }
    } else {
      conversationId = conversationCheck.data[0].id;
    }

    // Обрабатываем загруженные файлы
    let attachments = null;
    if (files.length > 0) {
      attachments = JSON.stringify(files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: `/uploads/messages/${file.filename}`
      })));
    }

    // Создаем сообщение
    const messageId = uuidv4();
    const locationParsed = typeof location === 'string' ? JSON.parse(location) : location;
    const locationJson = locationParsed ? JSON.stringify(locationParsed) : null;
    const suggestedMediaParsed = typeof suggestedMedia === 'string' ? JSON.parse(suggestedMedia) : suggestedMedia;
    const suggestedMediaJson = suggestedMediaParsed ? JSON.stringify(suggestedMediaParsed) : null;
    const createMessageResult = await executeQuery(
      `INSERT INTO messages (id, conversation_id, sender_id, receiver_id, content, is_read, sent_via_bot, attachments, location, suggested_media, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, datetime('now'))`,
      [messageId, conversationId, senderId, receiverId, content?.trim() || '', sentViaBot ? 1 : 0, attachments, locationJson, suggestedMediaJson]
    );

    if (!createMessageResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка создания сообщения',
        code: 'DATABASE_ERROR' 
      });
    }

    // Обновляем время последнего сообщения в диалоге
    await executeQuery(
      `UPDATE conversations SET last_message_at = datetime('now') WHERE id = ?`,
      [conversationId]
    );

    // Получаем созданное сообщение с информацией об отправителе
    const messageResult = await executeQuery(
      `SELECT 
        m.*,
        u.display_name as sender_name,
        u.avatar_url as sender_avatar
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.id = ?`,
      [messageId]
    );

    if (!messageResult.success || messageResult.data.length === 0) {
      return res.status(500).json({ 
        error: 'Ошибка получения созданного сообщения',
        code: 'DATABASE_ERROR' 
      });
    }

    const m = messageResult.data[0];

    // Формируем объект сообщения для ответа
    const messageResponse = {
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      receiverId: m.receiver_id,
      content: m.content,
      isRead: Boolean(m.is_read),
      sentViaBot: Boolean(m.sent_via_bot),
      attachments: m.attachments ? JSON.parse(m.attachments) : null,
      createdAt: m.created_at ? m.created_at + 'Z' : null,
      sender: {
        displayName: m.sender_name,
        avatarUrl: m.sender_avatar
      }
    };

    // Отправляем сообщение получателю через WebSocket
    const sentViaWebSocket = sendMessageToUser(receiverId, messageResponse);
    
    if (sentViaWebSocket) {
      console.log(`✅ Сообщение отправлено через WebSocket пользователю ${receiverId}`);
    }

    // Отправляем уведомление в Telegram получателю
    const senderResult = await executeQuery(
      'SELECT display_name FROM users WHERE id = ?',
      [senderId]
    );

    if (senderResult.success && senderResult.data.length > 0) {
      const senderName = senderResult.data[0].display_name;
      const publicUrl = process.env.PUBLIC_URL || 'http://localhost:1313';
      
      // Формируем текст уведомления в зависимости от типа контента
      let messagePreview = '';
      
      if (attachments && files.length > 0) {
        // Если есть вложения, определяем их тип
        const attachmentTypes = files.map(file => {
          const mimeType = file.mimetype;
          if (mimeType.startsWith('image/')) return 'изображение';
          if (mimeType.startsWith('video/')) return 'видео';
          if (mimeType.startsWith('audio/')) return 'аудио';
          return 'документ';
        });
        
        // Формируем текст в зависимости от количества и типа вложений
        if (files.length === 1) {
          messagePreview = `📎 Отправлено ${attachmentTypes[0]}`;
        } else {
          messagePreview = `📎 Отправлено ${files.length} файл(ов)`;
        }
        
        // Если есть текст вместе с вложениями
        if (content && content.trim().length > 0) {
          messagePreview += `\n\n${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`;
        }
        
        messagePreview += '\n\n<i>Посмотреть можно только на сайте</i>';
      } else {
        // Если только текст
        messagePreview = content.substring(0, 100) + (content.length > 100 ? '...' : '');
      }
      
      const telegramMessage = `💬 <b>Новое сообщение от ${senderName}</b>\n\n` +
                             `${messagePreview}\n\n` +
                             `<a href="${publicUrl}/messages">Открыть на сайте</a>`;
      
      // Проверяем настройки уведомлений получателя
      const isNotificationEnabled = await checkNotificationEnabled(receiverId, 'new_message');
      
      if (isNotificationEnabled) {
        // Отправляем уведомление с кнопкой "Ответить"
        sendTelegramNotification(receiverId, telegramMessage, {
          reply_markup: {
            inline_keyboard: [[
              { text: '💬 Ответить', callback_data: `reply_message_${senderId}` }
            ]]
          }
        }).catch(err => {
          console.error('Ошибка отправки Telegram уведомления:', err);
        });
      } else {
        console.log(`🔕 Уведомление о новом сообщении не отправлено пользователю ${receiverId} (отключено в настройках)`);
      }
    }

    res.status(201).json(messageResponse);

  } catch (error) {
    console.error('Ошибка отправки сообщения:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * DELETE /api/messages/conversations/:conversationId
 * Удалить весь диалог
 * query: deleteType = "for_me" | "for_everyone"
 * "for_me" — пометить все сообщения как удаленные для текущего пользователя
 * "for_everyone" — физическое удаление всех сообщений и диалога
 */
router.delete('/conversations/:conversationId', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { deleteType = 'for_me' } = req.query;
    const userId = req.user.id;

    // Проверяем, что пользователь участник диалога
    const conversationCheck = await executeQuery(
      'SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [conversationId, userId, userId]
    );

    if (!conversationCheck.success) {
      return res.status(500).json({
        error: 'Ошибка проверки диалога',
        code: 'DATABASE_ERROR'
      });
    }

    if (conversationCheck.data.length === 0) {
      return res.status(404).json({
        error: 'Диалог не найден или у вас нет доступа',
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    if (deleteType === 'for_everyone') {
      // Физическое удаление всех сообщений диалога
      await executeQuery('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
      // Удаление самого диалога
      await executeQuery('DELETE FROM conversations WHERE id = ?', [conversationId]);

      res.json({
        message: 'Диалог удален для всех',
        conversationId
      });
    } else {
      // Soft delete — помечаем все сообщения как удаленные для текущего пользователя
      const messagesResult = await executeQuery(
        'SELECT id, deleted_for_users FROM messages WHERE conversation_id = ?',
        [conversationId]
      );

      if (messagesResult.success && messagesResult.data.length > 0) {
        for (const msg of messagesResult.data) {
          let deletedForUsers = [];
          try {
            deletedForUsers = JSON.parse(msg.deleted_for_users || '[]');
          } catch (e) {
            deletedForUsers = [];
          }

          if (!deletedForUsers.includes(userId)) {
            deletedForUsers.push(userId);
            await executeQuery(
              'UPDATE messages SET deleted_for_users = ? WHERE id = ?',
              [JSON.stringify(deletedForUsers), msg.id]
            );
          }
        }
      }

      res.json({
        message: 'Диалог скрыт для вас',
        conversationId
      });
    }

  } catch (error) {
    console.error('Ошибка удаления диалога:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * DELETE /api/messages/:id
 * Удалить сообщение
 * query: deleteType = "for_me" | "for_everyone"
 * Только отправитель может удалить свое сообщение
 * Любой участник диалога может скрыть сообщение у себя
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { deleteType = 'for_me' } = req.query;
    const userId = req.user.id;

    const messageCheck = await executeQuery(
      'SELECT * FROM messages WHERE id = ?',
      [id]
    );

    if (!messageCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки сообщения',
        code: 'DATABASE_ERROR' 
      });
    }

    if (messageCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Сообщение не найдено',
        code: 'MESSAGE_NOT_FOUND' 
      });
    }

    const message = messageCheck.data[0];

    // Проверяем что пользователь участник диалога
    const isParticipant = message.sender_id === userId || message.receiver_id === userId;
    if (!isParticipant) {
      return res.status(403).json({ 
        error: 'Нет прав на удаление этого сообщения',
        code: 'FORBIDDEN' 
      });
    }

    // "У всех" — только автор может удалить
    if (deleteType === 'for_everyone' && message.sender_id !== userId) {
      return res.status(403).json({ 
        error: 'Только автор может удалить сообщение для всех',
        code: 'FORBIDDEN' 
      });
    }

    if (deleteType === 'for_everyone') {
      const deleteResult = await executeQuery(
        'DELETE FROM messages WHERE id = ?',
        [id]
      );

      if (!deleteResult.success) {
        return res.status(500).json({ 
          error: 'Ошибка удаления сообщения',
          code: 'DATABASE_ERROR' 
        });
      }

      res.json({ 
        message: 'Сообщение удалено для всех',
        messageId: id 
      });
    } else {
      // Soft delete — помечаем как удаленное для текущего пользователя
      let deletedForUsers = [];
      try {
        deletedForUsers = JSON.parse(message.deleted_for_users || '[]');
      } catch (e) {
        deletedForUsers = [];
      }

      if (!deletedForUsers.includes(userId)) {
        deletedForUsers.push(userId);
      }

      const updateResult = await executeQuery(
        'UPDATE messages SET deleted_for_users = ? WHERE id = ?',
        [JSON.stringify(deletedForUsers), id]
      );

      if (!updateResult.success) {
        return res.status(500).json({ 
          error: 'Ошибка удаления сообщения',
          code: 'DATABASE_ERROR' 
        });
      }

      res.json({ 
        message: 'Сообщение удалено для вас',
        messageId: id 
      });
    }

  } catch (error) {
    console.error('Ошибка удаления сообщения:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

export default router;
