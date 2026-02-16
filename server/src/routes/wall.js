import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
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

    // Получаем все записи стены пользователя
    const postsResult = await executeQuery(
      `SELECT * FROM wall_posts 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
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
          rating: post.rating,
          createdAt: post.created_at,
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
 * POST /api/wall
 * Создать новую запись на стене
 * 
 * Body:
 * - postType: 'text' | 'media_added' | 'rating' | 'review' (обязательно)
 * - content: string (опционально, обязательно для text и review)
 * - tmdbId: number (опционально, обязательно для media_added, rating, review)
 * - mediaType: 'movie' | 'tv' (опционально, обязательно для media_added, rating, review)
 * - rating: number 1-10 (опционально, обязательно для rating)
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { postType, content, tmdbId, mediaType, rating } = req.body;

    // Валидация postType
    const validPostTypes = ['text', 'media_added', 'rating', 'review'];
    if (!postType || !validPostTypes.includes(postType)) {
      return res.status(400).json({ 
        error: 'postType должен быть одним из: text, media_added, rating, review',
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
    const postId = uuidv4();
    const insertResult = await executeQuery(
      `INSERT INTO wall_posts (id, user_id, post_type, content, tmdb_id, media_type, rating)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [postId, userId, postType, content || null, tmdbId || null, mediaType || null, rating || null]
    );

    if (!insertResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка создания записи на стене',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем созданную запись
    const postResult = await executeQuery(
      'SELECT * FROM wall_posts WHERE id = ?',
      [postId]
    );

    if (!postResult.success || postResult.data.length === 0) {
      return res.status(500).json({ 
        error: 'Ошибка получения созданной записи',
        code: 'DATABASE_ERROR' 
      });
    }

    const post = postResult.data[0];

    res.status(201).json({
      id: post.id,
      userId: post.user_id,
      postType: post.post_type,
      content: post.content,
      tmdbId: post.tmdb_id,
      mediaType: post.media_type,
      rating: post.rating,
      createdAt: post.created_at,
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

    if (post.user_id !== userId) {
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

      // Создаем уведомление для владельца поста (если это не он сам)
      if (post.user_id !== userId) {
        // Отправляем уведомление через notificationService
        // Не блокируем ответ, если уведомление не отправится
        notifyReaction(post.user_id, userId, emoji, postId).catch(err => {
          console.error('Ошибка отправки уведомления о реакции:', err);
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
