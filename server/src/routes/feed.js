import express from 'express';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import mediaCacheService from '../services/mediaCacheService.js';

const router = express.Router();

/**
 * GET /api/feed/unread-count
 * Получить количество новых постов друзей с момента последнего просмотра ленты
 */
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Получаем список друзей
    const friendsResult = await executeQuery(
      `SELECT friend_id FROM friends WHERE user_id = ?`,
      [userId]
    );

    if (!friendsResult.success || friendsResult.data.length === 0) {
      return res.json({ count: 0 });
    }

    const friendIds = friendsResult.data.map(f => f.friend_id);
    const placeholders = friendIds.map(() => '?').join(',');

    // Получаем last_feed_view пользователя и обновляем его
    const userResult = await executeQuery(
      `SELECT last_feed_view FROM users WHERE id = ?`,
      [userId]
    );
    const lastFeedView = userResult.success && userResult.data.length > 0
      ? userResult.data[0].last_feed_view : null;

    // Обновляем last_feed_view при каждом запросе счётчика
    await executeQuery(
      `UPDATE users SET last_feed_view = datetime('now') WHERE id = ?`,
      [userId]
    );

    // Считаем посты новее last_feed_view (или за 24 часа если last_feed_view не задан)
    const timeCondition = lastFeedView
      ? `AND created_at > ?`
      : `AND created_at > datetime('now', '-1 day')`;
    const timeParams = lastFeedView ? [lastFeedView] : [];

    const countResult = await executeQuery(
      `SELECT COUNT(*) as cnt FROM wall_posts 
       WHERE user_id IN (${placeholders})
       ${timeCondition}`,
      [...friendIds, ...timeParams]
    );

    const count = countResult.success ? countResult.data[0].cnt : 0;
    res.json({ count });

  } catch (error) {
    console.error('Ошибка получения feed unread-count:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/feed/mark-viewed
 * Отметить ленту как просмотренную (обновить last_feed_view)
 */
router.post('/mark-viewed', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    await executeQuery(
      `UPDATE users SET last_feed_view = datetime('now') WHERE id = ?`,
      [userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка обновления last_feed_view:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

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
        wp.rating,
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
          AND wp.post_type IN ('text', 'status_update', 'media_added', 'media_shared', 'review', 'rating')
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

        // Для постов media_added/media_shared проверяем, есть ли этот медиа в списках текущего пользователя
        let userListName = null;
        if (['media_added', 'media_shared'].includes(post.post_type) && post.tmdb_id) {
          const userListResult = await executeQuery(
            `SELECT cl.name 
             FROM list_items li
             JOIN custom_lists cl ON li.list_id = cl.id
             WHERE cl.user_id = ? AND li.tmdb_id = ? AND li.media_type = ?
             LIMIT 1`,
            [userId, post.tmdb_id, post.media_type]
          );
          
          if (userListResult.success && userListResult.data.length > 0) {
            userListName = userListResult.data[0].name;
          }
        }

        // Для постов media_added/media_shared получаем персональную заметку владельца стены
        let personalNote = null;
        if (['media_added', 'media_shared'].includes(post.post_type) && post.tmdb_id && userId === post.owner_id) {
          const noteResult = await executeQuery(
            `SELECT li.personal_note 
             FROM list_items li
             JOIN custom_lists cl ON li.list_id = cl.id
             WHERE cl.user_id = ? AND li.tmdb_id = ? AND li.media_type = ?
             AND li.personal_note IS NOT NULL AND li.personal_note != ''
             LIMIT 1`,
            [post.owner_id, post.tmdb_id, post.media_type]
          );
          
          if (noteResult.success && noteResult.data.length > 0) {
            personalNote = noteResult.data[0].personal_note;
          }
        }

        // Для media_shared постов без рейтинга — подтягиваем оценку автора
        let postRating = post.rating;
        if (post.post_type === 'media_shared' && !postRating && post.tmdb_id) {
          const ratingResult = await executeQuery(
            `SELECT rating FROM ratings WHERE user_id = ? AND tmdb_id = ? AND media_type = ?`,
            [post.user_id, post.tmdb_id, post.media_type]
          );
          if (ratingResult.success && ratingResult.data.length > 0) {
            postRating = ratingResult.data[0].rating;
          }
        }

        // Получаем название медиа для постов с tmdbId
        let mediaTitle = null;
        if (post.tmdb_id && post.media_type) {
          try {
            const mediaDetails = await mediaCacheService.getOrFetch(post.tmdb_id, post.media_type);
            mediaTitle = mediaDetails.title || mediaDetails.name || null;
          } catch (e) { /* ignore */ }
        }

        return {
          id: post.id,
          userId: post.user_id,
          postType: post.post_type,
          content: post.content,
          tmdbId: post.tmdb_id,
          mediaType: post.media_type,
          mediaTitle,
          posterPath: post.poster_path,
          listId: post.list_id,
          rating: postRating,
          createdAt: post.created_at,
          editedAt: post.edited_at,
          commentsCount,
          userListName,
          personalNote,
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

    // Получаем рекламные посты (скрываем отложенные)
    const adResult = await executeQuery(
      `SELECT ap.*, u.display_name, u.avatar_url
       FROM advertising_posts ap
       LEFT JOIN users u ON ap.created_by = u.id
       WHERE ap.scheduled_at IS NULL OR ap.scheduled_at <= datetime('now')
       ORDER BY ap.created_at DESC`
    );

    const adPosts = [];
    if (adResult.success) {
      for (const a of adResult.data) {
        // Если pin_duration > 0, проверяем — показано ли уже достаточно постов после рекламы
        if (a.pin_duration > 0) {
          const postsSinceAd = await executeQuery(
            `SELECT COUNT(*) as cnt FROM wall_posts WHERE created_at > ?`,
            [a.created_at]
          );
          if (postsSinceAd.success && postsSinceAd.data[0].cnt >= a.pin_duration) {
            // Если автоудаление включено для этого поста и повторы исчерпаны — удаляем
            if (a.auto_delete && a.repeat_count <= 0) {
              const imageUrls = JSON.parse(a.image_urls || '[]');
              const fs = await import('fs/promises');
              const path = await import('path');
              for (const imageUrl of imageUrls) {
                await fs.unlink(path.join(process.cwd(), imageUrl)).catch(() => {});
              }
              await executeQuery('DELETE FROM advertising_posts WHERE id = ?', [a.id]);
              console.log(`🗑️ Автоудаление поста ${a.id} (pin_duration истёк)`);
            }
            continue;
          }
        }

        adPosts.push({
          id: a.id,
          userId: a.created_by,
          postType: 'advertising',
          content: a.content,
          linkUrl: a.link_url,
          linkLabel: a.link_label,
          imageUrls: a.image_urls ? JSON.parse(a.image_urls) : [],
          createdAt: a.created_at,
          editedAt: null,
          author: {
            displayName: a.display_name,
            avatarUrl: a.avatar_url
          },
          reactions: [],
          isAdvertising: true
        });
      }
    }

    // Объявления и реклама добавляем только на первой странице (offset=0)
    let allPosts = postsWithReactions;
    if (offset === 0) {
      // Объединяем объявления, рекламу и посты, сортируем по дате
      allPosts = [...announcementPosts, ...adPosts, ...postsWithReactions]
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
