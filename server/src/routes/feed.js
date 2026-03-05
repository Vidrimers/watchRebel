import express from 'express';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/feed/:userId
 * Получить ленту активности друзей, самого пользователя и объявлений администратора
 * Query params: limit (default 20), offset (default 0)
 */
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

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

    // Получаем последние посты от друзей и самого пользователя с пагинацией
    const postsResult = await executeQuery(
      `SELECT 
        wp.id,
        wp.user_id,
        wp.wall_owner_id,
        wp.post_type,
        wp.content,
        wp.tmdb_id,
        wp.media_type,
        wp.poster_path,
        wp.list_id,
        wp.created_at,
        wp.edited_at,
        author.id as author_id,
        author.display_name as author_display_name,
        author.avatar_url as author_avatar_url,
        author.telegram_username as author_telegram_username,
        author.user_status as author_user_status,
        owner.id as owner_id,
        owner.display_name as owner_display_name,
        owner.avatar_url as owner_avatar_url
       FROM wall_posts wp
       LEFT JOIN users author ON wp.user_id = author.id
       LEFT JOIN users owner ON wp.wall_owner_id = owner.id
       WHERE wp.wall_owner_id IN (${placeholders})
         AND wp.post_type IN ('text', 'status_update', 'media_added')
         AND (wp.content IS NULL OR wp.content NOT LIKE '📢 Объявление администратора:%')
       ORDER BY wp.created_at DESC
       LIMIT ? OFFSET ?`,
      [...allUserIds, limit, offset]
    );

    if (!postsResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения постов друзей',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем все объявления администратора
    const announcementsResult = await executeQuery(
      `SELECT 
        a.id,
        a.content,
        a.created_at,
        a.created_by as user_id,
        u.display_name,
        u.avatar_url
       FROM announcements a
       LEFT JOIN users u ON a.created_by = u.id
       ORDER BY a.created_at DESC`
    );

    // Преобразуем объявления в формат постов
    const announcementPosts = [];
    if (announcementsResult.success) {
      for (const a of announcementsResult.data) {
        // Получаем изображения объявления
        const imagesResult = await executeQuery(
          'SELECT image_path FROM announcement_images WHERE announcement_id = ? ORDER BY created_at',
          [a.id]
        );

        const imageUrls = imagesResult.success && imagesResult.data.length > 0
          ? imagesResult.data.map(img => img.image_path)
          : [];

        announcementPosts.push({
          id: a.id,
          userId: a.user_id,
          postType: 'announcement',
          content: `📢 Объявление администратора:\n\n${a.content}`,
          createdAt: a.created_at,
          editedAt: null,
          author: {
            displayName: a.display_name,
            avatarUrl: a.avatar_url
          },
          reactions: [], // Объявления без реакций
          imageUrls // Добавляем массив URL изображений
        });
      }
    }

    // Для каждого поста получаем реакции и изображения
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

        // Получаем изображения поста
        const imagesResult = await executeQuery(
          `SELECT id, image_url, "order" 
           FROM post_images 
           WHERE post_id = ? 
           ORDER BY "order" ASC`,
          [post.id]
        );

        const images = imagesResult.success ? imagesResult.data.map(img => ({
          id: img.id,
          url: img.image_url,
          order: img.order
        })) : [];

        // Получаем общее количество комментариев (включая ответы)
        const commentsCountResult = await executeQuery(
          'SELECT COUNT(*) as total FROM post_comments WHERE post_id = ?',
          [post.id]
        );

        const commentsCount = commentsCountResult.success ? commentsCountResult.data[0].total : 0;

        return {
          id: post.id,
          userId: post.user_id,
          postType: post.post_type,
          content: post.content,
          tmdbId: post.tmdb_id,
          mediaType: post.media_type,
          posterPath: post.poster_path,
          listId: post.list_id,
          createdAt: post.created_at,
          editedAt: post.edited_at,
          commentsCount, // Общее количество комментариев (включая ответы)
          author: {
            id: post.author_id,
            displayName: post.author_display_name,
            avatarUrl: post.author_avatar_url,
            telegramUsername: post.author_telegram_username,
            userStatus: post.author_user_status
          },
          wallOwner: {
            id: post.owner_id,
            displayName: post.owner_display_name,
            avatarUrl: post.owner_avatar_url
          },
          reactions,
          images // Добавляем массив изображений
        };
      })
    );

    // Объявления добавляем только на первой странице (offset=0)
    let allPosts = postsWithReactions;
    if (offset === 0) {
      // Объединяем объявления и посты, сортируем по дате
      allPosts = [...announcementPosts, ...postsWithReactions]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Проверяем есть ли ещё посты
    const hasMore = postsWithReactions.length === limit;

    res.json({
      posts: allPosts,
      hasMore,
      offset,
      limit
    });

  } catch (error) {
    console.error('Ошибка получения ленты:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

export default router;
