import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/notifications
 * Получить все уведомления текущего пользователя
 * Уведомления отсортированы по дате создания (новые сверху)
 * 
 * Query params:
 * - unreadOnly: boolean (опционально, если true - только непрочитанные)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { unreadOnly } = req.query;

    let query = `
      SELECT n.*, 
             u.display_name as related_user_name,
             u.avatar_url as related_user_avatar
      FROM notifications n
      LEFT JOIN users u ON n.related_user_id = u.id
      WHERE n.user_id = ?
    `;
    const params = [userId];

    if (unreadOnly === 'true') {
      query += ' AND n.is_read = 0';
    }

    query += ' ORDER BY n.created_at DESC';

    const notificationsResult = await executeQuery(query, params);

    if (!notificationsResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения уведомлений',
        code: 'DATABASE_ERROR' 
      });
    }

    const notifications = notificationsResult.data.map(n => ({
      id: n.id,
      userId: n.user_id,
      type: n.type,
      content: n.content,
      relatedUserId: n.related_user_id,
      relatedPostId: n.related_post_id,
      isRead: Boolean(n.is_read),
      createdAt: n.created_at,
      relatedUser: n.related_user_id ? {
        displayName: n.related_user_name,
        avatarUrl: n.related_user_avatar
      } : null
    }));

    res.json(notifications);

  } catch (error) {
    console.error('Ошибка получения уведомлений:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * PUT /api/notifications/mark-all-read
 * Отметить все уведомления как прочитанные
 */
router.put('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Отмечаем все уведомления пользователя как прочитанные
    const updateResult = await executeQuery(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
      [userId]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка обновления уведомлений',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json({ 
      message: 'Все уведомления отмечены как прочитанные',
      updatedCount: updateResult.changes || 0
    });

  } catch (error) {
    console.error('Ошибка обновления всех уведомлений:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Отметить уведомление как прочитанное
 * Только владелец уведомления может его отметить
 */
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Проверяем, существует ли уведомление и принадлежит ли оно пользователю
    const notificationCheck = await executeQuery(
      'SELECT * FROM notifications WHERE id = ?',
      [id]
    );

    if (!notificationCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки уведомления',
        code: 'DATABASE_ERROR' 
      });
    }

    if (notificationCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Уведомление не найдено',
        code: 'NOTIFICATION_NOT_FOUND' 
      });
    }

    const notification = notificationCheck.data[0];

    if (notification.user_id !== userId) {
      return res.status(403).json({ 
        error: 'Нет прав на изменение этого уведомления',
        code: 'FORBIDDEN' 
      });
    }

    // Отмечаем уведомление как прочитанное
    const updateResult = await executeQuery(
      'UPDATE notifications SET is_read = 1 WHERE id = ?',
      [id]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка обновления уведомления',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем обновленное уведомление
    const updatedNotificationResult = await executeQuery(
      `SELECT n.*, 
              u.display_name as related_user_name,
              u.avatar_url as related_user_avatar
       FROM notifications n
       LEFT JOIN users u ON n.related_user_id = u.id
       WHERE n.id = ?`,
      [id]
    );

    if (!updatedNotificationResult.success || updatedNotificationResult.data.length === 0) {
      return res.status(500).json({ 
        error: 'Ошибка получения обновленного уведомления',
        code: 'DATABASE_ERROR' 
      });
    }

    const n = updatedNotificationResult.data[0];

    res.json({
      id: n.id,
      userId: n.user_id,
      type: n.type,
      content: n.content,
      relatedUserId: n.related_user_id,
      relatedPostId: n.related_post_id,
      isRead: Boolean(n.is_read),
      createdAt: n.created_at,
      relatedUser: n.related_user_id ? {
        displayName: n.related_user_name,
        avatarUrl: n.related_user_avatar
      } : null
    });

  } catch (error) {
    console.error('Ошибка обновления уведомления:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * DELETE /api/notifications/:id
 * Удалить уведомление
 * Только владелец уведомления может его удалить
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Проверяем, существует ли уведомление и принадлежит ли оно пользователю
    const notificationCheck = await executeQuery(
      'SELECT * FROM notifications WHERE id = ?',
      [id]
    );

    if (!notificationCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки уведомления',
        code: 'DATABASE_ERROR' 
      });
    }

    if (notificationCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Уведомление не найдено',
        code: 'NOTIFICATION_NOT_FOUND' 
      });
    }

    const notification = notificationCheck.data[0];

    if (notification.user_id !== userId) {
      return res.status(403).json({ 
        error: 'Нет прав на удаление этого уведомления',
        code: 'FORBIDDEN' 
      });
    }

    // Удаляем уведомление
    const deleteResult = await executeQuery(
      'DELETE FROM notifications WHERE id = ?',
      [id]
    );

    if (!deleteResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка удаления уведомления',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json({ 
      message: 'Уведомление успешно удалено',
      notificationId: id 
    });

  } catch (error) {
    console.error('Ошибка удаления уведомления:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

export default router;
