import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendTelegramNotification, checkNotificationEnabled, createNotification } from '../services/notificationService.js';
import { sendMessageToUser } from '../services/websocketService.js';
import { uploadMessageFiles, uploadAvatar } from '../middleware/upload.js';

const router = express.Router();

/**
 * GET /api/messages/unread-count
 * Получить суммарное количество непрочитанных сообщений
 */
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Личные и секретные диалоги: непрочитанные
    // Для обычных чатов: receiver_id = userId
    // Для секретных чатов: sender_id != userId (receiver_id = sender_id по архитектуре)
    const directResult = await executeQuery(
      `SELECT COUNT(*) as cnt FROM messages
       WHERE sender_id != ? AND is_read = 0
       AND conversation_id IN (
         SELECT id FROM conversations WHERE (is_group IS NULL OR is_group = 0)
       )`,
      [userId]
    );

    // Групповые диалоги: непрочитанные где sender_id != userId
    const groupResult = await executeQuery(
      `SELECT COUNT(*) as cnt FROM messages 
       WHERE conversation_id IN (
         SELECT cm.conversation_id FROM conversation_members cm 
         WHERE cm.user_id = ? AND cm.left_at IS NULL
       ) AND sender_id != ? AND is_read = 0
       AND conversation_id IN (
         SELECT id FROM conversations WHERE is_group = 1
       )`,
      [userId, userId]
    );

    const directCount = directResult.success ? directResult.data[0].cnt : 0;
    const groupCount = groupResult.success ? groupResult.data[0].cnt : 0;

    res.json({ count: directCount + groupCount });

  } catch (error) {
    console.error('Ошибка получения unread-count:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/messages/conversations
 * Получить список всех диалогов текущего пользователя
 * Диалоги отсортированы по дате последнего сообщения (новые сверху)
 */
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Обычные диалоги (не групповые)
    // 1. Личные диалоги (не групповые)
    const directQuery = `
      SELECT
        c.id, c.user1_id, c.user2_id, c.is_group, c.is_secret, c.group_name,
        c.group_avatar, c.created_by, c.last_message_at, c.created_at,
        CASE WHEN c.user1_id = ? THEN u2.id ELSE u1.id END as other_user_id,
        CASE WHEN c.user1_id = ? THEN u2.display_name ELSE u1.display_name END as other_user_name,
        CASE WHEN c.user1_id = ? THEN u2.avatar_url ELSE u1.avatar_url END as other_user_avatar,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_content,
        (SELECT attachments FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_attachments
      FROM conversations c
      LEFT JOIN users u1 ON c.user1_id = u1.id
      LEFT JOIN users u2 ON c.user2_id = u2.id
      WHERE (c.user1_id = ? OR c.user2_id = ?) AND (c.is_group IS NULL OR c.is_group = 0)
      ORDER BY c.last_message_at DESC
    `;
    const directResult = await executeQuery(directQuery, [userId, userId, userId, userId, userId]);

    if (!directResult.success) {
      console.error('Ошибка запроса личных диалогов:', directResult.error);
    } else {
      console.log('Личные диалоги:', directResult.data?.length ?? 'data undefined');
    }

    // Добавляем unread_count отдельным запросом для личных диалогов
    const directConvs = (directResult.success && Array.isArray(directResult.data)) ? directResult.data : [];
    for (const conv of directConvs) {
      const unreadResult = await executeQuery(
        'SELECT COUNT(*) as cnt FROM messages WHERE conversation_id = ? AND sender_id != ? AND is_read = 0',
        [conv.id, userId]
      );
      conv.unread_count = (unreadResult.success && unreadResult.data.length > 0) ? unreadResult.data[0].cnt : 0;
    }

    // 2. Групповые диалоги
    const groupQuery = `
      SELECT c.id, c.is_group, c.is_secret, c.group_name, c.group_avatar, c.created_by,
             c.show_creator_label, c.show_moderator_label,
             c.last_message_at, c.created_at,
             (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_content,
             (SELECT attachments FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_attachments
      FROM conversations c
      INNER JOIN conversation_members cm ON c.id = cm.conversation_id
      WHERE cm.user_id = ? AND cm.left_at IS NULL AND c.is_group = 1
      ORDER BY c.last_message_at DESC
    `;
    const groupResult = await executeQuery(groupQuery, [userId]);

    if (!groupResult.success) {
      console.error('Ошибка запроса групповых диалогов:', groupResult.error);
    }

    // Добавляем unread_count и members_count для групп
    const groupConvs = (groupResult.success && Array.isArray(groupResult.data)) ? groupResult.data : [];
    for (const conv of groupConvs) {
      const unreadResult = await executeQuery(
        'SELECT COUNT(*) as cnt FROM messages WHERE conversation_id = ? AND sender_id != ? AND is_read = 0',
        [conv.id, userId]
      );
      conv.unread_count = (unreadResult.success && unreadResult.data.length > 0) ? unreadResult.data[0].cnt : 0;

      const membersResult = await executeQuery(
        'SELECT COUNT(*) as cnt FROM conversation_members WHERE conversation_id = ? AND left_at IS NULL',
        [conv.id]
      );
      conv.members_count = (membersResult.success && membersResult.data.length > 0) ? membersResult.data[0].cnt : 0;
    }

    // Объединяем и сортируем
    const allConversations = [...directConvs, ...groupConvs];
    allConversations.sort((a, b) => {
      const dateA = a.last_message_at ? new Date(a.last_message_at) : new Date(0);
      const dateB = b.last_message_at ? new Date(b.last_message_at) : new Date(0);
      return dateB - dateA;
    });

    const conversationsResult = { success: true, data: allConversations };

    if (!conversationsResult.success) {
      return res.status(500).json({
        error: 'Ошибка получения диалогов',
        code: 'DATABASE_ERROR'
      });
    }

    // Получаем ID диалогов, где ВСЕ сообщения скрыты для текущего пользователя
    const hiddenConvIds = [];
    for (const conv of conversationsResult.data) {
      const lastMsgResult = await executeQuery(
        'SELECT deleted_for_users FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1',
        [conv.id]
      );
      if (lastMsgResult.success && lastMsgResult.data.length > 0) {
        const deletedFor = lastMsgResult.data[0].deleted_for_users;
        if (deletedFor) {
          try {
            const arr = JSON.parse(deletedFor);
            if (arr.includes(userId)) {
              hiddenConvIds.push(conv.id);
            }
          } catch (e) { /* ignore */ }
        }
      }
    }

    const conversations = conversationsResult.data.filter(c => !hiddenConvIds.includes(c.id)).map(c => {
      // Формируем текст последнего сообщения
      const isSecret = Boolean(c.is_secret);
      let lastMessage = c.last_message_content;

      // Если есть вложения, показываем информацию о них
      if (c.last_message_attachments) {
        try {
          const attachments = JSON.parse(c.last_message_attachments);
          if (attachments && attachments.length > 0) {
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

            if (c.last_message_content && c.last_message_content.trim().length > 0) {
              lastMessage += `: ${c.last_message_content}`;
            }
          }
        } catch (e) {
          console.error('Ошибка парсинга attachments:', e);
        }
      }

      // Для секретных чатов — всегда показываем "Зашифрованное сообщение"
      if (isSecret && lastMessage) {
        lastMessage = '🔒 Зашифрованное сообщение';
      }

      const isGroup = Boolean(c.is_group);

      return {
        id: c.id,
        isGroup,
        isSecret,
        ...(isGroup ? {
          groupName: c.group_name,
          groupAvatar: c.group_avatar,
          createdBy: c.created_by,
          showCreatorLabel: c.show_creator_label !== 0,
          showModeratorLabel: c.show_moderator_label !== 0,
          membersCount: c.members_count || 0
        } : {
          otherUser: {
            id: c.other_user_id,
            displayName: c.other_user_name,
            avatarUrl: c.other_user_avatar
          }
        }),
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
 * GET /api/messages/pinned/:conversationId
 * Получить закреплённое сообщение в чате
 */
router.get('/pinned/:conversationId', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Проверяем доступ
    const convCheck = await executeQuery(
      'SELECT * FROM conversations WHERE id = ?',
      [conversationId]
    );

    if (!convCheck.success || convCheck.data.length === 0) {
      return res.status(404).json({ error: 'Чат не найден', code: 'CONVERSATION_NOT_FOUND' });
    }

    const conv = convCheck.data[0];
    let isParticipant = false;

    if (conv.is_group) {
      const memberCheck = await executeQuery(
        'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL',
        [conversationId, userId]
      );
      isParticipant = memberCheck.success && memberCheck.data.length > 0;
    } else {
      isParticipant = conv.user1_id === userId || conv.user2_id === userId;
    }

    if (!isParticipant) {
      return res.status(403).json({ error: 'Нет доступа', code: 'FORBIDDEN' });
    }

    const pinnedResult = await executeQuery(
      `SELECT m.*, u.display_name as sender_name, u.avatar_url as sender_avatar
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = ? AND m.is_pinned = 1
       LIMIT 1`,
      [conversationId]
    );

    if (!pinnedResult.success || pinnedResult.data.length === 0) {
      return res.json({ pinnedMessage: null });
    }

    const m = pinnedResult.data[0];
    res.json({
      pinnedMessage: {
        id: m.id,
        conversationId: m.conversation_id,
        senderId: m.sender_id,
        content: m.content,
        createdAt: m.created_at ? m.created_at + 'Z' : null,
        sender: {
          displayName: m.sender_name,
          avatarUrl: m.sender_avatar
        }
      }
    });

  } catch (error) {
    console.error('Ошибка получения закреплённого сообщения:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
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
      'SELECT * FROM conversations WHERE id = ?',
      [conversationId]
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

    const conv = conversationCheck.data[0];
    const isGroup = Boolean(conv.is_group);
    const isSecret = Boolean(conv.is_secret);

    // Проверка доступа
    if (isGroup) {
      const memberCheck = await executeQuery(
        'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL',
        [conversationId, userId]
      );
      if (!memberCheck.success || memberCheck.data.length === 0) {
        return res.status(403).json({ error: 'Нет доступа к этому чату', code: 'FORBIDDEN' });
      }
    } else {
      if (conv.user1_id !== userId && conv.user2_id !== userId) {
        return res.status(403).json({ error: 'Нет доступа', code: 'FORBIDDEN' });
      }
    }

    // Для секретных групп — получаем время вступления пользователя
    let joinedAt = null;
    if (isGroup && isSecret) {
      const joinResult = await executeQuery(
        'SELECT joined_at FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
        [conversationId, userId]
      );
      if (joinResult.success && joinResult.data.length > 0) {
        joinedAt = joinResult.data[0].joined_at;
      }
    }

    // Получаем общее количество сообщений
    let countQuery = `SELECT COUNT(*) as total FROM messages WHERE conversation_id = ?`;
    const countParams = [conversationId];

    // Для секретных групп — только сообщения после вступления
    if (joinedAt) {
      countQuery += ` AND created_at >= ?`;
      countParams.push(joinedAt);
    }

    const countResult = await executeQuery(countQuery, countParams);
    const totalMessages = countResult.success ? countResult.data[0].total : 0;

    // Получаем сообщения с пагинацией
    let messagesQuery = `
      SELECT * FROM (
        SELECT
          m.*,
          u.display_name as sender_name,
          u.avatar_url as sender_avatar,
          reply_msg.content as reply_to_content,
          reply_sender.display_name as reply_to_sender_name,
          reply_sender.id as reply_to_sender_id,
          fwd_sender.display_name as forward_from_name,
          fwd_sender.avatar_url as forward_from_avatar,
          (SELECT json_group_array(
            json_object('emoji', mr.emoji, 'userId', mr.user_id, 'createdAt', mr.created_at,
              'displayName', ru.display_name, 'avatarUrl', ru.avatar_url)
          ) FROM message_reactions mr LEFT JOIN users ru ON mr.user_id = ru.id WHERE mr.message_id = m.id) as reactions_json
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        LEFT JOIN messages reply_msg ON m.reply_to = reply_msg.id
        LEFT JOIN users reply_sender ON reply_msg.sender_id = reply_sender.id
        LEFT JOIN users fwd_sender ON m.forward_from = fwd_sender.id
        WHERE m.conversation_id = ?
          AND (m.deleted_for_users IS NULL OR m.deleted_for_users = '[]' OR NOT m.deleted_for_users LIKE '%"${userId}"%')
    `;
    const messagesParams = [conversationId];

    // Для секретных групп — только сообщения после вступления
    if (joinedAt) {
      messagesQuery += ` AND m.created_at >= ?`;
      messagesParams.push(joinedAt);
    }

    messagesQuery += `
        ORDER BY m.created_at DESC
        LIMIT ? OFFSET ?
      ) ORDER BY created_at ASC
    `;
    messagesParams.push(limit, offset);

    const messagesResult = await executeQuery(messagesQuery, messagesParams);

    if (!messagesResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения сообщений',
        code: 'DATABASE_ERROR' 
      });
    }

    // Отмечаем все непрочитанные сообщения как прочитанные
    // Для групповых и секретных чатов — помечаем чужие сообщения как прочитанные
    // Для обычных чатов — помечаем сообщения где receiver_id = userId
    if (isGroup || isSecret) {
      await executeQuery(
        'UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ? AND is_read = 0',
        [conversationId, userId]
      );
    } else {
      await executeQuery(
        'UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND receiver_id = ? AND is_read = 0',
        [conversationId, userId]
      );
    }

    const messages = messagesResult.data.map(m => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      receiverId: m.receiver_id,
      content: m.content,
      isRead: Boolean(m.is_read),
      sentViaBot: Boolean(m.sent_via_bot),
      isAnnouncement: Boolean(m.is_announcement),
      attachments: m.attachments ? JSON.parse(m.attachments) : null,
      location: m.location ? JSON.parse(m.location) : null,
      suggestedMedia: m.suggested_media ? JSON.parse(m.suggested_media) : null,
      createdAt: m.created_at ? m.created_at + 'Z' : null,
      isPinned: Boolean(m.is_pinned),
      replyTo: m.reply_to ? {
        id: m.reply_to,
        content: m.reply_to_content,
        senderName: m.reply_to_sender_name,
        senderId: m.reply_to_sender_id
      } : null,
      forwardFrom: m.forward_from ? {
        id: m.forward_from,
        displayName: m.forward_from_name,
        avatarUrl: m.forward_from_avatar
      } : null,
      forwardMessageId: m.forward_message_id || null,
      reactions: m.reactions_json ? JSON.parse(m.reactions_json).map(r => ({
        emoji: r.emoji,
        userId: r.userId,
        createdAt: r.createdAt ? r.createdAt + 'Z' : null,
        user: { displayName: r.displayName, avatarUrl: r.avatarUrl }
      })) : [],
      sender: {
        displayName: m.sender_name,
        avatarUrl: m.sender_avatar
      }
    }));

    const responseData = {
      messages,
      pagination: {
        total: totalMessages,
        limit,
        offset,
        hasMore: offset + messages.length < totalMessages
      }
    };

    // Для групповых чатов добавляем информацию о группе и правах текущего пользователя
    if (isGroup) {
      const isCreator = conv.created_by === userId;
      let canDeleteMessages = isCreator;
      let canDeleteAnnouncements = isCreator;
      let canSendAnnouncements = isCreator;

      if (!isCreator) {
        const modCheck = await executeQuery(
          `SELECT gmp.permission_type FROM group_moderators gm
           JOIN group_moderator_permissions gmp ON gm.id = gmp.moderator_id
           WHERE gm.conversation_id = ? AND gm.user_id = ?`,
          [conversationId, userId]
        );
        if (modCheck.success) {
          const perms = modCheck.data.map(p => p.permission_type);
          canDeleteMessages = perms.includes('manage_messages');
          canDeleteAnnouncements = perms.includes('delete_announcements');
          canSendAnnouncements = perms.includes('send_announcements');
        }
      }

      responseData.group = {
        id: conv.id,
        groupName: conv.group_name,
        groupAvatar: conv.group_avatar,
        createdBy: conv.created_by,
        canDeleteMessages,
        canDeleteAnnouncements,
        canSendAnnouncements
      };
    }

    res.json(responseData);

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
    const { receiverId, content, sentViaBot, location, suggestedMedia, replyTo, forwardFrom, forwardMessageId } = req.body;
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

    // Проверяем, является ли это групповым или секретным чатом
    const groupCheck = await executeQuery(
      'SELECT * FROM conversations WHERE id = ? AND is_group = 1',
      [receiverId]
    );

    const secretCheck = await executeQuery(
      'SELECT * FROM conversations WHERE id = ? AND is_secret = 1',
      [receiverId]
    );

    let conversationId;
    let isGroup = false;
    let isSecret = false;
    let groupMembers = [];

    if (groupCheck.success && groupCheck.data.length > 0) {
      // Групповой чат (проверяем также является ли секретным)
      isGroup = true;
      isSecret = Boolean(groupCheck.data[0].is_secret);
      conversationId = receiverId;

      // Проверяем что отправитель — участник группы
      const memberCheck = await executeQuery(
        'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL',
        [conversationId, senderId]
      );
      if (!memberCheck.success || memberCheck.data.length === 0) {
        return res.status(403).json({ error: 'Нет доступа к этому чату', code: 'FORBIDDEN' });
      }

      // Получаем всех участников кроме отправителя
      const membersResult = await executeQuery(
        'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ? AND left_at IS NULL',
        [conversationId, senderId]
      );
      groupMembers = membersResult.success ? membersResult.data.map(m => m.user_id) : [];

    } else if (secretCheck.success && secretCheck.data.length > 0) {
      // Секретный чат
      isSecret = true;
      conversationId = receiverId;

      // Проверяем что отправитель — участник секретного чата
      const conv = secretCheck.data[0];
      if (conv.user1_id !== senderId && conv.user2_id !== senderId) {
        return res.status(403).json({ error: 'Нет доступа к этому секретному чату', code: 'FORBIDDEN' });
      }

      // Получаем ID получателя
      const receiverUserId = conv.user1_id === senderId ? conv.user2_id : conv.user1_id;
      groupMembers = [receiverUserId];

    } else {
      // Обычный диалог (1-на-1)
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

      if (conversationCheck.data.length === 0) {
        conversationId = uuidv4();
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
        isSecret = Boolean(conversationCheck.data[0].is_secret);
      }
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

    // Для групповых и секретных чатов receiver_id = sender_id (реальный получатель определяется через conversation)
    const messageReceiverId = (isGroup || isSecret) ? senderId : receiverId;

    const createMessageResult = await executeQuery(
      `INSERT INTO messages (id, conversation_id, sender_id, receiver_id, content, is_read, sent_via_bot, attachments, location, suggested_media, reply_to, forward_from, forward_message_id, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [messageId, conversationId, senderId, messageReceiverId, content?.trim() || '', sentViaBot ? 1 : 0, attachments, locationJson, suggestedMediaJson, replyTo || null, forwardFrom || null, forwardMessageId || null]
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
      isAnnouncement: false,
      attachments: m.attachments ? JSON.parse(m.attachments) : null,
      location: m.location ? JSON.parse(m.location) : null,
      suggestedMedia: m.suggested_media ? JSON.parse(m.suggested_media) : null,
      createdAt: m.created_at ? m.created_at + 'Z' : null,
      replyTo: m.reply_to || null,
      forwardFrom: m.forward_from || null,
      forwardMessageId: m.forward_message_id || null,
      sender: {
        displayName: m.sender_name,
        avatarUrl: m.sender_avatar
      }
    };

    // Отправляем сообщение через WebSocket
    if (isGroup || isSecret) {
      // Для групповых и секретных чатов — отправляем всем участникам кроме отправителя
      for (const memberId of groupMembers) {
        const sent = sendMessageToUser(memberId, messageResponse);
        if (sent) {
          console.log(`✅ Сообщение отправлено через WebSocket пользователю ${memberId}`);
        }
      }
    } else {
      const sentViaWebSocket = sendMessageToUser(receiverId, messageResponse);
      if (sentViaWebSocket) {
        console.log(`✅ Сообщение отправлено через WebSocket пользователю ${receiverId}`);
      }
    }

    // Отправляем уведомления в Telegram
    const senderResult = await executeQuery(
      'SELECT display_name FROM users WHERE id = ?',
      [senderId]
    );

    if (senderResult.success && senderResult.data.length > 0) {
      const senderName = senderResult.data[0].display_name;
      const publicUrl = process.env.PUBLIC_URL || 'http://localhost:1313';

      let messagePreview = '';

      // Для секретных чатов — не показываем текст сообщения
      if (isSecret) {
        messagePreview = '🔒 Зашифрованное сообщение';
      } else {

      // Форматируем упоминания для Telegram: @[Name](id) → <a href="t.me/...">Name</a>
      const formatMentionsForTelegram = (text) => {
        if (!text) return text;
        const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
        return text.replace(mentionRegex, (match, name, id) => {
          return `<a href="${publicUrl}/user/${id}">@${name}</a>`;
        });
      };

      if (attachments && files.length > 0) {
        const attachmentTypes = files.map(file => {
          const mimeType = file.mimetype;
          if (mimeType.startsWith('image/')) return 'изображение';
          if (mimeType.startsWith('video/')) return 'видео';
          if (mimeType.startsWith('audio/')) return 'аудио';
          return 'документ';
        });

        if (files.length === 1) {
          messagePreview = `📎 Отправлено ${attachmentTypes[0]}`;
        } else {
          messagePreview = `📎 Отправлено ${files.length} файл(ов)`;
        }

        if (content && content.trim().length > 0) {
          messagePreview += `\n\n${formatMentionsForTelegram(content.substring(0, 50))}${content.length > 50 ? '...' : ''}`;
        }

        messagePreview += '\n\n<i>Посмотреть можно только на сайте</i>';
      } else {
        messagePreview = formatMentionsForTelegram(content.substring(0, 100) + (content.length > 100 ? '...' : ''));
      }
      } // конец else для isSecret

      // Получатели уведомлений: для групп/секретных — все участники кроме отправителя, для личных — получатель
      const notificationTargets = (isGroup || isSecret) ? groupMembers : [receiverId];

      for (const targetId of notificationTargets) {
        let telegramMessage;
        if (isGroup) {
          const groupName = groupCheck.data[0].group_name;
          telegramMessage = `💬 <b>${senderName} в группе "${groupName}"</b>\n\n` +
                           `${messagePreview}\n\n` +
                           `<a href="${publicUrl}/messages">Открыть на сайте</a>`;
        } else {
          telegramMessage = `💬 <b>Новое сообщение от ${senderName}</b>\n\n` +
                           `${messagePreview}\n\n` +
                           `<a href="${publicUrl}/messages">Открыть на сайте</a>`;
        }

        const isNotificationEnabled = await checkNotificationEnabled(targetId, 'new_message');

        if (isNotificationEnabled) {
          const replyCallbackData = isGroup
            ? `reply_group_${conversationId}`
            : `reply_message_${senderId}`;

          // Для секретных чатов не показываем кнопку "Ответить" (нельзя ответить из Telegram на зашифрованное сообщение)
          const telegramOptions = isSecret ? {} : {
            reply_markup: {
              inline_keyboard: [[
                { text: '💬 Ответить', callback_data: replyCallbackData }
              ]]
            }
          };

          sendTelegramNotification(targetId, telegramMessage, telegramOptions).catch(err => {
            console.error('Ошибка отправки Telegram уведомления:', err);
          });
        }
      }
    }

    // Уведомления об упоминаниях в сообщениях (групповые чаты)
    if (isGroup && content) {
      const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
      let mentionMatch;
      const mentionedUserIds = new Set();
      while ((mentionMatch = mentionRegex.exec(content)) !== null) {
        const mentionedId = mentionMatch[2];
        if (mentionedId !== senderId) {
          mentionedUserIds.add(mentionedId);
        }
      }

      if (mentionedUserIds.size > 0) {
        const groupName = groupCheck.data[0].group_name;

        for (const mentionedId of mentionedUserIds) {
          createNotification(mentionedId, 'group_mention', `упомянул вас в чате "${groupName}"`, senderId, conversationId).catch(err => {
            console.error('Ошибка уведомления об упоминании в чате:', err);
          });
        }
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
 * POST /api/messages/announcement
 * Отправить объявление в групповой чат
 * Body: { conversationId: string, content: string }
 * Files: images[] (опционально, до 5 файлов)
 * Только создатель или модератор с правом send_announcements
 */
router.post('/announcement', authenticateToken, uploadMessageFiles.array('images', 5), async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    const senderId = req.user.id;
    const files = req.files || [];

    if (!conversationId) {
      return res.status(400).json({ error: 'Не указан conversationId', code: 'MISSING_CONVERSATION' });
    }

    if ((!content || content.trim().length === 0) && files.length === 0) {
      return res.status(400).json({ error: 'Объявление не может быть пустым', code: 'EMPTY_MESSAGE' });
    }

    // Проверяем что это групповой чат
    const convCheck = await executeQuery(
      'SELECT * FROM conversations WHERE id = ? AND is_group = 1',
      [conversationId]
    );
    if (!convCheck.success || convCheck.data.length === 0) {
      return res.status(404).json({ error: 'Групповой чат не найден', code: 'NOT_FOUND' });
    }

    const conv = convCheck.data[0];
    const isCreator = conv.created_by === senderId;

    // Проверяем права: создатель ИЛИ модератор с send_announcements
    let hasPermission = isCreator;
    if (!isCreator) {
      const modCheck = await executeQuery(
        `SELECT gm.id FROM group_moderators gm
         JOIN group_moderator_permissions gmp ON gm.id = gmp.moderator_id
         WHERE gm.conversation_id = ? AND gm.user_id = ? AND gmp.permission_type = 'send_announcements'`,
        [conversationId, senderId]
      );
      hasPermission = modCheck.success && modCheck.data.length > 0;
    }

    if (!hasPermission) {
      return res.status(403).json({ error: 'Нет прав на отправку объявлений', code: 'FORBIDDEN' });
    }

    // Проверяем что отправитель участник группы
    const memberCheck = await executeQuery(
      'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL',
      [conversationId, senderId]
    );
    if (!memberCheck.success || memberCheck.data.length === 0) {
      return res.status(403).json({ error: 'Нет доступа к этому чату', code: 'FORBIDDEN' });
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

    // Создаём сообщение-объявление
    const messageId = uuidv4();
    const messageReceiverId = senderId; // Для групп receiver_id = sender_id

    const createResult = await executeQuery(
      `INSERT INTO messages (id, conversation_id, sender_id, receiver_id, content, is_read, is_announcement, attachments, created_at)
       VALUES (?, ?, ?, ?, ?, 0, 1, ?, datetime('now'))`,
      [messageId, conversationId, senderId, messageReceiverId, content?.trim() || '', attachments]
    );

    if (!createResult.success) {
      return res.status(500).json({ error: 'Ошибка создания объявления', code: 'DATABASE_ERROR' });
    }

    // Обновляем время последнего сообщения
    await executeQuery(
      `UPDATE conversations SET last_message_at = datetime('now') WHERE id = ?`,
      [conversationId]
    );

    // Получаем созданное сообщение с информацией об отправителе
    const messageResult = await executeQuery(
      `SELECT m.*, u.display_name as sender_name, u.avatar_url as sender_avatar
       FROM messages m LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.id = ?`,
      [messageId]
    );

    if (!messageResult.success || messageResult.data.length === 0) {
      return res.status(500).json({ error: 'Ошибка получения объявления', code: 'DATABASE_ERROR' });
    }

    const m = messageResult.data[0];
    const messageResponse = {
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      receiverId: m.receiver_id,
      content: m.content,
      isRead: Boolean(m.is_read),
      isAnnouncement: Boolean(m.is_announcement),
      sentViaBot: Boolean(m.sent_via_bot),
      attachments: m.attachments ? JSON.parse(m.attachments) : null,
      createdAt: m.created_at ? m.created_at + 'Z' : null,
      sender: {
        displayName: m.sender_name,
        avatarUrl: m.sender_avatar
      }
    };

    // Отправляем через WebSocket всем участникам группы
    const membersResult = await executeQuery(
      'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ? AND left_at IS NULL',
      [conversationId, senderId]
    );
    const groupMembers = membersResult.success ? membersResult.data.map(m => m.user_id) : [];

    for (const memberId of groupMembers) {
      sendMessageToUser(memberId, messageResponse);
    }

    // Отправляем уведомления об объявлении
    const senderResult = await executeQuery(
      'SELECT display_name FROM users WHERE id = ?',
      [senderId]
    );
    if (senderResult.success && senderResult.data.length > 0) {
      const senderName = senderResult.data[0].display_name;
      const groupName = conv.group_name;
      const publicUrl = process.env.PUBLIC_URL || 'http://localhost:1313';
      const chatLink = `${publicUrl}/messages?conversation=${conversationId}`;

      for (const memberId of groupMembers) {
        // Уведомление на сайт
        createNotification(memberId, 'group_announcement', `объявление в "${groupName}"`, senderId, conversationId).catch(err => {
          console.error('Ошибка уведомления об объявлении:', err);
        });

        // Telegram уведомление
        const isNotifEnabled = await checkNotificationEnabled(memberId, 'new_message');
        if (isNotifEnabled) {
          const tgMessage = `📢 <b>Объявление от ${senderName} в "${groupName}"</b>\n\n` +
            `${content?.trim() || 'Нет текста'}\n\n` +
            `<a href="${chatLink}">Открыть чат</a>`;
          sendTelegramNotification(memberId, tgMessage).catch(err => {
            console.error('Ошибка Telegram уведомления об объявлении:', err);
          });
        }
      }
    }

    res.status(201).json(messageResponse);

  } catch (error) {
    console.error('Ошибка отправки объявления:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

/**
 * DELETE /api/messages/announcement/:messageId
 * Удалить объявление из группового чата
 * Только автор объявления ИЛИ модератор с delete_announcements
 */
router.delete('/announcement/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // Находим сообщение
    const msgCheck = await executeQuery(
      'SELECT * FROM messages WHERE id = ? AND is_announcement = 1',
      [messageId]
    );
    if (!msgCheck.success || msgCheck.data.length === 0) {
      return res.status(404).json({ error: 'Объявление не найдено', code: 'NOT_FOUND' });
    }

    const message = msgCheck.data[0];
    const conversationId = message.conversation_id;

    // Проверяем права: автор ИЛИ модератор с delete_announcements
    const isAuthor = message.sender_id === userId;
    let hasPermission = isAuthor;

    if (!isAuthor) {
      // Проверяем является ли пользователь создателем группы
      const convCheck = await executeQuery(
        'SELECT created_by FROM conversations WHERE id = ?',
        [conversationId]
      );
      const isCreator = convCheck.success && convCheck.data.length > 0 && convCheck.data[0].created_by === userId;

      if (isCreator) {
        hasPermission = true;
      } else {
        const modCheck = await executeQuery(
          `SELECT gm.id FROM group_moderators gm
           JOIN group_moderator_permissions gmp ON gm.id = gmp.moderator_id
           WHERE gm.conversation_id = ? AND gm.user_id = ? AND gmp.permission_type = 'delete_announcements'`,
          [conversationId, userId]
        );
        hasPermission = modCheck.success && modCheck.data.length > 0;
      }
    }

    if (!hasPermission) {
      return res.status(403).json({ error: 'Нет прав на удаление объявлений', code: 'FORBIDDEN' });
    }

    // Удаляем сообщение
    await executeQuery('DELETE FROM messages WHERE id = ?', [messageId]);

    // Уведомляем участников через WebSocket
    const membersResult = await executeQuery(
      'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ? AND left_at IS NULL',
      [conversationId, userId]
    );
    if (membersResult.success) {
      for (const member of membersResult.data) {
        sendMessageToUser(member.user_id, {
          type: 'announcement_deleted',
          messageId,
          conversationId
        });
      }
    }

    res.json({ message: 'Объявление удалено', messageId });

  } catch (error) {
    console.error('Ошибка удаления объявления:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
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

    // Проверяем, что пользователь участник диалога (личного или группового)
    let conversationCheck = await executeQuery(
      'SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [conversationId, userId, userId]
    );

    // Если не найден как личный чат, проверяем как участник группы
    if (!conversationCheck.success || conversationCheck.data.length === 0) {
      conversationCheck = await executeQuery(
        `SELECT c.* FROM conversations c
         INNER JOIN conversation_members cm ON c.id = cm.conversation_id
         WHERE c.id = ? AND cm.user_id = ? AND cm.left_at IS NULL`,
        [conversationId, userId]
      );
    }

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
      // Проверяем является ли диалог секретным
      const isSecret = Boolean(conversationCheck.data[0].is_secret);

      // Получаем ID второго участника для уведомления
      const otherUserId = conversationCheck.data[0].user1_id === userId
        ? conversationCheck.data[0].user2_id
        : conversationCheck.data[0].user1_id;

      // Физическое удаление всех сообщений диалога
      await executeQuery('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
      // Удаление самого диалога
      await executeQuery('DELETE FROM conversations WHERE id = ?', [conversationId]);

      // Уведомляем второго участника через WebSocket (для секретных чатов)
      if (isSecret) {
        const { sendSecretChatDeletedNotification } = await import('../services/websocketService.js');
        sendSecretChatDeletedNotification(otherUserId, conversationId);
      }

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

/**
 * PUT /api/messages/:id/pin
 * Закрепить/открепить сообщение (toggle)
 * Любой участник чата может закрепить любое сообщение
 */
router.put('/:id/pin', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const messageCheck = await executeQuery(
      'SELECT * FROM messages WHERE id = ?',
      [id]
    );

    if (!messageCheck.success || messageCheck.data.length === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено', code: 'MESSAGE_NOT_FOUND' });
    }

    const message = messageCheck.data[0];

    // Проверяем что пользователь — участник чата
    const convCheck = await executeQuery(
      'SELECT * FROM conversations WHERE id = ?',
      [message.conversation_id]
    );

    if (!convCheck.success || convCheck.data.length === 0) {
      return res.status(404).json({ error: 'Чат не найден', code: 'CONVERSATION_NOT_FOUND' });
    }

    const conv = convCheck.data[0];
    let isParticipant = false;

    if (conv.is_group) {
      const memberCheck = await executeQuery(
        'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL',
        [message.conversation_id, userId]
      );
      isParticipant = memberCheck.success && memberCheck.data.length > 0;
    } else {
      isParticipant = conv.user1_id === userId || conv.user2_id === userId;
    }

    if (!isParticipant) {
      return res.status(403).json({ error: 'Нет доступа к этому чату', code: 'FORBIDDEN' });
    }

    // Toggle pin
    const newPinnedState = message.is_pinned ? 0 : 1;

    // Если закрепляем — сначала снимаем старое закрепление
    if (newPinnedState === 1) {
      await executeQuery(
        'UPDATE messages SET is_pinned = 0 WHERE conversation_id = ? AND is_pinned = 1',
        [message.conversation_id]
      );
    }

    await executeQuery(
      'UPDATE messages SET is_pinned = ? WHERE id = ?',
      [newPinnedState, id]
    );

    // Уведомляем участников через WebSocket
    const wsManager = req.app.get('wsManager');
    if (wsManager) {
      const notifyUserIds = conv.is_group
        ? (await executeQuery(
            'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ? AND left_at IS NULL',
            [message.conversation_id, userId]
          )).data?.map(m => m.user_id) || []
        : [conv.user1_id === userId ? conv.user2_id : conv.user1_id];

      notifyUserIds.forEach(uid => {
        wsManager.sendToUser(uid, {
          type: newPinnedState ? 'message_pinned' : 'message_unpinned',
          conversationId: message.conversation_id,
          messageId: id,
          pinnedBy: userId
        });
      });
    }

    res.json({
      messageId: id,
      isPinned: Boolean(newPinnedState)
    });

  } catch (error) {
    console.error('Ошибка закрепления сообщения:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/messages/:messageId/reactions
 * Добавить/обновить реакцию на сообщение
 * Body: { emoji: string }
 * Одна реакция на сообщение от каждого пользователя
 */
router.post('/:messageId/reactions', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    if (!emoji || typeof emoji !== 'string' || emoji.trim().length === 0) {
      return res.status(400).json({ error: 'Эмодзи не указан', code: 'MISSING_EMOJI' });
    }

    // Проверяем что сообщение существует
    const msgCheck = await executeQuery(
      'SELECT * FROM messages WHERE id = ?',
      [messageId]
    );
    if (!msgCheck.success || msgCheck.data.length === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено', code: 'MESSAGE_NOT_FOUND' });
    }

    const message = msgCheck.data[0];

    // Проверяем доступ к чату
    const convCheck = await executeQuery(
      'SELECT * FROM conversations WHERE id = ?',
      [message.conversation_id]
    );
    if (!convCheck.success || convCheck.data.length === 0) {
      return res.status(404).json({ error: 'Чат не найден', code: 'CONVERSATION_NOT_FOUND' });
    }

    const conv = convCheck.data[0];
    let isParticipant = false;
    if (conv.is_group) {
      const memberCheck = await executeQuery(
        'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL',
        [message.conversation_id, userId]
      );
      isParticipant = memberCheck.success && memberCheck.data.length > 0;
    } else {
      isParticipant = conv.user1_id === userId || conv.user2_id === userId;
    }
    if (!isParticipant) {
      return res.status(403).json({ error: 'Нет доступа', code: 'FORBIDDEN' });
    }

    // Проверяем существующую реакцию
    const existingReaction = await executeQuery(
      'SELECT * FROM message_reactions WHERE message_id = ? AND user_id = ?',
      [messageId, userId]
    );

    let reactionId;
    let isUpdate = false;

    if (existingReaction.success && existingReaction.data.length > 0) {
      // Обновляем существующую реакцию
      reactionId = existingReaction.data[0].id;
      isUpdate = true;
      await executeQuery(
        'UPDATE message_reactions SET emoji = ?, created_at = datetime(\'now\') WHERE id = ?',
        [emoji.trim(), reactionId]
      );
    } else {
      // Создаём новую реакцию
      reactionId = uuidv4();
      await executeQuery(
        'INSERT INTO message_reactions (id, message_id, user_id, emoji) VALUES (?, ?, ?, ?)',
        [reactionId, messageId, userId, emoji.trim()]
      );
    }

    // Получаем данные пользователя
    const userResult = await executeQuery(
      'SELECT display_name, avatar_url FROM users WHERE id = ?',
      [userId]
    );
    const userName = userResult.success && userResult.data.length > 0 ? userResult.data[0].display_name : 'Пользователь';
    const userAvatar = userResult.success && userResult.data.length > 0 ? userResult.data[0].avatar_url : null;

    const reactionData = {
      id: reactionId,
      messageId,
      userId,
      emoji: emoji.trim(),
      user: { displayName: userName, avatarUrl: userAvatar }
    };

    // WebSocket уведомление
    const wsManager = req.app.get('wsManager');
    if (wsManager) {
      const notifyUserIds = conv.is_group
        ? (await executeQuery(
            'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ? AND left_at IS NULL',
            [message.conversation_id, userId]
          )).data?.map(m => m.user_id) || []
        : [conv.user1_id === userId ? conv.user2_id : conv.user1_id];

      notifyUserIds.forEach(uid => {
        wsManager.sendToUser(uid, {
          type: isUpdate ? 'message_reaction_updated' : 'message_reaction',
          conversationId: message.conversation_id,
          reaction: reactionData
        });
      });
    }

    res.status(201).json(reactionData);

  } catch (error) {
    console.error('Ошибка добавления реакции:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

/**
 * DELETE /api/messages/:messageId/reactions
 * Удалить свою реакцию с сообщения
 */
router.delete('/:messageId/reactions', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const existingReaction = await executeQuery(
      'SELECT * FROM message_reactions WHERE message_id = ? AND user_id = ?',
      [messageId, userId]
    );

    if (!existingReaction.success || existingReaction.data.length === 0) {
      return res.status(404).json({ error: 'Реакция не найдена', code: 'REACTION_NOT_FOUND' });
    }

    await executeQuery(
      'DELETE FROM message_reactions WHERE message_id = ? AND user_id = ?',
      [messageId, userId]
    );

    // Получаем conversation_id для WebSocket
    const msgCheck = await executeQuery(
      'SELECT conversation_id FROM messages WHERE id = ?',
      [messageId]
    );

    if (msgCheck.success && msgCheck.data.length > 0) {
      const conversationId = msgCheck.data[0].conversation_id;
      const convCheck = await executeQuery(
        'SELECT * FROM conversations WHERE id = ?',
        [conversationId]
      );

      if (convCheck.success && convCheck.data.length > 0) {
        const conv = convCheck.data[0];
        const wsManager = req.app.get('wsManager');
        if (wsManager) {
          const notifyUserIds = conv.is_group
            ? (await executeQuery(
                'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ? AND left_at IS NULL',
                [conversationId, userId]
              )).data?.map(m => m.user_id) || []
            : [conv.user1_id === userId ? conv.user2_id : conv.user1_id];

          notifyUserIds.forEach(uid => {
            wsManager.sendToUser(uid, {
              type: 'message_reaction_removed',
              conversationId,
              messageId,
              userId
            });
          });
        }
      }
    }

    res.json({ message: 'Реакция удалена', messageId, userId });

  } catch (error) {
    console.error('Ошибка удаления реакции:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

// ============================================================
// ГРУППОВЫЕ ЧАТЫ
// ============================================================

/**
 * POST /api/messages/conversations/group
 * Создать групповой чат
 * Body: { groupName: string, memberIds: string[] }
 */
router.post('/conversations/group', authenticateToken, async (req, res) => {
  try {
    const { groupName, memberIds } = req.body;
    const userId = req.user.id;

    if (!groupName || !groupName.trim()) {
      return res.status(400).json({ error: 'Укажите название группы', code: 'MISSING_NAME' });
    }

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length < 1) {
      return res.status(400).json({ error: 'Добавьте хотя бы одного участника', code: 'MISSING_MEMBERS' });
    }

    // Проверяем что все memberIds — друзья пользователя
    for (const memberId of memberIds) {
      if (memberId === userId) continue;
      const friendCheck = await executeQuery(
        'SELECT id FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
        [userId, memberId, memberId, userId]
      );
      if (!friendCheck.success || friendCheck.data.length === 0) {
        return res.status(400).json({
          error: `Пользователь ${memberId} не является вашим другом`,
          code: 'NOT_FRIEND'
        });
      }
    }

    const conversationId = uuidv4();

    // Создаём групповой чат (user1_id/user2_id не используются для групп, ставим создателя)
    const createResult = await executeQuery(
      `INSERT INTO conversations (id, user1_id, user2_id, is_group, group_name, created_by, last_message_at, created_at)
       VALUES (?, ?, ?, 1, ?, ?, datetime('now'), datetime('now'))`,
      [conversationId, userId, userId, groupName.trim(), userId]
    );

    if (!createResult.success) {
      return res.status(500).json({ error: 'Ошибка создания группы', code: 'DATABASE_ERROR' });
    }

    // Добавляем создателя как участника
    await executeQuery(
      'INSERT INTO conversation_members (id, conversation_id, user_id, joined_at) VALUES (?, ?, ?, datetime(\'now\'))',
      [uuidv4(), conversationId, userId]
    );

    // Добавляем остальных участников
    for (const memberId of memberIds) {
      if (memberId === userId) continue;
      await executeQuery(
        'INSERT INTO conversation_members (id, conversation_id, user_id, joined_at) VALUES (?, ?, ?, datetime(\'now\'))',
        [uuidv4(), conversationId, memberId]
      );
    }

    // Получаем созданный чат
    const convResult = await executeQuery('SELECT * FROM conversations WHERE id = ?', [conversationId]);
    const conv = convResult.data[0];

    res.status(201).json({
      id: conv.id,
      isGroup: true,
      groupName: conv.group_name,
      groupAvatar: conv.group_avatar,
      createdBy: conv.created_by,
      createdAt: conv.created_at ? conv.created_at + 'Z' : null
    });

  } catch (error) {
    console.error('Ошибка создания группового чата:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/messages/conversations/secret
 * Создать секретный чат (E2EE)
 */
router.post('/conversations/secret', authenticateToken, async (req, res) => {
  try {
    const { memberId } = req.body;
    const userId = req.user.id;

    if (!memberId) {
      return res.status(400).json({ error: 'Укажите собеседника', code: 'MISSING_MEMBER' });
    }

    if (memberId === userId) {
      return res.status(400).json({ error: 'Нельзя создать секретный чат с самим собой', code: 'SELF_CHAT' });
    }

    // Проверяем, существует ли получатель
    const receiverCheck = await executeQuery(
      'SELECT id, display_name, avatar_url FROM users WHERE id = ?',
      [memberId]
    );
    if (!receiverCheck.success || receiverCheck.data.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден', code: 'USER_NOT_FOUND' });
    }

    // Проверяем, есть ли у обоих пользователей публичные ключи
    const myKeyCheck = await executeQuery(
      'SELECT id FROM user_keys WHERE user_id = ?',
      [userId]
    );
    if (!myKeyCheck.success || myKeyCheck.data.length === 0) {
      return res.status(400).json({ error: 'У вас нет ключей E2EE. Сначала создайте ключи.', code: 'NO_E2EE_KEY' });
    }

    const theirKeyCheck = await executeQuery(
      'SELECT id FROM user_keys WHERE user_id = ?',
      [memberId]
    );
    if (!theirKeyCheck.success || theirKeyCheck.data.length === 0) {
      return res.status(400).json({ error: 'У собеседника нет ключей E2EE', code: 'NO_E2EE_KEY_OTHER' });
    }

    // Проверяем, нет ли уже секретного чата между пользователями
    const existingCheck = await executeQuery(
      `SELECT id FROM conversations
       WHERE ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?))
       AND is_secret = 1`,
      [userId, memberId, memberId, userId]
    );
    if (existingCheck.success && existingCheck.data.length > 0) {
      return res.status(409).json({
        error: 'Секретный чат с этим пользователем уже существует',
        code: 'ALREADY_EXISTS',
        conversationId: existingCheck.data[0].id
      });
    }

    // Создаём секретный чат
    const conversationId = uuidv4();
    const [user1Id, user2Id] = [userId, memberId].sort();

    const createResult = await executeQuery(
      `INSERT INTO conversations (id, user1_id, user2_id, is_secret, last_message_at, created_at)
       VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))`,
      [conversationId, user1Id, user2Id]
    );

    if (!createResult.success) {
      return res.status(500).json({ error: 'Ошибка создания секретного чата', code: 'DATABASE_ERROR' });
    }

    // Добавляем участников в conversation_members
    await executeQuery(
      'INSERT INTO conversation_members (id, conversation_id, user_id, joined_at) VALUES (?, ?, ?, datetime(\'now\'))',
      [uuidv4(), conversationId, userId]
    );
    await executeQuery(
      'INSERT INTO conversation_members (id, conversation_id, user_id, joined_at) VALUES (?, ?, ?, datetime(\'now\'))',
      [uuidv4(), conversationId, memberId]
    );

    // Уведомляем второго пользователя через WebSocket
    const { sendMessageToUser } = await import('../services/websocketService.js');
    sendMessageToUser(memberId, {
      type: 'secret_chat_request',
      conversationId,
      fromUser: {
        id: userId,
        displayName: req.user.displayName,
        avatarUrl: req.user.avatarUrl
      }
    });

    const otherUser = receiverCheck.data[0];
    res.status(201).json({
      id: conversationId,
      isSecret: true,
      otherUser: {
        id: memberId,
        displayName: otherUser.display_name,
        avatarUrl: otherUser.avatar_url
      },
      createdAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Ошибка создания секретного чата:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/messages/conversations/group-secret
 * Создать секретный групповой чат (E2EE)
 */
router.post('/conversations/group-secret', authenticateToken, async (req, res) => {
  try {
    const { groupName, memberIds, encryptedKeys } = req.body;
    const userId = req.user.id;

    if (!groupName || !groupName.trim()) {
      return res.status(400).json({ error: 'Укажите название группы', code: 'MISSING_NAME' });
    }

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length < 1) {
      return res.status(400).json({ error: 'Добавьте хотя бы одного участника', code: 'MISSING_MEMBERS' });
    }

    if (!encryptedKeys || !Array.isArray(encryptedKeys)) {
      return res.status(400).json({ error: 'Зашифрованные ключи обязательны', code: 'MISSING_KEYS' });
    }

    // Проверяем что все memberIds — друзья пользователя
    for (const memberId of memberIds) {
      if (memberId === userId) continue;
      const friendCheck = await executeQuery(
        'SELECT id FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
        [userId, memberId, memberId, userId]
      );
      if (!friendCheck.success || friendCheck.data.length === 0) {
        return res.status(400).json({
          error: `Пользователь ${memberId} не является вашим другом`,
          code: 'NOT_FRIEND'
        });
      }
    }

    // Проверяем что у всех участников есть E2EE ключи
    const allMemberIds = [userId, ...memberIds.filter(id => id !== userId)];
    for (const memberId of allMemberIds) {
      const keyCheck = await executeQuery('SELECT id FROM user_keys WHERE user_id = ?', [memberId]);
      if (!keyCheck.success || keyCheck.data.length === 0) {
        return res.status(400).json({
          error: `У пользователя ${memberId} нет ключей E2EE`,
          code: 'NO_E2EE_KEY'
        });
      }
    }

    const conversationId = uuidv4();

    // Создаём секретный групповой чат
    const createResult = await executeQuery(
      `INSERT INTO conversations (id, user1_id, user2_id, is_group, is_secret, group_name, created_by, last_message_at, created_at)
       VALUES (?, ?, ?, 1, 1, ?, ?, datetime('now'), datetime('now'))`,
      [conversationId, userId, userId, groupName.trim(), userId]
    );

    if (!createResult.success) {
      return res.status(500).json({ error: 'Ошибка создания группы', code: 'DATABASE_ERROR' });
    }

    // Добавляем создателя как участника
    await executeQuery(
      'INSERT INTO conversation_members (id, conversation_id, user_id, joined_at) VALUES (?, ?, ?, datetime(\'now\'))',
      [uuidv4(), conversationId, userId]
    );

    // Добавляем остальных участников
    for (const memberId of memberIds) {
      if (memberId === userId) continue;
      await executeQuery(
        'INSERT INTO conversation_members (id, conversation_id, user_id, joined_at) VALUES (?, ?, ?, datetime(\'now\'))',
        [uuidv4(), conversationId, memberId]
      );
    }

    // Сохраняем зашифрованные ключи для каждого участника
    for (const ek of encryptedKeys) {
      await executeQuery(
        'INSERT INTO group_keys (id, conversation_id, user_id, encrypted_group_key, key_version) VALUES (?, ?, ?, ?, 1)',
        [uuidv4(), conversationId, ek.userId, ek.encryptedGroupKey]
      );
    }

    // Уведомляем участников через WebSocket
    const { sendMessageToUser } = await import('../services/websocketService.js');
    for (const memberId of allMemberIds) {
      if (memberId === userId) continue;
      sendMessageToUser(memberId, {
        type: 'secret_group_created',
        conversationId,
        groupName: groupName.trim(),
        createdBy: { id: userId, displayName: req.user.displayName, avatarUrl: req.user.avatarUrl }
      });
    }

    res.status(201).json({
      id: conversationId,
      isGroup: true,
      isSecret: true,
      groupName: groupName.trim(),
      createdBy: userId,
      createdAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Ошибка создания секретного группового чата:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/messages/conversations/:conversationId/group-key
 * Получить зашифрованный групповой ключ для текущего пользователя
 */
router.get('/conversations/:conversationId/group-key', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const result = await executeQuery(
      'SELECT encrypted_group_key, key_version FROM group_keys WHERE conversation_id = ? AND user_id = ? ORDER BY key_version DESC LIMIT 1',
      [conversationId, userId]
    );

    if (!result.success || result.data.length === 0) {
      return res.status(404).json({ error: 'Групповой ключ не найден', code: 'KEY_NOT_FOUND' });
    }

    res.json({
      encryptedGroupKey: result.data[0].encrypted_group_key,
      keyVersion: result.data[0].key_version
    });

  } catch (error) {
    console.error('Ошибка получения группового ключа:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

/**
 * PUT /api/messages/conversations/:conversationId/group-key
 * Обновить зашифрованные групповые ключи (ротация)
 * Body: { encryptedKeys: [{ userId, encryptedGroupKey }], keyVersion: number }
 */
router.put('/conversations/:conversationId/group-key', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { encryptedKeys, keyVersion } = req.body;
    const userId = req.user.id;

    if (!encryptedKeys || !Array.isArray(encryptedKeys)) {
      return res.status(400).json({ error: 'encryptedKeys обязателен', code: 'MISSING_KEYS' });
    }

    // Проверяем что это секретный групповой чат
    const convCheck = await executeQuery(
      'SELECT is_group, is_secret FROM conversations WHERE id = ?',
      [conversationId]
    );
    if (!convCheck.success || convCheck.data.length === 0 || !convCheck.data[0].is_group || !convCheck.data[0].is_secret) {
      return res.status(400).json({ error: 'Это не секретный групповой чат', code: 'NOT_SECRET_GROUP' });
    }

    // Проверяем что пользователь участник чата
    const memberCheck = await executeQuery(
      'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL',
      [conversationId, userId]
    );
    if (!memberCheck.success || memberCheck.data.length === 0) {
      return res.status(403).json({ error: 'Нет доступа', code: 'FORBIDDEN' });
    }

    // НЕ удаляем старые ключи — они нужны для расшифровки старых сообщений
    // Старые ключи остаются в БД для обратной совместимости

    for (const ek of encryptedKeys) {
      // Проверяем существует ли уже запись для этой версии
      const existing = await executeQuery(
        'SELECT id FROM group_keys WHERE conversation_id = ? AND user_id = ? AND key_version = ?',
        [conversationId, ek.userId, keyVersion]
      );

      if (existing.success && existing.data.length > 0) {
        // Обновляем
        await executeQuery(
          'UPDATE group_keys SET encrypted_group_key = ? WHERE conversation_id = ? AND user_id = ? AND key_version = ?',
          [ek.encryptedGroupKey, conversationId, ek.userId, keyVersion]
        );
      } else {
        // Вставляем новый
        await executeQuery(
          'INSERT INTO group_keys (id, conversation_id, user_id, encrypted_group_key, key_version) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), conversationId, ek.userId, ek.encryptedGroupKey, keyVersion]
        );
      }
    }

    res.json({ message: 'Групповые ключи обновлены', keyVersion });

  } catch (error) {
    console.error('Ошибка обновления групповых ключей:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/messages/conversations/:conversationId/members
 * Получить список участников группового чата
 */
router.get('/conversations/:conversationId/members', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Проверяем что пользователь участник чата
    const memberCheck = await executeQuery(
      'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL',
      [conversationId, userId]
    );
    if (!memberCheck.success || memberCheck.data.length === 0) {
      return res.status(403).json({ error: 'Нет доступа к этому чату', code: 'FORBIDDEN' });
    }

    // Получаем участников
    const membersResult = await executeQuery(
      `SELECT cm.user_id, cm.joined_at, cm.left_at,
              u.display_name, u.avatar_url
       FROM conversation_members cm
       LEFT JOIN users u ON cm.user_id = u.id
       WHERE cm.conversation_id = ? AND cm.left_at IS NULL
       ORDER BY cm.joined_at ASC`,
      [conversationId]
    );

    if (!membersResult.success) {
      return res.status(500).json({ error: 'Ошибка получения участников', code: 'DATABASE_ERROR' });
    }

    // Получаем информацию о модераторах
    const modsResult = await executeQuery(
      `SELECT gm.user_id, gmp.permission_type
       FROM group_moderators gm
       LEFT JOIN group_moderator_permissions gmp ON gm.id = gmp.moderator_id
       WHERE gm.conversation_id = ?`,
      [conversationId]
    );

    // Собираем права модераторов
    const moderatorRights = {};
    if (modsResult.success) {
      for (const row of modsResult.data) {
        if (!moderatorRights[row.user_id]) moderatorRights[row.user_id] = [];
        if (row.permission_type) moderatorRights[row.user_id].push(row.permission_type);
      }
    }

    // Получаем создателя группы и настройки отображения
    const convResult = await executeQuery(
      'SELECT created_by, show_creator_label, show_moderator_label FROM conversations WHERE id = ?',
      [conversationId]
    );
    const createdBy = convResult.success && convResult.data.length > 0
      ? convResult.data[0].created_by : null;
    const showCreatorLabel = convResult.success && convResult.data.length > 0
      ? convResult.data[0].show_creator_label !== 0 : true;
    const showModeratorLabel = convResult.success && convResult.data.length > 0
      ? convResult.data[0].show_moderator_label !== 0 : true;

    const members = membersResult.data.map(m => ({
      userId: m.user_id,
      displayName: m.display_name,
      avatarUrl: m.avatar_url,
      joinedAt: m.joined_at ? m.joined_at + 'Z' : null,
      isCreator: m.user_id === createdBy,
      isModerator: m.user_id in moderatorRights,
      permissions: moderatorRights[m.user_id] || []
    }));

    res.json({
      members,
      settings: {
        showCreatorLabel,
        showModeratorLabel
      }
    });

  } catch (error) {
    console.error('Ошибка получения участников:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/messages/conversations/:conversationId/members
 * Добавить участника в групповой чат
 * Body: { userId: string, encryptedGroupKey?: string }  (encryptedGroupKey required for secret groups)
 */
router.post('/conversations/:conversationId/members', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId: newMemberId, encryptedGroupKey, keyVersion: clientKeyVersion } = req.body;
    const currentUserId = req.user.id;

    // Проверяем что текущий пользователь участник чата
    const memberCheck = await executeQuery(
      'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL',
      [conversationId, currentUserId]
    );
    if (!memberCheck.success || memberCheck.data.length === 0) {
      return res.status(403).json({ error: 'Нет доступа', code: 'FORBIDDEN' });
    }

    // Проверяем что это групповой чат
    const convCheck = await executeQuery(
      'SELECT is_group, is_secret FROM conversations WHERE id = ?',
      [conversationId]
    );
    if (!convCheck.success || convCheck.data.length === 0 || !convCheck.data[0].is_group) {
      return res.status(400).json({ error: 'Это не групповой чат', code: 'NOT_GROUP' });
    }

    const isSecretGroup = Boolean(convCheck.data[0].is_secret);

    // Для секретных групп — требуется зашифрованный ключ
    if (isSecretGroup && !encryptedGroupKey) {
      return res.status(400).json({ error: 'Для секретной группы требуется encryptedGroupKey', code: 'MISSING_KEY' });
    }

    // Проверяем что добавляемый пользователь не уже участник
    const alreadyMember = await executeQuery(
      'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL',
      [conversationId, newMemberId]
    );
    if (alreadyMember.success && alreadyMember.data.length > 0) {
      return res.status(400).json({ error: 'Пользователь уже участник', code: 'ALREADY_MEMBER' });
    }

    // Если ранее выходил — обновляем запись
    const prevMember = await executeQuery(
      'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
      [conversationId, newMemberId]
    );
    if (prevMember.success && prevMember.data.length > 0) {
      await executeQuery(
        'UPDATE conversation_members SET left_at = NULL, joined_at = datetime(\'now\') WHERE conversation_id = ? AND user_id = ?',
        [conversationId, newMemberId]
      );
    } else {
      await executeQuery(
        'INSERT INTO conversation_members (id, conversation_id, user_id, joined_at) VALUES (?, ?, ?, datetime(\'now\'))',
        [uuidv4(), conversationId, newMemberId]
      );
    }

    // Для секретных групп — сохраняем зашифрованный ключ для нового участника
    if (isSecretGroup && encryptedGroupKey) {
      // Используем версию ключа от клиента, или запрашиваем MAX из БД
      let keyVersion = clientKeyVersion;
      if (!keyVersion) {
        const keyVersionResult = await executeQuery(
          'SELECT MAX(key_version) as max_version FROM group_keys WHERE conversation_id = ?',
          [conversationId]
        );
        keyVersion = keyVersionResult.success && keyVersionResult.data[0].max_version
          ? keyVersionResult.data[0].max_version : 1;
      }

      // Удаляем старый ключ если есть (при повторном входе)
      await executeQuery(
        'DELETE FROM group_keys WHERE conversation_id = ? AND user_id = ?',
        [conversationId, newMemberId]
      );

      // Сохраняем новый зашифрованный ключ
      await executeQuery(
        'INSERT INTO group_keys (id, conversation_id, user_id, encrypted_group_key, key_version) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), conversationId, newMemberId, encryptedGroupKey, keyVersion]
      );

      // Уведомляем нового участника
      const { sendMessageToUser } = await import('../services/websocketService.js');
      sendMessageToUser(newMemberId, {
        type: 'secret_group_joined',
        conversationId,
        groupName: convCheck.data[0].group_name || 'Секретная группа'
      });
    }

    res.json({ message: 'Участник добавлен' });

  } catch (error) {
    console.error('Ошибка добавления участника:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

/**
 * DELETE /api/messages/conversations/:conversationId/members/:memberId
 * Удалить участника или покинуть чат
 */
router.delete('/conversations/:conversationId/members/:memberId', authenticateToken, async (req, res) => {
  try {
    const { conversationId, memberId } = req.params;
    const currentUserId = req.user.id;

    // Проверяем что это групповой чат
    const convCheck = await executeQuery(
      'SELECT is_group, is_secret, created_by FROM conversations WHERE id = ?',
      [conversationId]
    );
    if (!convCheck.success || convCheck.data.length === 0 || !convCheck.data[0].is_group) {
      return res.status(400).json({ error: 'Это не групповой чат', code: 'NOT_GROUP' });
    }

    const isSecretGroup = Boolean(convCheck.data[0].is_secret);
    const isCreator = convCheck.data[0].created_by === currentUserId;

    // Удаление другого участника — только создатель или модератор с manage_members
    if (memberId !== currentUserId && !isCreator) {
      // Проверяем права модератора
      const modCheck = await executeQuery(
        `SELECT gm.id FROM group_moderators gm
         JOIN group_moderator_permissions gmp ON gm.id = gmp.moderator_id
         WHERE gm.conversation_id = ? AND gm.user_id = ? AND gmp.permission_type = 'manage_members'`,
        [conversationId, currentUserId]
      );
      if (!modCheck.success || modCheck.data.length === 0) {
        return res.status(403).json({ error: 'Нет прав на удаление участников', code: 'FORBIDDEN' });
      }
    }

    // Нельзя удалить создателя
    if (memberId === convCheck.data[0].created_by) {
      return res.status(400).json({ error: 'Нельзя удалить создателя группы', code: 'CANNOT_REMOVE_CREATOR' });
    }

    // Помечаем как покинувшего
    await executeQuery(
      'UPDATE conversation_members SET left_at = datetime(\'now\') WHERE conversation_id = ? AND user_id = ?',
      [conversationId, memberId]
    );

    // Для секретных групп — удаляем ключ участника и уведомляем
    if (isSecretGroup) {
      // Удаляем ключ удалённого участника
      await executeQuery(
        'DELETE FROM group_keys WHERE conversation_id = ? AND user_id = ?',
        [conversationId, memberId]
      );

      const { sendMessageToUser } = await import('../services/websocketService.js');

      // Уведомляем удалённого участника
      sendMessageToUser(memberId, {
        type: 'secret_group_removed',
        conversationId
      });

      // Уведомляем оставшихся участников о необходимости ротации ключа
      const membersResult = await executeQuery(
        'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ? AND left_at IS NULL',
        [conversationId, memberId]
      );

      if (membersResult.success) {
        for (const m of membersResult.data) {
          sendMessageToUser(m.user_id, {
            type: 'secret_group_key_rotation_needed',
            conversationId,
            removedUserId: memberId
          });
        }
      }
    }

    res.json({ message: 'Участник удалён', keyRotationNeeded: isSecretGroup });

  } catch (error) {
    console.error('Ошибка удаления участника:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

/**
 * PUT /api/messages/conversations/:conversationId
 * Изменить название группы (только создатель)
 */
router.put('/conversations/:conversationId', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { groupName } = req.body;
    const userId = req.user.id;

    const convCheck = await executeQuery(
      'SELECT created_by, is_group FROM conversations WHERE id = ?',
      [conversationId]
    );
    if (!convCheck.success || convCheck.data.length === 0) {
      return res.status(404).json({ error: 'Чат не найден', code: 'NOT_FOUND' });
    }
    if (!convCheck.data[0].is_group) {
      return res.status(400).json({ error: 'Это не групповой чат', code: 'NOT_GROUP' });
    }
    if (convCheck.data[0].created_by !== userId) {
      return res.status(403).json({ error: 'Только создатель может редактировать', code: 'FORBIDDEN' });
    }

    await executeQuery(
      'UPDATE conversations SET group_name = ? WHERE id = ?',
      [groupName.trim(), conversationId]
    );

    res.json({ message: 'Название обновлено', groupName: groupName.trim() });

  } catch (error) {
    console.error('Ошибка обновления группы:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

/**
 * PATCH /api/messages/conversations/:conversationId/settings
 * Обновить настройки отображения группы (только создатель)
 * Body: { showCreatorLabel?: boolean, showModeratorLabel?: boolean }
 */
router.patch('/conversations/:conversationId/settings', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { showCreatorLabel, showModeratorLabel } = req.body;
    const userId = req.user.id;

    const convCheck = await executeQuery(
      'SELECT created_by, is_group FROM conversations WHERE id = ?',
      [conversationId]
    );
    if (!convCheck.success || convCheck.data.length === 0) {
      return res.status(404).json({ error: 'Чат не найден', code: 'NOT_FOUND' });
    }
    if (!convCheck.data[0].is_group) {
      return res.status(400).json({ error: 'Это не групповой чат', code: 'NOT_GROUP' });
    }
    if (convCheck.data[0].created_by !== userId) {
      return res.status(403).json({ error: 'Только создатель может менять настройки', code: 'FORBIDDEN' });
    }

    const updates = [];
    const params = [];

    if (showCreatorLabel !== undefined) {
      updates.push('show_creator_label = ?');
      params.push(showCreatorLabel ? 1 : 0);
    }
    if (showModeratorLabel !== undefined) {
      updates.push('show_moderator_label = ?');
      params.push(showModeratorLabel ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Нет изменений', code: 'NO_CHANGES' });
    }

    params.push(conversationId);
    await executeQuery(
      `UPDATE conversations SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ message: 'Настройки обновлены' });

  } catch (error) {
    console.error('Ошибка обновления настроек группы:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/messages/conversations/:conversationId/avatar
 * Загрузить аватарку группы (только создатель)
 */
router.post('/conversations/:conversationId/avatar', authenticateToken, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const convCheck = await executeQuery(
      'SELECT created_by, is_group FROM conversations WHERE id = ?',
      [conversationId]
    );
    if (!convCheck.success || convCheck.data.length === 0) {
      return res.status(404).json({ error: 'Чат не найден', code: 'NOT_FOUND' });
    }
    if (!convCheck.data[0].is_group) {
      return res.status(400).json({ error: 'Это не групповой чат', code: 'NOT_GROUP' });
    }
    if (convCheck.data[0].created_by !== userId) {
      return res.status(403).json({ error: 'Только создатель может менять аватарку', code: 'FORBIDDEN' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен', code: 'NO_FILE' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await executeQuery(
      'UPDATE conversations SET group_avatar = ? WHERE id = ?',
      [avatarUrl, conversationId]
    );

    res.json({ message: 'Аватарка обновлена', avatarUrl });

  } catch (error) {
    console.error('Ошибка загрузки аватарки группы:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

/**
 * DELETE /api/messages/conversations/:conversationId
 * Удалить групповой чат (только создатель)
 */
router.delete('/conversations/:conversationId', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const convCheck = await executeQuery(
      'SELECT created_by, is_group FROM conversations WHERE id = ?',
      [conversationId]
    );
    if (!convCheck.success || convCheck.data.length === 0) {
      return res.status(404).json({ error: 'Чат не найден', code: 'NOT_FOUND' });
    }
    if (!convCheck.data[0].is_group) {
      return res.status(400).json({ error: 'Это не групповой чат', code: 'NOT_GROUP' });
    }
    if (convCheck.data[0].created_by !== userId) {
      return res.status(403).json({ error: 'Только создатель может удалить группу', code: 'FORBIDDEN' });
    }

    // Получаем участников для уведомления
    const membersResult = await executeQuery(
      'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ? AND left_at IS NULL',
      [conversationId, userId]
    );

    // Уведомляем участников через WebSocket ДО удаления
    if (membersResult.success && membersResult.data.length > 0) {
      const { sendMessageToUser } = await import('../services/websocketService.js');
      for (const m of membersResult.data) {
        sendMessageToUser(m.user_id, {
          type: 'group_deleted',
          conversationId
        });
      }
    }

    // Удаляем сообщения, участников, модераторов — каскадно
    await executeQuery('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
    await executeQuery('DELETE FROM group_moderator_permissions WHERE moderator_id IN (SELECT id FROM group_moderators WHERE conversation_id = ?)', [conversationId]);
    await executeQuery('DELETE FROM group_moderators WHERE conversation_id = ?', [conversationId]);
    await executeQuery('DELETE FROM conversation_members WHERE conversation_id = ?', [conversationId]);
    await executeQuery('DELETE FROM conversations WHERE id = ?', [conversationId]);

    res.json({ message: 'Группа удалена' });

  } catch (error) {
    console.error('Ошибка удаления группы:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

// ============================================================
// МОДЕРАТОРЫ ГРУППОВЫХ ЧАТОВ
// ============================================================

/**
 * GET /api/messages/conversations/:conversationId/moderators
 * Список модераторов группы
 */
router.get('/conversations/:conversationId/moderators', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;

    const modsResult = await executeQuery(
      `SELECT gm.user_id, gm.assigned_by, gm.assigned_at,
              u.display_name, u.avatar_url,
              ab.display_name as assigned_by_name
       FROM group_moderators gm
       LEFT JOIN users u ON gm.user_id = u.id
       LEFT JOIN users ab ON gm.assigned_by = ab.id
       WHERE gm.conversation_id = ?`,
      [conversationId]
    );

    if (!modsResult.success) {
      return res.status(500).json({ error: 'Ошибка получения модераторов', code: 'DATABASE_ERROR' });
    }

    const moderators = [];
    for (const mod of modsResult.data) {
      const permsResult = await executeQuery(
        'SELECT permission_type FROM group_moderator_permissions WHERE moderator_id = (SELECT id FROM group_moderators WHERE conversation_id = ? AND user_id = ?)',
        [conversationId, mod.user_id]
      );
      moderators.push({
        userId: mod.user_id,
        displayName: mod.display_name,
        avatarUrl: mod.avatar_url,
        assignedBy: mod.assigned_by,
        assignedByName: mod.assigned_by_name,
        assignedAt: mod.assigned_at ? mod.assigned_at + 'Z' : null,
        permissions: permsResult.success ? permsResult.data.map(p => p.permission_type) : []
      });
    }

    res.json(moderators);

  } catch (error) {
    console.error('Ошибка получения модераторов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/messages/conversations/:conversationId/moderators
 * Назначить модератора (создатель ИЛИ модератор с manage_moderators)
 * Body: { userId: string, permissions: string[] }
 */
router.post('/conversations/:conversationId/moderators', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId: modUserId, permissions } = req.body;
    const currentUserId = req.user.id;

    const convCheck = await executeQuery(
      'SELECT created_by, is_group FROM conversations WHERE id = ?',
      [conversationId]
    );
    if (!convCheck.success || convCheck.data.length === 0 || !convCheck.data[0].is_group) {
      return res.status(400).json({ error: 'Группа не найдена', code: 'NOT_FOUND' });
    }

    const isCreator = convCheck.data[0].created_by === currentUserId;

    // Проверяем права: создатель ИЛИ модератор с manage_moderators
    if (!isCreator) {
      const modCheck = await executeQuery(
        `SELECT gm.id FROM group_moderators gm
         JOIN group_moderator_permissions gmp ON gm.id = gmp.moderator_id
         WHERE gm.conversation_id = ? AND gm.user_id = ? AND gmp.permission_type = 'manage_moderators'`,
        [conversationId, currentUserId]
      );
      if (!modCheck.success || modCheck.data.length === 0) {
        return res.status(403).json({ error: 'Нет прав на управление модераторами', code: 'FORBIDDEN' });
      }
    }

    // Проверяем что пользователь участник
    const memberCheck = await executeQuery(
      'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL',
      [conversationId, modUserId]
    );
    if (!memberCheck.success || memberCheck.data.length === 0) {
      return res.status(400).json({ error: 'Пользователь не является участником', code: 'NOT_MEMBER' });
    }

    // Удаляем старую запись если есть
    const existingMod = await executeQuery(
      'SELECT id FROM group_moderators WHERE conversation_id = ? AND user_id = ?',
      [conversationId, modUserId]
    );
    if (existingMod.success && existingMod.data.length > 0) {
      await executeQuery('DELETE FROM group_moderator_permissions WHERE moderator_id = ?', [existingMod.data[0].id]);
      await executeQuery('DELETE FROM group_moderators WHERE id = ?', [existingMod.data[0].id]);
    }

    // Создаём нового модератора
    const modId = uuidv4();
    await executeQuery(
      'INSERT INTO group_moderators (id, conversation_id, user_id, assigned_by, assigned_at) VALUES (?, ?, ?, ?, datetime(\'now\'))',
      [modId, conversationId, modUserId, currentUserId]
    );

    // Добавляем права
    const validPermissions = ['manage_members', 'manage_messages', 'edit_group', 'send_announcements', 'delete_announcements', 'manage_moderators'];
    for (const perm of permissions || []) {
      if (validPermissions.includes(perm)) {
        await executeQuery(
          'INSERT INTO group_moderator_permissions (id, moderator_id, permission_type, granted_at) VALUES (?, ?, ?, datetime(\'now\'))',
          [uuidv4(), modId, perm]
        );
      }
    }

    res.json({ message: 'Модератор назначен', permissions: permissions || [] });

  } catch (error) {
    console.error('Ошибка назначения модератора:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

/**
 * DELETE /api/messages/conversations/:conversationId/moderators/:modUserId
 * Снять модератора (создатель ИЛИ модератор с manage_moderators — только своих)
 */
router.delete('/conversations/:conversationId/moderators/:modUserId', authenticateToken, async (req, res) => {
  try {
    const { conversationId, modUserId } = req.params;
    const currentUserId = req.user.id;

    const convCheck = await executeQuery(
      'SELECT created_by, is_group FROM conversations WHERE id = ?',
      [conversationId]
    );
    if (!convCheck.success || convCheck.data.length === 0 || !convCheck.data[0].is_group) {
      return res.status(400).json({ error: 'Группа не найдена', code: 'NOT_FOUND' });
    }

    const isCreator = convCheck.data[0].created_by === currentUserId;

    const modCheck = await executeQuery(
      'SELECT id, assigned_by FROM group_moderators WHERE conversation_id = ? AND user_id = ?',
      [conversationId, modUserId]
    );
    if (!modCheck.success || modCheck.data.length === 0) {
      return res.status(404).json({ error: 'Модератор не найден', code: 'MODERATOR_NOT_FOUND' });
    }

    const moderatorRecord = modCheck.data[0];

    // Проверяем права
    if (!isCreator) {
      // Модератор может снять только тех, кого назначил он сам
      const modPermCheck = await executeQuery(
        `SELECT gm.id FROM group_moderators gm
         JOIN group_moderator_permissions gmp ON gm.id = gmp.moderator_id
         WHERE gm.conversation_id = ? AND gm.user_id = ? AND gmp.permission_type = 'manage_moderators'`,
        [conversationId, currentUserId]
      );
      if (!modPermCheck.success || modPermCheck.data.length === 0) {
        return res.status(403).json({ error: 'Нет прав на управление модераторами', code: 'FORBIDDEN' });
      }
      // Модератор может снять только тех, кого назначил он сам (assigned_by = currentUserId)
      if (moderatorRecord.assigned_by !== currentUserId) {
        return res.status(403).json({ error: 'Нельзя снять модератора, назначенного создателем', code: 'FORBIDDEN' });
      }
    }

    await executeQuery('DELETE FROM group_moderator_permissions WHERE moderator_id = ?', [moderatorRecord.id]);
    await executeQuery('DELETE FROM group_moderators WHERE id = ?', [moderatorRecord.id]);

    res.json({ message: 'Модератор снят' });

  } catch (error) {
    console.error('Ошибка снятия модератора:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

export default router;
