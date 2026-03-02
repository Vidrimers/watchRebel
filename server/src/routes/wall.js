import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../database/db.js';
import { authenticateToken, checkPostBan } from '../middleware/auth.js';
import { notifyReaction } from '../services/notificationService.js';

const router = express.Router();

/**
 * GET /api/wall/:userId
 * Получить все записи стены пользователя
 * Записи отсортированы в хронологическом порядке (новые сверху)
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Получаем информацию о владельце стены
    const wallOwnerResult = await executeQuery(
      'SELECT id, display_name, avatar_url, telegram_username FROM users WHERE id = ?',
      [userId]
    );

    if (!wallOwnerResult.success || wallOwnerResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND' 
      });
    }

    const wallOwner = wallOwnerResult.data[0];

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
          tmdbId: post.tmdb_id,
          mediaType: post.media_type,
          posterPath: post.poster_path,
          listId: post.list_id,
          rating: post.rating,
          createdAt: post.created_at,
          editedAt: post.edited_at,
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
          reactions
        };
      })
    );

    res.json(postsWithReactions);

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
      }))
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
    if (postType === 'text' && (!content || content.trim() === '')) {
      return res.status(400).json({ 
        error: 'content обязателен для текстовых постов',
        code: 'MISSING_CONTENT' 
      });
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
      `INSERT INTO wall_posts (id, user_id, wall_owner_id, post_type, content, tmdb_id, media_type, rating)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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

export default router;
