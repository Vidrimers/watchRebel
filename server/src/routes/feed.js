import express from 'express';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/feed/:userId
 * Получить ленту активности друзей пользователя
 * Возвращает последние 10 текстовых постов от друзей
 */
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Проверяем, что пользователь запрашивает свою ленту
    if (req.user.id !== userId) {
      return res.status(403).json({ 
        error: 'Нет прав на просмотр этой ленты',
        code: 'FORBIDDEN' 
      });
    }

    // Получаем список друзей пользователя
    const friendsResult = await executeQuery(
      `SELECT friend_id FROM friends WHERE user_id = ?`,
      [userId]
    );

    if (!friendsResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения списка друзей',
        code: 'DATABASE_ERROR' 
      });
    }

    // Если нет друзей, возвращаем пустой массив
    if (friendsResult.data.length === 0) {
      return res.json([]);
    }

    // Получаем ID всех друзей
    const friendIds = friendsResult.data.map(f => f.friend_id);

    // Создаем плейсхолдеры для SQL запроса
    const placeholders = friendIds.map(() => '?').join(',');

    // Получаем последние 10 текстовых постов от друзей
    const postsResult = await executeQuery(
      `SELECT 
        wp.id,
        wp.user_id,
        wp.post_type,
        wp.content,
        wp.created_at,
        u.display_name,
        u.avatar_url
       FROM wall_posts wp
       LEFT JOIN users u ON wp.user_id = u.id
       WHERE wp.user_id IN (${placeholders})
         AND wp.post_type = 'text'
       ORDER BY wp.created_at DESC
       LIMIT 10`,
      friendIds
    );

    if (!postsResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения постов друзей',
        code: 'DATABASE_ERROR' 
      });
    }

    // Форматируем результат
    const feed = postsResult.data.map(post => ({
      id: post.id,
      userId: post.user_id,
      postType: post.post_type,
      content: post.content,
      createdAt: post.created_at,
      author: {
        displayName: post.display_name,
        avatarUrl: post.avatar_url
      }
    }));

    res.json(feed);

  } catch (error) {
    console.error('Ошибка получения ленты:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

export default router;
