import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendTelegramNotification } from '../services/notificationService.js';

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

    const conversations = conversationsResult.data.map(c => ({
      id: c.id,
      otherUser: {
        id: c.other_user_id,
        displayName: c.other_user_name,
        avatarUrl: c.other_user_avatar
      },
      lastMessage: c.last_message_content,
      unreadCount: c.unread_count || 0,
      lastMessageAt: c.last_message_at,
      createdAt: c.created_at
    }));

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
 * Сообщения отсортированы по дате создания (старые сверху)
 * Автоматически отмечает непрочитанные сообщения как прочитанные
 */
router.get('/:conversationId', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

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

    // Получаем все сообщения из диалога
    const messagesQuery = `
      SELECT 
        m.*,
        u.display_name as sender_name,
        u.avatar_url as sender_avatar
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC
    `;

    const messagesResult = await executeQuery(messagesQuery, [conversationId]);

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
      createdAt: m.created_at,
      sender: {
        displayName: m.sender_name,
        avatarUrl: m.sender_avatar
      }
    }));

    res.json(messages);

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
 * Body: { receiverId: string, content: string }
 * Автоматически создает диалог, если его еще нет
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    const senderId = req.user.id;

    // Валидация
    if (!receiverId || !content) {
      return res.status(400).json({ 
        error: 'Не указан получатель или содержимое сообщения',
        code: 'MISSING_FIELDS' 
      });
    }

    if (content.trim().length === 0) {
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

    // Создаем сообщение
    const messageId = uuidv4();
    const createMessageResult = await executeQuery(
      `INSERT INTO messages (id, conversation_id, sender_id, receiver_id, content, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`,
      [messageId, conversationId, senderId, receiverId, content.trim()]
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

    // Отправляем уведомление в Telegram получателю
    const senderResult = await executeQuery(
      'SELECT display_name FROM users WHERE id = ?',
      [senderId]
    );

    if (senderResult.success && senderResult.data.length > 0) {
      const senderName = senderResult.data[0].display_name;
      const publicUrl = process.env.PUBLIC_URL || 'http://localhost:1313';
      
      const telegramMessage = `💬 <b>Новое сообщение от ${senderName}</b>\n\n` +
                             `${content.substring(0, 100)}${content.length > 100 ? '...' : ''}\n\n` +
                             `<a href="${publicUrl}/messages">Открыть на сайте</a>`;
      
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
    }

    res.status(201).json({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      receiverId: m.receiver_id,
      content: m.content,
      isRead: Boolean(m.is_read),
      createdAt: m.created_at,
      sender: {
        displayName: m.sender_name,
        avatarUrl: m.sender_avatar
      }
    });

  } catch (error) {
    console.error('Ошибка отправки сообщения:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * DELETE /api/messages/:id
 * Удалить сообщение
 * Только отправитель может удалить свое сообщение
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Проверяем, существует ли сообщение и является ли пользователь отправителем
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

    if (message.sender_id !== userId) {
      return res.status(403).json({ 
        error: 'Нет прав на удаление этого сообщения',
        code: 'FORBIDDEN' 
      });
    }

    // Удаляем сообщение
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
      message: 'Сообщение успешно удалено',
      messageId: id 
    });

  } catch (error) {
    console.error('Ошибка удаления сообщения:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

export default router;
