import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../database/db.js';
import { authenticateToken, optionalAuth, checkPostBan } from '../middleware/auth.js';
import { notifyReaction } from '../services/notificationService.js';
import { uploadPostImages, uploadCommentImage } from '../middleware/upload.js';
import { compressImage, isValidImageType } from '../utils/imageProcessor.js';
import path from 'path';

const router = express.Router();

/**
 * GET /api/wall/:userId
 * Получить все записи стены пользователя
 * Записи отсортированы в хронологическом порядке (новые сверху)
 * Закрепленный пост отображается первым с флагом isPinned: true
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Получаем информацию о владельце стены и его закрепленном посте
    const wallOwnerResult = await executeQuery(
      'SELECT id, display_name, avatar_url, telegram_username, pinned_post_id FROM users WHERE id = ?',
      [userId]
    );

    if (!wallOwnerResult.success || wallOwnerResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND' 
      });
    }

    const wallOwner = wallOwnerResult.data[0];
    const pinnedPostId = wallOwner.pinned_post_id;

    // Получаем все записи стены пользователя с информацией об авторе
    const postsResult = await executeQuery(
      `SELECT 
        wp.*,
        author.id as author_id,
        author.display_name as author_display_name,
        author.avatar_url as author_avatar_url,
        author.telegram_username as author_telegram_username
       FROM wall_posts wp
       LEFT JOIN users author ON wp.user_id = author.id
       WHERE wp.wall_owner_id = ? 
       ORDER BY wp.created_at DESC`,
      [userId]
    );

    if (!postsResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения записей стены',
        code: 'DATABASE_ERROR' 
      });
    }

    // Для каждого поста получаем реакции и изображения
    const postsWithReactions = await Promise.all(
      postsResult.data.map(async (post) => {
        // Получаем реакции
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

        // Определяем, является ли пост закрепленным
        const isPinned = pinnedPostId && post.id === pinnedPostId;

        return {
          id: post.id,
          userId: post.user_id,
          postType: post.post_type,
          content: post.content,
          tmdbId: post.tmdb_id,
          mediaType: post.media_type,
          posterPath: post.poster_path,
          listId: post.list_id,
          rating: post.rating,
          createdAt: post.created_at,
          editedAt: post.edited_at,
          isPinned, // Добавляем флаг закрепленного поста
          author: {
            id: post.author_id,
            displayName: post.author_display_name,
            avatarUrl: post.author_avatar_url,
            telegramUsername: post.author_telegram_username
          },
          wallOwner: {
            id: wallOwner.id,
            displayName: wallOwner.display_name,
            avatarUrl: wallOwner.avatar_url
          },
          reactions,
          images // Добавляем массив изображений
        };
      })
    );

    // Сортируем посты: закрепленный первым, затем остальные по дате
    const sortedPosts = postsWithReactions.sort((a, b) => {
      // Закрепленный пост всегда первый
      if (a.isPinned) return -1;
      if (b.isPinned) return 1;
      
      // Остальные по дате (уже отсортированы в SQL, но на всякий случай)
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json(sortedPosts);

  } catch (error) {
    console.error('Ошибка получения стены:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/wall/post/:postId
 * Получить отдельный пост по ID
 * Используется для модального окна при переходе из уведомлений
 */
