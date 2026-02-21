import express from 'express';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/feed/:userId
 * Получить ленту активности друзей и самого пользователя
 * Возвращает последние 10 текстовых постов от друзей и пользователя
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

    // Получаем ID всех друзей + сам пользователь
    const friendIds = friendsResult.data.map(f => f.friend_id);
    const allUserIds = [...friendIds, userId]; // Добавляем самого пользователя

    // Если нет друзей, показываем только свои посты
    if (allUserIds.length === 0) {
      return res.json([]);
    }

    // Создаем плейсхолдеры для SQL запроса
    const placeholders = allUserIds.map(() => '?').join(',');

    // Получаем последние 10 текстовых постов от друзей и самого пользователя
    const postsResult = await executeQuery(
      `SELECT 
        wp.id,
        wp.user_id,
        wp.post_type,
        wp.content,
        wp.created_at,
        wp.edited_at,
        u.display_name,
        u.avatar_url
       FROM wall_posts wp
       LEFT JOIN users u ON wp.user_id = u.id
       WHERE wp.user_id IN (${placeholders})
         AND wp.post_type = 'text'
       ORDER BY wp.created_at DESC
       LIMIT 10`,
      allUserIds
    );

    if (!postsResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения постов друзей',
        code: 'DATABASE_ERROR' 
      });
    }

    // Для каждого поста получаем реакции
    const postsWithReactions = await Promise.all(
      postsResult.data.map(async (post) => {
        const reactionsResult = await executeQuery(
          `SELECT r.*, u.display_name, u.avatar_url 
           FROM reactions r
           LEFT JOIN users u ON r.user_id = u.id
           WHERE r.post_id = ?
           ORDER BY r.created_at ASC`,
          [post.id]
        );

        const reactions = reactionsResult.success ? reactionsResult.data.map(r => ({
          id: r.id,
          postId: r.post_id,
          userId: r.user_id,
          emoji: r.emoji,
          createdAt: r.created_at,
          user: {
            displayName: r.display_name,
            avatarUrl: r.avatar_url
          }
        })) : [];

        return {
          id: post.id,
          userId: post.user_id,
          postType: post.post_type,
          content: post.content,
          createdAt: post.created_at,
          editedAt: post.edited_at,
          author: {
            displayName: post.display_name,
            avatarUrl: post.avatar_url
          },
          reactions
        };
      })
    );

    res.json(postsWithReactions);

  } catch (error) {
    console.error('Ошибка получения ленты:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

export default router;