router.get('/post/:postId', async (req, res) => {
  try {
    const { postId } = req.params;

    // Получаем пост с информацией об авторе и владельце стены
    const postResult = await executeQuery(
      `SELECT 
        wp.*,
        author.id as author_id,
        author.display_name as author_display_name,
        author.avatar_url as author_avatar_url,
        author.telegram_username as author_telegram_username,
        owner.id as wall_owner_id,
        owner.display_name as wall_owner_display_name,
        owner.avatar_url as wall_owner_avatar_url
       FROM wall_posts wp
       LEFT JOIN users author ON wp.user_id = author.id
       LEFT JOIN users owner ON wp.wall_owner_id = owner.id
       WHERE wp.id = ?`,
      [postId]
    );

    if (!postResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения поста',
        code: 'DATABASE_ERROR' 
      });
    }

    if (postResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Пост не найден',
        code: 'POST_NOT_FOUND' 
      });
    }

    const post = postResult.data[0];

    // Получаем реакции для поста
    const reactionsResult = await executeQuery(
      `SELECT r.*, u.display_name, u.avatar_url 
       FROM reactions r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.post_id = ?
       ORDER BY r.created_at DESC`,
      [postId]
    );

    const reactions = reactionsResult.success ? reactionsResult.data : [];

    // Получаем изображения поста
    const imagesResult = await executeQuery(
      `SELECT id, image_url, "order" 
       FROM post_images 
       WHERE post_id = ? 
       ORDER BY "order" ASC`,
      [postId]
    );

    const images = imagesResult.success ? imagesResult.data.map(img => ({
      id: img.id,
      url: img.image_url,
      order: img.order
    })) : [];

    // Формируем ответ
    const formattedPost = {
      id: post.id,
      userId: post.user_id,
      wallOwnerId: post.wall_owner_id,
      postType: post.post_type,
      content: post.content,
      tmdbId: post.tmdb_id,
      mediaType: post.media_type,
      posterPath: post.poster_path,
      listId: post.list_id,
      rating: post.rating,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      author: {
        id: post.author_id,
        displayName: post.author_display_name,
        avatarUrl: post.author_avatar_url,
        telegramUsername: post.author_telegram_username
      },
      wallOwner: {
        id: post.wall_owner_id,
        displayName: post.wall_owner_display_name,
        avatarUrl: post.wall_owner_avatar_url
      },
      reactions: reactions.map(r => ({
        id: r.id,
        userId: r.user_id,
        emoji: r.emoji,
        createdAt: r.created_at,
        user: {
          displayName: r.display_name,
          avatarUrl: r.avatar_url
        }
      })),
      images // Добавляем массив изображений
    };

    res.json(formattedPost);

  } catch (error) {
    console.error('Ошибка получения поста:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/wall
 * Создать новую запись на стене
 * 
 * Body:
 * - postType: 'text' | 'media_added' | 'rating' | 'review' (обязательно)
 * - content: string (опционально, обязательно для text и review)
 * - tmdbId: number (опционально, обязательно для media_added, rating, review)
 * - mediaType: 'movie' | 'tv' (опционально, обязательно для media_added, rating, review)
 * - rating: number 1-10 (опционально, обязательно для rating)
 * - targetUserId: string (опционально, ID пользователя на чьей стене публикуем)
 */
router.post('/', authenticateToken, checkPostBan, async (req, res) => {
  try {
    const userId = req.user.id;
    const { postType, content, tmdbId, mediaType, rating, targetUserId } = req.body;

    // Определяем на чьей стене публикуем
    const wallOwnerId = targetUserId || userId;

    // Если публикуем на чужой стене, проверяем права
    if (targetUserId && targetUserId !== userId) {
      // Получаем настройки приватности целевого пользователя
      const targetUserResult = await executeQuery(
        'SELECT wall_privacy FROM users WHERE id = ?',
        [targetUserId]
      );

      if (!targetUserResult.success || targetUserResult.data.length === 0) {
        return res.status(404).json({ 
          error: 'Пользователь не найден',
          code: 'USER_NOT_FOUND' 
        });
      }

      const wallPrivacy = targetUserResult.data[0].wall_privacy || 'all';

      // Проверяем права в зависимости от настройки приватности
      if (wallPrivacy === 'none') {
        return res.status(403).json({ 
          error: 'Пользователь запретил публикации на своей стене',
          code: 'WALL_PRIVACY_NONE' 
        });
      }

      if (wallPrivacy === 'friends') {
        // Проверяем, являются ли пользователи друзьями
        const friendshipCheck = await executeQuery(
          `SELECT * FROM friends 
           WHERE (user_id = ? AND friend_id = ?) 
           OR (user_id = ? AND friend_id = ?)`,
          [userId, targetUserId, targetUserId, userId]
        );

        if (!friendshipCheck.success) {
          return res.status(500).json({ 
            error: 'Ошибка проверки дружбы',
            code: 'DATABASE_ERROR' 
          });
        }

        if (friendshipCheck.data.length === 0) {
          return res.status(403).json({ 
            error: 'Только друзья могут писать на стене этого пользователя',
            code: 'WALL_PRIVACY_FRIENDS_ONLY' 
          });
        }
      }
    }

    // Валидация postType
    const validPostTypes = ['text', 'media_added', 'rating', 'review', 'status_update'];
    if (!postType || !validPostTypes.includes(postType)) {
      return res.status(400).json({ 
        error: 'postType должен быть одним из: text, media_added, rating, review, status_update',
        code: 'INVALID_POST_TYPE' 
      });
    }

    // Валидация для текстовых постов
    if (postType === 'text') {
      // Для текстовых постов content может быть пустым, если будут добавлены изображения
      // Разрешаем null, undefined или отсутствие content
      // Запрещаем только явно пустую строку после trim
      if (content !== null && content !== undefined && content.trim() === '') {
        return res.status(400).json({ 
          error: 'content не может быть пустой строкой',
          code: 'EMPTY_CONTENT' 
        });
      }
    }

    // Валидация для статусных постов
    if (postType === 'status_update' && (!content || content.trim() === '')) {
      return res.status(400).json({ 
        error: 'content обязателен для статусных постов',
        code: 'MISSING_CONTENT' 
      });
    }

    // Валидация для постов с медиа
    if (['media_added', 'rating', 'review'].includes(postType)) {
      if (!tmdbId || typeof tmdbId !== 'number') {
        return res.status(400).json({ 
          error: 'tmdbId обязателен для постов с медиа',
          code: 'MISSING_TMDB_ID' 
        });
      }

      if (!mediaType || (mediaType !== 'movie' && mediaType !== 'tv')) {
        return res.status(400).json({ 
          error: 'mediaType должен быть "movie" или "tv"',
          code: 'INVALID_MEDIA_TYPE' 
        });
      }
    }

    // Валидация для рейтингов
    if (postType === 'rating') {
      if (!rating || typeof rating !== 'number' || rating < 1 || rating > 10) {
        return res.status(400).json({ 
          error: 'rating должен быть числом от 1 до 10',
          code: 'INVALID_RATING' 
        });
      }
    }

    // Валидация для отзывов
    if (postType === 'review' && (!content || content.trim() === '')) {
      return res.status(400).json({ 
        error: 'content обязателен для отзывов',
        code: 'MISSING_CONTENT' 
      });
    }

    // Создаем запись на стене
    // ВАЖНО: user_id - это АВТОР поста (кто написал)
    //        wall_owner_id - это владелец стены (на чьей стене)
    const postId = uuidv4();
    const insertResult = await executeQuery(
      `INSERT INTO wall_posts (id, user_id, wall_owner_id, post_type, content, tmdb_id, media_type, rating, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
      [postId, userId, wallOwnerId, postType, content || null, tmdbId || null, mediaType || null, rating || null]
    );

    if (!insertResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка создания записи на стене',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем созданную запись с информацией об авторе и владельце стены
    const postResult = await executeQuery(
      `SELECT 
        wp.*,
        author.id as author_id,
        author.display_name as author_display_name,
        author.avatar_url as author_avatar_url,
        author.telegram_username as author_telegram_username,
        owner.id as owner_id,
        owner.display_name as owner_display_name,
        owner.avatar_url as owner_avatar_url
       FROM wall_posts wp
       LEFT JOIN users author ON wp.user_id = author.id
       LEFT JOIN users owner ON wp.wall_owner_id = owner.id
       WHERE wp.id = ?`,
      [postId]
    );

    if (!postResult.success || postResult.data.length === 0) {
      return res.status(500).json({ 
        error: 'Ошибка получения созданной записи',
        code: 'DATABASE_ERROR' 
      });
    }

    const post = postResult.data[0];

    // Если пост создан на чужой стене, отправляем уведомление владельцу
    if (targetUserId && targetUserId !== userId) {
      // Импортируем функцию уведомлений
      const { notifyWallPost } = await import('../services/notificationService.js');
      
      notifyWallPost(targetUserId, userId, postId).catch(err => {
        console.error('Ошибка отправки уведомления о посте на стене:', err);
      });
    }

    res.status(201).json({
      id: post.id,
      userId: post.user_id,
      postType: post.post_type,
      content: post.content,
      tmdbId: post.tmdb_id,
      mediaType: post.media_type,
      posterPath: post.poster_path,
      listId: post.list_id,
      rating: post.rating,
      createdAt: post.created_at,
      author: {
        id: post.author_id,
        displayName: post.author_display_name,
        avatarUrl: post.author_avatar_url,
        telegramUsername: post.author_telegram_username
      },
      wallOwner: {
        id: post.owner_id,
        displayName: post.owner_display_name,
        avatarUrl: post.owner_avatar_url
      },
      reactions: []
    });

  } catch (error) {
    console.error('Ошибка создания записи на стене:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * PUT /api/wall/:postId
 * Редактировать пост
 * Только владелец поста может его редактировать
 * Можно редактировать только в течение 1 часа после создания
 */
router.put('/:postId', authenticateToken, checkPostBan, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    const { content } = req.body;

    // Проверяем, существует ли пост и принадлежит ли он пользователю
    const postCheck = await executeQuery(
      'SELECT * FROM wall_posts WHERE id = ?',
      [postId]
    );

    if (!postCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки записи',
        code: 'DATABASE_ERROR' 
      });
    }

    if (postCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Запись не найдена',
        code: 'POST_NOT_FOUND' 
      });
    }

    const post = postCheck.data[0];

    if (post.user_id !== userId) {
      return res.status(403).json({ 
        error: 'Нет прав на редактирование этой записи',
        code: 'FORBIDDEN' 
      });
    }

    // Проверяем, прошло ли больше часа с момента создания
    const createdAt = new Date(post.created_at);
    const now = new Date();
    const hourInMs = 60 * 60 * 1000;
    
    if (now - createdAt > hourInMs) {
      return res.status(403).json({ 
        error: 'Редактирование возможно только в течение часа после создания',
        code: 'EDIT_TIME_EXPIRED' 
      });
    }

    // Валидация контента
    if (!content || content.trim() === '') {
      return res.status(400).json({ 
        error: 'Контент не может быть пустым',
        code: 'EMPTY_CONTENT' 
      });
    }

    // Обновляем пост
    const updateResult = await executeQuery(
      "UPDATE wall_posts SET content = ?, edited_at = datetime('now', 'localtime') WHERE id = ?",
      [content.trim(), postId]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка обновления записи',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем обновленный пост с информацией об авторе и владельце стены
    const updatedPostResult = await executeQuery(
      `SELECT 
        wp.*,
        author.id as author_id,
        author.display_name as author_display_name,
        author.avatar_url as author_avatar_url,
        author.telegram_username as author_telegram_username,
        owner.id as owner_id,
        owner.display_name as owner_display_name,
        owner.avatar_url as owner_avatar_url
       FROM wall_posts wp
       LEFT JOIN users author ON wp.user_id = author.id
       LEFT JOIN users owner ON wp.wall_owner_id = owner.id
       WHERE wp.id = ?`,
      [postId]
    );

    if (!updatedPostResult.success || updatedPostResult.data.length === 0) {
      return res.status(500).json({ 
        error: 'Ошибка получения обновленной записи',
        code: 'DATABASE_ERROR' 
      });
    }

    const updatedPost = updatedPostResult.data[0];

    res.json({
      id: updatedPost.id,
      userId: updatedPost.user_id,
      postType: updatedPost.post_type,
      content: updatedPost.content,
      tmdbId: updatedPost.tmdb_id,
      mediaType: updatedPost.media_type,
      rating: updatedPost.rating,
      createdAt: updatedPost.created_at,
      editedAt: updatedPost.edited_at,
      author: {
        id: updatedPost.author_id,
        displayName: updatedPost.author_display_name,
        avatarUrl: updatedPost.author_avatar_url,
        telegramUsername: updatedPost.author_telegram_username
      },
      wallOwner: {
        id: updatedPost.owner_id,
        displayName: updatedPost.owner_display_name,
        avatarUrl: updatedPost.owner_avatar_url
      },
      reactions: []
    });

  } catch (error) {
    console.error('Ошибка редактирования записи на стене:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * DELETE /api/wall/:postId
 * Удалить запись со стены
 * Только владелец записи может ее удалить
 */
router.delete('/:postId', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // Проверяем, существует ли пост и принадлежит ли он пользователю
    const postCheck = await executeQuery(
      'SELECT * FROM wall_posts WHERE id = ?',
      [postId]
    );

    if (!postCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки записи',
        code: 'DATABASE_ERROR' 
      });
    }

    if (postCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Запись не найдена',
        code: 'POST_NOT_FOUND' 
      });
    }

    const post = postCheck.data[0];

    // Автор поста может удалить свой пост на любой стене
    // Владелец стены может удалить любой пост на своей стене
    if (post.user_id !== userId && post.wall_owner_id !== userId) {
      return res.status(403).json({ 
        error: 'Нет прав на удаление этой записи',
        code: 'FORBIDDEN' 
      });
    }

    // Удаляем запись (реакции удалятся автоматически благодаря ON DELETE CASCADE)
    const deleteResult = await executeQuery(
      'DELETE FROM wall_posts WHERE id = ?',
      [postId]
    );

    if (!deleteResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка удаления записи',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json({ 
      message: 'Запись успешно удалена',
      postId 
    });

  } catch (error) {
    console.error('Ошибка удаления записи со стены:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/wall/:postId/reactions
 * Добавить реакцию на запись
 * 
 * Body:
 * - emoji: string (обязательно)
 */
router.post('/:postId/reactions', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    const { emoji } = req.body;

    // Валидация emoji
    if (!emoji || typeof emoji !== 'string' || emoji.trim() === '') {
      return res.status(400).json({ 
        error: 'emoji обязателен',
        code: 'MISSING_EMOJI' 
      });
    }

    // Проверяем, существует ли пост
    const postCheck = await executeQuery(
      'SELECT * FROM wall_posts WHERE id = ?',
      [postId]
    );

    if (!postCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки записи',
        code: 'DATABASE_ERROR' 
      });
    }

    if (postCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Запись не найдена',
        code: 'POST_NOT_FOUND' 
      });
    }

    const post = postCheck.data[0];

    // Проверяем, есть ли уже реакция от этого пользователя на этот пост
    const existingReactionCheck = await executeQuery(
      'SELECT * FROM reactions WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );

    if (!existingReactionCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки существующей реакции',
        code: 'DATABASE_ERROR' 
      });
    }

    let reactionId;

    if (existingReactionCheck.data.length > 0) {
      // Обновляем существующую реакцию
      reactionId = existingReactionCheck.data[0].id;
      
      const updateResult = await executeQuery(
        'UPDATE reactions SET emoji = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?',
        [emoji, reactionId]
      );

      if (!updateResult.success) {
        return res.status(500).json({ 
          error: 'Ошибка обновления реакции',
          code: 'DATABASE_ERROR' 
        });
      }
    } else {
      // Создаем новую реакцию
      reactionId = uuidv4();

      const insertResult = await executeQuery(
        'INSERT INTO reactions (id, post_id, user_id, emoji) VALUES (?, ?, ?, ?)',
        [reactionId, postId, userId, emoji]
      );

      if (!insertResult.success) {
        return res.status(500).json({ 
          error: 'Ошибка создания реакции',
          code: 'DATABASE_ERROR' 
        });
      }

      // Создаем уведомление для владельца поста
      if (post.user_id !== userId) {
        // Обычное уведомление о реакции от другого пользователя
        notifyReaction(post.user_id, userId, emoji, postId).catch(err => {
          console.error('Ошибка отправки уведомления о реакции:', err);
        });
      } else {
        // Уведомление о самолайке
        notifyReaction(post.user_id, userId, emoji, postId, true).catch(err => {
          console.error('Ошибка отправки уведомления о самолайке:', err);
        });
      }
    }

    // Получаем созданную/обновленную реакцию с информацией о пользователе
    const reactionResult = await executeQuery(
      `SELECT r.*, u.display_name, u.avatar_url 
       FROM reactions r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.id = ?`,
      [reactionId]
    );

    if (!reactionResult.success || reactionResult.data.length === 0) {
      return res.status(500).json({ 
        error: 'Ошибка получения реакции',
        code: 'DATABASE_ERROR' 
      });
    }

    const reaction = reactionResult.data[0];

    res.status(201).json({
      id: reaction.id,
      postId: reaction.post_id,
      userId: reaction.user_id,
      emoji: reaction.emoji,
      createdAt: reaction.created_at,
      user: {
        displayName: reaction.display_name,
        avatarUrl: reaction.avatar_url
      }
    });

  } catch (error) {
    console.error('Ошибка добавления реакции:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * DELETE /api/wall/:postId/reactions/:reactionId
 * Удалить реакцию
 * Только владелец реакции может ее удалить
 */
router.delete('/:postId/reactions/:reactionId', authenticateToken, async (req, res) => {
  try {
    const { postId, reactionId } = req.params;
    const userId = req.user.id;

    // Проверяем, существует ли реакция и принадлежит ли она пользователю
    const reactionCheck = await executeQuery(
      'SELECT * FROM reactions WHERE id = ? AND post_id = ?',
      [reactionId, postId]
    );

    if (!reactionCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки реакции',
        code: 'DATABASE_ERROR' 
      });
    }

    if (reactionCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Реакция не найдена',
        code: 'REACTION_NOT_FOUND' 
      });
    }

    const reaction = reactionCheck.data[0];

    if (reaction.user_id !== userId) {
      return res.status(403).json({ 
        error: 'Нет прав на удаление этой реакции',
        code: 'FORBIDDEN' 
      });
    }

    // Удаляем реакцию
    const deleteResult = await executeQuery(
      'DELETE FROM reactions WHERE id = ?',
      [reactionId]
    );

    if (!deleteResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка удаления реакции',
        code: 'DATABASE_ERROR' 
      });
    }

    // Удаляем связанные уведомления о реакции
    // (пока нет CASCADE в БД, делаем вручную)
    await executeQuery(
      `DELETE FROM notifications 
       WHERE type = 'reaction' 
       AND related_post_id = ? 
       AND related_user_id = ?`,
      [postId, userId]
    );

    res.json({ 
      message: 'Реакция успешно удалена',
      reactionId 
    });

  } catch (error) {
    console.error('Ошибка удаления реакции:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/wall/:postId/pin
 * Закрепить пост на стене
 * Только владелец стены может закрепить пост
 */
router.post('/:postId/pin', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // Проверяем, существует ли пост
    const postCheck = await executeQuery(
      'SELECT * FROM wall_posts WHERE id = ?',
      [postId]
    );

    if (!postCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки записи',
        code: 'DATABASE_ERROR' 
      });
    }

    if (postCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Запись не найдена',
        code: 'POST_NOT_FOUND' 
      });
    }

    const post = postCheck.data[0];

    // Проверяем, что пользователь - владелец стены
    if (post.wall_owner_id !== userId) {
      return res.status(403).json({ 
        error: 'Только владелец стены может закрепить пост',
        code: 'FORBIDDEN' 
      });
    }

    // Обновляем pinned_post_id в таблице users
    const updateResult = await executeQuery(
      'UPDATE users SET pinned_post_id = ? WHERE id = ?',
      [postId, userId]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка закрепления поста',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json({ 
      message: 'Пост успешно закреплен',
      postId,
      pinnedPostId: postId
    });

  } catch (error) {
    console.error('Ошибка закрепления поста:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * DELETE /api/wall/:postId/unpin
 * Открепить пост от стены
 * Только владелец стены может открепить пост
 */
router.delete('/:postId/unpin', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // Проверяем, что этот пост действительно закреплен у пользователя
    const userCheck = await executeQuery(
      'SELECT pinned_post_id FROM users WHERE id = ?',
      [userId]
    );

    if (!userCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки пользователя',
        code: 'DATABASE_ERROR' 
      });
    }

    if (userCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND' 
      });
    }

    const user = userCheck.data[0];

    if (user.pinned_post_id !== postId) {
      return res.status(400).json({ 
        error: 'Этот пост не закреплен',
        code: 'POST_NOT_PINNED' 
      });
    }

    // Открепляем пост (устанавливаем pinned_post_id в NULL)
    const updateResult = await executeQuery(
      'UPDATE users SET pinned_post_id = NULL WHERE id = ?',
      [userId]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка открепления поста',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json({ 
      message: 'Пост успешно откреплен',
      postId
    });

  } catch (error) {
    console.error('Ошибка открепления поста:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/wall/images
 * Загрузить изображения для поста
 * Принимает до 10 изображений
 * Автоматически сжимает изображения больше 3MB
 * 
 * Body (multipart/form-data):
 * - images: File[] (до 10 файлов)
 * - postId: string (ID поста, к которому прикрепляются изображения)
 * 
 * Returns: массив URL загруженных изображений
 */
router.post('/images', authenticateToken, uploadPostImages.array('images', 10), async (req, res) => {
  try {
    const userId = req.user.id;
    const { postId } = req.body;

    // Проверяем наличие файлов
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        error: 'Не загружено ни одного изображения',
        code: 'NO_FILES' 
      });
    }

    // Проверяем наличие postId
    if (!postId) {
      return res.status(400).json({ 
        error: 'postId обязателен',
        code: 'MISSING_POST_ID' 
      });
    }

    // Проверяем, что пост существует и принадлежит пользователю
    const postCheck = await executeQuery(
      'SELECT * FROM wall_posts WHERE id = ? AND user_id = ?',
      [postId, userId]
    );

    if (!postCheck.success || postCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Пост не найден или не принадлежит пользователю',
        code: 'POST_NOT_FOUND' 
      });
    }

    // Валидация типов файлов
    for (const file of req.files) {
      if (!isValidImageType(file.mimetype)) {
        return res.status(400).json({ 
          error: `Недопустимый тип файла: ${file.originalname}. Разрешены только jpg, jpeg, png, gif, webp`,
          code: 'INVALID_FILE_TYPE' 
        });
      }
    }

    console.log(`📤 Загружено ${req.files.length} изображений для поста ${postId}`);

    // Обрабатываем каждое изображение
    const processedImages = [];
    
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      
      try {
        // Сжимаем изображение если нужно
        const processedPath = await compressImage(file.path, 3);
        
        // Получаем относительный путь для сохранения в БД
        const relativePath = `/uploads/images/${path.basename(processedPath)}`;
        
        // Сохраняем информацию об изображении в БД
        const imageId = uuidv4();
        const insertResult = await executeQuery(
          `INSERT INTO post_images (id, post_id, image_url, "order", created_at)
           VALUES (?, ?, ?, ?, datetime('now', 'localtime'))`,
          [imageId, postId, relativePath, i]
        );

        if (!insertResult.success) {
          console.error('Ошибка сохранения изображения в БД:', insertResult.error);
          continue;
        }

        processedImages.push({
          id: imageId,
          url: relativePath,
          order: i
        });

        console.log(`✅ Изображение ${i + 1}/${req.files.length} обработано: ${relativePath}`);
      } catch (error) {
        console.error(`Ошибка обработки изображения ${file.originalname}:`, error);
        // Продолжаем обработку остальных файлов
      }
    }

    if (processedImages.length === 0) {
      return res.status(500).json({ 
        error: 'Не удалось обработать ни одного изображения',
        code: 'PROCESSING_FAILED' 
      });
    }

    console.log(`✅ Успешно загружено ${processedImages.length} изображений`);

    // Проверяем, загружены ли изображения на чужую стену
    const post = postCheck.data[0];
    if (post.wall_owner_id && post.wall_owner_id !== userId) {
      // Отправляем уведомление владельцу стены
      const { notifyWallPostImages } = await import('../services/notificationService.js');
      
      notifyWallPostImages(post.wall_owner_id, userId, postId, processedImages.length).catch(err => {
        console.error('Ошибка отправки уведомления о загрузке изображений:', err);
      });
    }

    res.status(201).json({
      message: `Загружено ${processedImages.length} изображений`,
      images: processedImages
    });

  } catch (error) {
    console.error('Ошибка загрузки изображений:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * DELETE /api/wall/images/:imageId
 * Удалить изображение из поста
 * Только автор поста может удалить изображение
 */
router.delete('/images/:imageId', authenticateToken, async (req, res) => {
  try {
    const { imageId } = req.params;
    const userId = req.user.id;

    // Получаем информацию об изображении и посте
    const imageCheck = await executeQuery(
      `SELECT pi.*, wp.user_id as post_author_id 
       FROM post_images pi
       LEFT JOIN wall_posts wp ON pi.post_id = wp.id
       WHERE pi.id = ?`,
      [imageId]
    );

    if (!imageCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки изображения',
        code: 'DATABASE_ERROR' 
      });
    }

    if (imageCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Изображение не найдено',
        code: 'IMAGE_NOT_FOUND' 
      });
    }

    const image = imageCheck.data[0];

    // Проверяем права (только автор поста может удалить изображение)
    if (image.post_author_id !== userId) {
      return res.status(403).json({ 
        error: 'Нет прав на удаление этого изображения',
        code: 'FORBIDDEN' 
      });
    }

    // Удаляем файл с сервера
    const fs = await import('fs/promises');
    const { fileURLToPath } = await import('url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    const filePath = path.join(__dirname, '../../', image.image_url);
    
    try {
      await fs.unlink(filePath);
      console.log(`🗑️ Файл удален: ${filePath}`);
    } catch (error) {
      console.error('Ошибка удаления файла:', error);
      // Продолжаем удаление из БД даже если файл не найден
    }

    // Удаляем запись из БД
    const deleteResult = await executeQuery(
      'DELETE FROM post_images WHERE id = ?',
      [imageId]
    );

    if (!deleteResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка удаления изображения из БД',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json({ 
      message: 'Изображение успешно удалено',
      imageId 
    });

  } catch (error) {
    console.error('Ошибка удаления изображения:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/wall/:postId/comments
 * Создать комментарий к посту
 * 
 * Body:
 * - content: string (обязательно, максимум 1000 символов)
 * - parent_comment_id: string (опционально, для ответов на комментарии)
 */
router.post('/:postId/comments', authenticateToken, uploadCommentImage.single('image'), async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    const { content, parent_comment_id } = req.body;
    const image = req.file;

    // Валидация: должен быть либо контент, либо изображение
    if ((!content || content.trim() === '') && !image) {
      return res.status(400).json({ 
        error: 'Комментарий должен содержать текст или изображение',
        code: 'EMPTY_COMMENT' 
      });
    }

    // Валидация длины контента (если есть)
    if (content && content.length > 400) {
      return res.status(400).json({ 
        error: 'Комментарий не может быть длиннее 400 символов',
        code: 'CONTENT_TOO_LONG' 
      });
    }

    // Проверяем, существует ли пост
    const postCheck = await executeQuery(
      'SELECT * FROM wall_posts WHERE id = ?',
      [postId]
    );

    if (!postCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки поста',
        code: 'DATABASE_ERROR' 
      });
    }

    if (postCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Пост не найден',
        code: 'POST_NOT_FOUND' 
      });
    }

    const post = postCheck.data[0];

    // Если указан parent_comment_id, проверяем что родительский комментарий существует
    if (parent_comment_id) {
      const parentCheck = await executeQuery(
        'SELECT * FROM post_comments WHERE id = ? AND post_id = ?',
        [parent_comment_id, postId]
      );

      if (!parentCheck.success || parentCheck.data.length === 0) {
        return res.status(404).json({ 
          error: 'Родительский комментарий не найден',
          code: 'PARENT_COMMENT_NOT_FOUND' 
        });
      }
    }

    // Обработка загруженного изображения
    let imageUrl = null;
    if (image) {
      imageUrl = `/uploads/images/${image.filename}`;
    }

    // Создаем комментарий
    const commentId = uuidv4();
    const insertResult = await executeQuery(
      `INSERT INTO post_comments (id, post_id, user_id, parent_comment_id, content, image_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
      [commentId, postId, userId, parent_comment_id || null, content ? content.trim() : '', imageUrl]
    );

    if (!insertResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка создания комментария',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем созданный комментарий с информацией об авторе
    const commentResult = await executeQuery(
      `SELECT 
        pc.*,
        u.id as author_id,
        u.display_name as author_display_name,
        u.avatar_url as author_avatar_url
       FROM post_comments pc
       LEFT JOIN users u ON pc.user_id = u.id
       WHERE pc.id = ?`,
      [commentId]
    );

    if (!commentResult.success || commentResult.data.length === 0) {
      return res.status(500).json({ 
        error: 'Ошибка получения созданного комментария',
        code: 'DATABASE_ERROR' 
      });
    }

    const comment = commentResult.data[0];

    // Отправляем уведомление
    if (parent_comment_id) {
      // Уведомление автору родительского комментария
      const parentCommentResult = await executeQuery(
        'SELECT user_id FROM post_comments WHERE id = ?',
        [parent_comment_id]
      );

      if (parentCommentResult.success && parentCommentResult.data.length > 0) {
        const parentAuthorId = parentCommentResult.data[0].user_id;
        
        // Не отправляем уведомление если отвечаем сами себе
        if (parentAuthorId !== userId) {
          const { notifyPostCommentReply } = await import('../services/notificationService.js');
          notifyPostCommentReply(parentAuthorId, userId, postId, commentId).catch(err => {
            console.error('Ошибка отправки уведомления об ответе на комментарий:', err);
          });
        }
      }
    } else {
      // Уведомление автору поста
      if (post.user_id !== userId) {
        const { notifyPostComment } = await import('../services/notificationService.js');
        notifyPostComment(post.user_id, userId, postId, commentId).catch(err => {
          console.error('Ошибка отправки уведомления о комментарии к посту:', err);
        });
      }
    }

    res.status(201).json({
      id: comment.id,
      postId: comment.post_id,
      userId: comment.user_id,
      parentCommentId: comment.parent_comment_id,
      content: comment.content,
      imageUrl: comment.image_url,
      createdAt: comment.created_at,
      editedAt: comment.edited_at,
      author: {
        id: comment.author_id,
        displayName: comment.author_display_name,
        avatarUrl: comment.author_avatar_url
      }
    });

  } catch (error) {
    console.error('Ошибка создания комментария:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/wall/:postId/comments
 * Получить комментарии к посту с пагинацией
 * Возвращает только комментарии первого уровня (parent_comment_id = null)
 * 
 * Query params:
 * - limit: number (по умолчанию 5)
 * - offset: number (по умолчанию 0)
 * - sortBy: string (по умолчанию 'default')
 *   - 'default': сначала популярные (больше ответов), потом с лайками, потом новые
 *   - 'likes_desc': больше лайков
 *   - 'likes_asc': меньше лайков
 *   - 'newest': сначала новые
 *   - 'oldest': сначала старые
 */
router.get('/:postId/comments', optionalAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const limit = parseInt(req.query.limit) || 5;
    const offset = parseInt(req.query.offset) || 0;
    const sortBy = req.query.sortBy || 'default';

    // Валидация sortBy
    const validSortOptions = ['default', 'likes_desc', 'likes_asc', 'newest', 'oldest'];
    if (!validSortOptions.includes(sortBy)) {
      return res.status(400).json({ 
        error: 'Неверный параметр sortBy',
        code: 'INVALID_SORT_OPTION' 
      });
    }

    // Проверяем, существует ли пост
    const postCheck = await executeQuery(
      'SELECT * FROM wall_posts WHERE id = ?',
      [postId]
    );

    if (!postCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки поста',
        code: 'DATABASE_ERROR' 
      });
    }

    if (postCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Пост не найден',
        code: 'POST_NOT_FOUND' 
      });
    }

    // Получаем общее количество комментариев первого уровня
    const countResult = await executeQuery(
      'SELECT COUNT(*) as total FROM post_comments WHERE post_id = ? AND parent_comment_id IS NULL',
      [postId]
    );

    const total = countResult.success ? countResult.data[0].total : 0;

    // Определяем ORDER BY в зависимости от sortBy
    let orderByClause;
    switch (sortBy) {
      case 'default':
        // Сначала популярные (больше ответов), потом с лайками, потом новые
        orderByClause = 'ORDER BY replies_count DESC, likes_count DESC, pc.created_at DESC';
        break;
      case 'likes_desc':
        // Больше лайков
        orderByClause = 'ORDER BY likes_count DESC, pc.created_at DESC';
        break;
      case 'likes_asc':
        // Меньше лайков
        orderByClause = 'ORDER BY likes_count ASC, pc.created_at DESC';
        break;
      case 'newest':
        // Сначала новые
        orderByClause = 'ORDER BY pc.created_at DESC';
        break;
      case 'oldest':
        // Сначала старые
        orderByClause = 'ORDER BY pc.created_at ASC';
        break;
      default:
        orderByClause = 'ORDER BY replies_count DESC, likes_count DESC, pc.created_at DESC';
    }

    // Получаем комментарии первого уровня с пагинацией
    // Используем подзапросы для получения repliesCount и likesCount
    const commentsResult = await executeQuery(
      `SELECT 
        pc.*,
        u.id as author_id,
        u.display_name as author_display_name,
        u.avatar_url as author_avatar_url,
        (SELECT COUNT(*) FROM post_comments WHERE parent_comment_id = pc.id) as replies_count,
        (SELECT COUNT(*) FROM comment_likes WHERE comment_id = pc.id) as likes_count
       FROM post_comments pc
       LEFT JOIN users u ON pc.user_id = u.id
       WHERE pc.post_id = ? AND pc.parent_comment_id IS NULL
       ${orderByClause}
       LIMIT ? OFFSET ?`,
      [postId, limit, offset]
    );

    if (!commentsResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения комментариев',
        code: 'DATABASE_ERROR' 
      });
    }

    // Для каждого комментария проверяем, лайкнул ли текущий пользователь
    const currentUserId = req.user?.id; // ID текущего пользователя (если авторизован)
    
    const commentsWithLikes = await Promise.all(
      commentsResult.data.map(async (comment) => {
        // Проверяем, лайкнул ли текущий пользователь этот комментарий
        let isLikedByCurrentUser = false;
        if (currentUserId) {
          const likeCheckResult = await executeQuery(
            'SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ?',
            [comment.id, currentUserId]
          );
          isLikedByCurrentUser = likeCheckResult.success && likeCheckResult.data.length > 0;
        }

        return {
          id: comment.id,
          postId: comment.post_id,
          userId: comment.user_id,
          parentCommentId: comment.parent_comment_id,
          content: comment.content,
          imageUrl: comment.image_url,
          createdAt: comment.created_at,
          editedAt: comment.edited_at,
          repliesCount: comment.replies_count,
          likesCount: comment.likes_count,
          isLikedByCurrentUser,
          author: {
            id: comment.author_id,
            displayName: comment.author_display_name,
            avatarUrl: comment.author_avatar_url
          }
        };
      })
    );

    const hasMore = offset + limit < total;

    res.json({
      comments: commentsWithLikes,
      total,
      hasMore,
      limit,
      offset,
      sortBy
    });

  } catch (error) {
    console.error('Ошибка получения комментариев:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/wall/comments/:commentId/replies
 * Получить ответы на комментарий с пагинацией
 * 
 * Query params:
 * - limit: number (по умолчанию 5)
 * - offset: number (по умолчанию 0)
 */
router.get('/comments/:commentId/replies', optionalAuth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const limit = parseInt(req.query.limit) || 5;
    const offset = parseInt(req.query.offset) || 0;

    // Проверяем, существует ли родительский комментарий
    const commentCheck = await executeQuery(
      'SELECT * FROM post_comments WHERE id = ?',
      [commentId]
    );

    if (!commentCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки комментария',
        code: 'DATABASE_ERROR' 
      });
    }

    if (commentCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Комментарий не найден',
        code: 'COMMENT_NOT_FOUND' 
      });
    }

    // Получаем общее количество ответов
    const countResult = await executeQuery(
      'SELECT COUNT(*) as total FROM post_comments WHERE parent_comment_id = ?',
      [commentId]
    );

    const total = countResult.success ? countResult.data[0].total : 0;

    // Получаем ответы с пагинацией
    const repliesResult = await executeQuery(
      `SELECT 
        pc.*,
        u.id as author_id,
        u.display_name as author_display_name,
        u.avatar_url as author_avatar_url
       FROM post_comments pc
       LEFT JOIN users u ON pc.user_id = u.id
       WHERE pc.parent_comment_id = ?
       ORDER BY pc.created_at ASC
       LIMIT ? OFFSET ?`,
      [commentId, limit, offset]
    );

    if (!repliesResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения ответов',
        code: 'DATABASE_ERROR' 
      });
    }

    // Для каждого ответа получаем количество вложенных ответов и лайков
    const currentUserId = req.user?.id; // ID текущего пользователя (если авторизован)
    
    const repliesWithNested = await Promise.all(
      repliesResult.data.map(async (reply) => {
        // Количество вложенных ответов
        const nestedCountResult = await executeQuery(
          'SELECT COUNT(*) as count FROM post_comments WHERE parent_comment_id = ?',
          [reply.id]
        );

        const repliesCount = nestedCountResult.success ? nestedCountResult.data[0].count : 0;

        // Количество лайков
        const likesCountResult = await executeQuery(
          'SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = ?',
          [reply.id]
        );

        const likesCount = likesCountResult.success ? likesCountResult.data[0].count : 0;

        // Проверяем, лайкнул ли текущий пользователь этот ответ
        let isLikedByCurrentUser = false;
        if (currentUserId) {
          const likeCheckResult = await executeQuery(
            'SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ?',
            [reply.id, currentUserId]
          );
          isLikedByCurrentUser = likeCheckResult.success && likeCheckResult.data.length > 0;
        }

        return {
          id: reply.id,
          postId: reply.post_id,
          userId: reply.user_id,
          parentCommentId: reply.parent_comment_id,
          content: reply.content,
          imageUrl: reply.image_url,
          createdAt: reply.created_at,
          editedAt: reply.edited_at,
          repliesCount,
          likesCount,
          isLikedByCurrentUser,
          author: {
            id: reply.author_id,
            displayName: reply.author_display_name,
            avatarUrl: reply.author_avatar_url
          }
        };
      })
    );

    const hasMore = offset + limit < total;

    res.json({
      replies: repliesWithNested,
      total,
      hasMore,
      limit,
      offset
    });

  } catch (error) {
    console.error('Ошибка получения ответов на комментарий:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * PUT /api/wall/comments/:commentId
 * Редактировать комментарий
 * Только автор комментария может его редактировать
 * 
 * Body:
 * - content: string (обязательно, максимум 1000 символов)
 */
router.put('/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    const { content } = req.body;

    // Валидация контента
    if (!content || typeof content !== 'string' || content.trim() === '') {
      return res.status(400).json({ 
        error: 'Контент комментария не может быть пустым',
        code: 'EMPTY_CONTENT' 
      });
    }

    if (content.length > 1000) {
      return res.status(400).json({ 
        error: 'Комментарий не может быть длиннее 1000 символов',
        code: 'CONTENT_TOO_LONG' 
      });
    }

    // Проверяем, существует ли комментарий и принадлежит ли он пользователю
    const commentCheck = await executeQuery(
      'SELECT * FROM post_comments WHERE id = ?',
      [commentId]
    );

    if (!commentCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки комментария',
        code: 'DATABASE_ERROR' 
      });
    }

    if (commentCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Комментарий не найден',
        code: 'COMMENT_NOT_FOUND' 
      });
    }

    const comment = commentCheck.data[0];

    if (comment.user_id !== userId) {
      return res.status(403).json({ 
        error: 'Нет прав на редактирование этого комментария',
        code: 'FORBIDDEN' 
      });
    }

    // Обновляем комментарий
    const updateResult = await executeQuery(
      "UPDATE post_comments SET content = ?, edited_at = datetime('now', 'localtime') WHERE id = ?",
      [content.trim(), commentId]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка обновления комментария',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем обновленный комментарий с информацией об авторе
    const updatedCommentResult = await executeQuery(
      `SELECT 
        pc.*,
        u.id as author_id,
        u.display_name as author_display_name,
        u.avatar_url as author_avatar_url
       FROM post_comments pc
       LEFT JOIN users u ON pc.user_id = u.id
       WHERE pc.id = ?`,
      [commentId]
    );

    if (!updatedCommentResult.success || updatedCommentResult.data.length === 0) {
      return res.status(500).json({ 
        error: 'Ошибка получения обновленного комментария',
        code: 'DATABASE_ERROR' 
      });
    }

    const updatedComment = updatedCommentResult.data[0];

    res.json({
      id: updatedComment.id,
      postId: updatedComment.post_id,
      userId: updatedComment.user_id,
      parentCommentId: updatedComment.parent_comment_id,
      content: updatedComment.content,
      createdAt: updatedComment.created_at,
      editedAt: updatedComment.edited_at,
      author: {
        id: updatedComment.author_id,
        displayName: updatedComment.author_display_name,
        avatarUrl: updatedComment.author_avatar_url
      }
    });

  } catch (error) {
    console.error('Ошибка редактирования комментария:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * DELETE /api/wall/comments/:commentId
 * Удалить комментарий
 * Только автор комментария или владелец поста может удалить комментарий
 * Если есть ответы - заменяет на "[Комментарий удален]"
 * Если нет ответов - удаляет полностью
 */
router.delete('/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    // Получаем комментарий и информацию о посте
    const commentCheck = await executeQuery(
      `SELECT pc.*, wp.user_id as post_author_id 
       FROM post_comments pc
       LEFT JOIN wall_posts wp ON pc.post_id = wp.id
       WHERE pc.id = ?`,
      [commentId]
    );

    if (!commentCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки комментария',
        code: 'DATABASE_ERROR' 
      });
    }

    if (commentCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Комментарий не найден',
        code: 'COMMENT_NOT_FOUND' 
      });
    }

    const comment = commentCheck.data[0];

    // Проверяем права: автор комментария или владелец поста
    if (comment.user_id !== userId && comment.post_author_id !== userId) {
      return res.status(403).json({ 
        error: 'Нет прав на удаление этого комментария',
        code: 'FORBIDDEN' 
      });
    }

    // Проверяем, есть ли ответы на этот комментарий
    const repliesCheck = await executeQuery(
      'SELECT COUNT(*) as count FROM post_comments WHERE parent_comment_id = ?',
      [commentId]
    );

    const hasReplies = repliesCheck.success && repliesCheck.data[0].count > 0;

    if (hasReplies) {
      // Если есть ответы - заменяем контент на "[Комментарий удален]"
      const updateResult = await executeQuery(
        "UPDATE post_comments SET content = '[Комментарий удален]', edited_at = datetime('now', 'localtime') WHERE id = ?",
        [commentId]
      );

      if (!updateResult.success) {
        return res.status(500).json({ 
          error: 'Ошибка обновления комментария',
          code: 'DATABASE_ERROR' 
        });
      }

      res.json({ 
        message: 'Комментарий помечен как удаленный',
        commentId,
        deleted: false,
        replaced: true
      });
    } else {
      // Если нет ответов - удаляем полностью
      const deleteResult = await executeQuery(
        'DELETE FROM post_comments WHERE id = ?',
        [commentId]
      );

      if (!deleteResult.success) {
        return res.status(500).json({ 
          error: 'Ошибка удаления комментария',
          code: 'DATABASE_ERROR' 
        });
      }

      res.json({ 
        message: 'Комментарий успешно удален',
        commentId,
        deleted: true,
        replaced: false
      });
    }

  } catch (error) {
    console.error('Ошибка удаления комментария:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/wall/comments/:commentId/like
 * Добавить/удалить лайк комментария (toggle)
 * Если лайк уже есть - удалить
 * Если лайка нет - добавить
 */
router.post('/comments/:commentId/like', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    // Получаем информацию о комментарии и его авторе
    const commentResult = await executeQuery(
      `SELECT pc.*, u.display_name as author_name
       FROM post_comments pc
       LEFT JOIN users u ON pc.user_id = u.id
       WHERE pc.id = ?`,
      [commentId]
    );

    if (!commentResult.success || commentResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Комментарий не найден',
        code: 'COMMENT_NOT_FOUND' 
      });
    }

    const comment = commentResult.data[0];

    // Проверяем, есть ли уже лайк от этого пользователя
    const existingLikeResult = await executeQuery(
      'SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ?',
      [commentId, userId]
    );

    let liked = false;

    if (existingLikeResult.success && existingLikeResult.data.length > 0) {
      // Лайк уже есть - удаляем (unlike)
      const deleteResult = await executeQuery(
        'DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?',
        [commentId, userId]
      );

      if (!deleteResult.success) {
        return res.status(500).json({ 
          error: 'Ошибка удаления лайка',
          code: 'DATABASE_ERROR' 
        });
      }

      liked = false;
    } else {
      // Лайка нет - добавляем
      const likeId = uuidv4();
      const insertResult = await executeQuery(
        'INSERT INTO comment_likes (id, comment_id, user_id) VALUES (?, ?, ?)',
        [likeId, commentId, userId]
      );

      if (!insertResult.success) {
        return res.status(500).json({ 
          error: 'Ошибка добавления лайка',
          code: 'DATABASE_ERROR' 
        });
      }

      liked = true;

      // Отправляем уведомление автору комментария (если это не он сам)
      if (comment.user_id !== userId) {
        try {
          // Получаем информацию о пользователе, который лайкнул
          const likerResult = await executeQuery(
            'SELECT display_name FROM users WHERE id = ?',
            [userId]
          );

          if (likerResult.success && likerResult.data.length > 0) {
            const likerName = likerResult.data[0].display_name;

            // Создаем уведомление в БД
            const notificationId = uuidv4();
            await executeQuery(
              `INSERT INTO notifications (id, user_id, type, content, related_user_id, related_post_id)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                notificationId,
                comment.user_id,
                'comment_like',
                `${likerName} лайкнул ваш комментарий`,
                userId,
                comment.post_id
              ]
            );
          }
        } catch (notifError) {
          console.error('Ошибка отправки уведомления о лайке комментария:', notifError);
          // Не прерываем выполнение, если уведомление не отправилось
        }
      }
    }

    // Подсчитываем общее количество лайков
    const countResult = await executeQuery(
      'SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = ?',
      [commentId]
    );

    const likesCount = countResult.success ? countResult.data[0].count : 0;

    res.json({ 
      liked,
      likesCount,
      commentId
    });

  } catch (error) {
    console.error('Ошибка обработки лайка комментария:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/wall/comments/:commentId/likes
 * Получить список пользователей, лайкнувших комментарий
 */
router.get('/comments/:commentId/likes', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;

    // Получаем список пользователей, лайкнувших комментарий
    const likesResult = await executeQuery(
      `SELECT u.id, u.display_name as name, u.avatar_url as avatarUrl
       FROM comment_likes cl
       LEFT JOIN users u ON cl.user_id = u.id
       WHERE cl.comment_id = ?
       ORDER BY cl.created_at DESC`,
      [commentId]
    );

    if (!likesResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения лайков',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json({ 
      users: likesResult.data 
    });

  } catch (error) {
    console.error('Ошибка получения списка лайков комментария:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

export default router;

