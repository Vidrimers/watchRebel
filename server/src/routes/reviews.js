import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/reviews
 * Создать отзыв на фильм/сериал
 * 
 * Body:
 * - tmdbId: number (обязательно)
 * - mediaType: 'movie' | 'tv' (обязательно)
 * - reviewText: string (обязательно, минимум 10 символов, максимум 5000)
 * - rating: number 1-10 (опционально)
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { tmdbId, mediaType, reviewText, rating } = req.body;

    // Валидация tmdbId
    if (!tmdbId || typeof tmdbId !== 'number') {
      return res.status(400).json({ 
        error: 'tmdbId обязателен и должен быть числом',
        code: 'INVALID_TMDB_ID' 
      });
    }

    // Валидация mediaType
    if (!mediaType || (mediaType !== 'movie' && mediaType !== 'tv')) {
      return res.status(400).json({ 
        error: 'mediaType должен быть "movie" или "tv"',
        code: 'INVALID_MEDIA_TYPE' 
      });
    }

    // Валидация reviewText
    if (!reviewText || typeof reviewText !== 'string') {
      return res.status(400).json({ 
        error: 'reviewText обязателен',
        code: 'MISSING_REVIEW_TEXT' 
      });
    }

    const trimmedReview = reviewText.trim();

    if (trimmedReview.length < 10) {
      return res.status(400).json({ 
        error: 'Отзыв должен содержать минимум 10 символов',
        code: 'REVIEW_TOO_SHORT' 
      });
    }

    if (trimmedReview.length > 5000) {
      return res.status(400).json({ 
        error: 'Отзыв не может быть длиннее 5000 символов',
        code: 'REVIEW_TOO_LONG' 
      });
    }

    // Валидация rating (опционально)
    if (rating !== undefined && rating !== null) {
      if (typeof rating !== 'number' || rating < 1 || rating > 10) {
        return res.status(400).json({ 
          error: 'rating должен быть числом от 1 до 10',
          code: 'INVALID_RATING' 
        });
      }
    }

    // Проверяем, что фильм/сериал есть в списках пользователя
    const listItemCheck = await executeQuery(
      `SELECT li.*, cl.name as list_name
       FROM list_items li
       JOIN custom_lists cl ON li.list_id = cl.id
       WHERE cl.user_id = ? AND li.tmdb_id = ? AND li.media_type = ?
       LIMIT 1`,
      [userId, tmdbId, mediaType]
    );

    if (!listItemCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки списков',
        code: 'DATABASE_ERROR' 
      });
    }

    if (listItemCheck.data.length === 0) {
      return res.status(400).json({ 
        error: 'Добавьте фильм в список, чтобы написать отзыв',
        code: 'MEDIA_NOT_IN_LIST' 
      });
    }

    // Получаем информацию о фильме/сериале из TMDb
    const tmdbServiceModule = await import('../services/tmdbService.js');
    const tmdbService = tmdbServiceModule.default;
    
    let mediaDetails;
    if (mediaType === 'movie') {
      mediaDetails = await tmdbService.getMovieDetails(tmdbId);
    } else {
      mediaDetails = await tmdbService.getTVDetails(tmdbId);
    }

    if (!mediaDetails) {
      return res.status(404).json({ 
        error: 'Фильм/сериал не найден в TMDb',
        code: 'MEDIA_NOT_FOUND' 
      });
    }

    const title = mediaDetails.title || mediaDetails.name;
    const posterPath = mediaDetails.poster_path;

    // Проверяем, есть ли уже отзыв пользователя на этот фильм
    const existingReviewCheck = await executeQuery(
      `SELECT id FROM wall_posts 
       WHERE user_id = ? AND tmdb_id = ? AND media_type = ? AND post_type = 'review'
       LIMIT 1`,
      [userId, tmdbId, mediaType]
    );

    if (!existingReviewCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки существующего отзыва',
        code: 'DATABASE_ERROR' 
      });
    }

    if (existingReviewCheck.data.length > 0) {
      return res.status(400).json({ 
        error: 'Вы уже написали отзыв на этот фильм/сериал. Используйте редактирование.',
        code: 'REVIEW_ALREADY_EXISTS' 
      });
    }

    // Создаем пост на стене типа 'review'
    // Формат content: первая строка - название фильма, остальное - текст отзыва
    const reviewContent = `${title}\n${trimmedReview}`;
    
    const postId = uuidv4();
    const insertResult = await executeQuery(
      `INSERT INTO wall_posts (
        id, user_id, wall_owner_id, post_type, content, 
        tmdb_id, media_type, poster_path, rating, created_at
      )
      VALUES (?, ?, ?, 'review', ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
      [postId, userId, userId, reviewContent, tmdbId, mediaType, posterPath, rating || null]
    );

    if (!insertResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка создания отзыва',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем созданный пост с информацией об авторе
    const postResult = await executeQuery(
      `SELECT 
        wp.*,
        u.id as author_id,
        u.display_name as author_display_name,
        u.avatar_url as author_avatar_url,
        u.telegram_username as author_telegram_username
       FROM wall_posts wp
       LEFT JOIN users u ON wp.user_id = u.id
       WHERE wp.id = ?`,
      [postId]
    );

    if (!postResult.success || postResult.data.length === 0) {
      return res.status(500).json({ 
        error: 'Ошибка получения созданного отзыва',
        code: 'DATABASE_ERROR' 
      });
    }

    const post = postResult.data[0];

    // Отправляем уведомления друзьям
    const { notifyFriendPostedReview } = await import('../services/notificationService.js');
    notifyFriendPostedReview(userId, tmdbId, mediaType, title, postId).catch(err => {
      console.error('Ошибка отправки уведомлений о новом отзыве:', err);
    });

    // Отправляем WebSocket уведомление о новом посте в ленте
    const { notifyFeedNewPost } = await import('../services/websocketService.js');
    
    const postForFeed = {
      id: post.id,
      userId: post.user_id,
      wallOwnerId: post.wall_owner_id,
      postType: post.post_type,
      content: post.content,
      tmdbId: post.tmdb_id,
      mediaType: post.media_type,
      posterPath: post.poster_path,
      rating: post.rating,
      createdAt: post.created_at,
      author: {
        id: post.author_id,
        displayName: post.author_display_name,
        avatarUrl: post.author_avatar_url,
        telegramUsername: post.author_telegram_username
      },
      wallOwner: {
        id: post.author_id,
        displayName: post.author_display_name,
        avatarUrl: post.author_avatar_url
      },
      reactions: []
    };

    notifyFeedNewPost(userId, postForFeed).catch(err => {
      console.error('Ошибка отправки WebSocket уведомления о новом отзыве:', err);
    });

    res.status(201).json({
      id: post.id,
      userId: post.user_id,
      postType: post.post_type,
      content: post.content,
      tmdbId: post.tmdb_id,
      mediaType: post.media_type,
      posterPath: post.poster_path,
      rating: post.rating,
      createdAt: post.created_at,
      author: {
        id: post.author_id,
        displayName: post.author_display_name,
        avatarUrl: post.author_avatar_url,
        telegramUsername: post.author_telegram_username
      },
      message: 'Отзыв успешно опубликован!'
    });

  } catch (error) {
    console.error('Ошибка создания отзыва:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/reviews/user/:userId/media/:tmdbId
 * Получить отзыв пользователя на конкретный фильм/сериал
 * 
 * Query params:
 * - mediaType: 'movie' | 'tv' (обязательно)
 */
router.get('/user/:userId/media/:tmdbId', async (req, res) => {
  try {
    const { userId, tmdbId } = req.params;
    const { mediaType } = req.query;

    // Валидация mediaType
    if (!mediaType || (mediaType !== 'movie' && mediaType !== 'tv')) {
      return res.status(400).json({ 
        error: 'mediaType должен быть "movie" или "tv"',
        code: 'INVALID_MEDIA_TYPE' 
      });
    }

    // Получаем отзыв пользователя
    const reviewResult = await executeQuery(
      `SELECT 
        wp.*,
        u.id as author_id,
        u.display_name as author_display_name,
        u.avatar_url as author_avatar_url,
        u.telegram_username as author_telegram_username
       FROM wall_posts wp
       LEFT JOIN users u ON wp.user_id = u.id
       WHERE wp.user_id = ? AND wp.tmdb_id = ? AND wp.media_type = ? AND wp.post_type = 'review'
       ORDER BY wp.created_at DESC
       LIMIT 1`,
      [userId, parseInt(tmdbId), mediaType]
    );

    if (!reviewResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения отзыва',
        code: 'DATABASE_ERROR' 
      });
    }

    if (reviewResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Отзыв не найден',
        code: 'REVIEW_NOT_FOUND' 
      });
    }

    const review = reviewResult.data[0];

    res.json({
      id: review.id,
      userId: review.user_id,
      postType: review.post_type,
      content: review.content,
      tmdbId: review.tmdb_id,
      mediaType: review.media_type,
      posterPath: review.poster_path,
      rating: review.rating,
      createdAt: review.created_at,
      editedAt: review.edited_at,
      author: {
        id: review.author_id,
        displayName: review.author_display_name,
        avatarUrl: review.author_avatar_url,
        telegramUsername: review.author_telegram_username
      }
    });

  } catch (error) {
    console.error('Ошибка получения отзыва:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * PUT /api/reviews/:id
 * Обновить отзыв
 * 
 * Body:
 * - reviewText: string (обязательно, минимум 10 символов, максимум 5000)
 * - rating: number 1-10 (опционально)
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const reviewId = req.params.id;
    const { reviewText, rating } = req.body;

    // Валидация reviewText
    if (!reviewText || typeof reviewText !== 'string') {
      return res.status(400).json({ 
        error: 'reviewText обязателен',
        code: 'MISSING_REVIEW_TEXT' 
      });
    }

    const trimmedReview = reviewText.trim();

    if (trimmedReview.length < 10) {
      return res.status(400).json({ 
        error: 'Отзыв должен содержать минимум 10 символов',
        code: 'REVIEW_TOO_SHORT' 
      });
    }

    if (trimmedReview.length > 5000) {
      return res.status(400).json({ 
        error: 'Отзыв не может быть длиннее 5000 символов',
        code: 'REVIEW_TOO_LONG' 
      });
    }

    // Валидация rating (опционально)
    if (rating !== undefined && rating !== null) {
      if (typeof rating !== 'number' || rating < 1 || rating > 10) {
        return res.status(400).json({ 
          error: 'rating должен быть числом от 1 до 10',
          code: 'INVALID_RATING' 
        });
      }
    }

    // Проверяем, что отзыв существует и принадлежит пользователю
    const existingReviewResult = await executeQuery(
      `SELECT * FROM wall_posts 
       WHERE id = ? AND user_id = ? AND post_type = 'review'`,
      [reviewId, userId]
    );

    if (!existingReviewResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки отзыва',
        code: 'DATABASE_ERROR' 
      });
    }

    if (existingReviewResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Отзыв не найден или у вас нет прав на его редактирование',
        code: 'REVIEW_NOT_FOUND' 
      });
    }

    const existingReview = existingReviewResult.data[0];

    // Получаем информацию о фильме/сериале из TMDb для обновления названия
    const tmdbServiceModule = await import('../services/tmdbService.js');
    const tmdbService = tmdbServiceModule.default;
    
    let mediaDetails;
    if (existingReview.media_type === 'movie') {
      mediaDetails = await tmdbService.getMovieDetails(existingReview.tmdb_id);
    } else {
      mediaDetails = await tmdbService.getTVDetails(existingReview.tmdb_id);
    }

    if (!mediaDetails) {
      return res.status(404).json({ 
        error: 'Фильм/сериал не найден в TMDb',
        code: 'MEDIA_NOT_FOUND' 
      });
    }

    const title = mediaDetails.title || mediaDetails.name;

    // Формат content: первая строка - название фильма, остальное - текст отзыва
    const reviewContent = `${title}\n${trimmedReview}`;

    // Обновляем отзыв
    const updateResult = await executeQuery(
      `UPDATE wall_posts 
       SET content = ?, rating = ?, edited_at = datetime('now', 'localtime')
       WHERE id = ?`,
      [reviewContent, rating || null, reviewId]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка обновления отзыва',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем обновленный пост с информацией об авторе
    const postResult = await executeQuery(
      `SELECT 
        wp.*,
        u.id as author_id,
        u.display_name as author_display_name,
        u.avatar_url as author_avatar_url,
        u.telegram_username as author_telegram_username
       FROM wall_posts wp
       LEFT JOIN users u ON wp.user_id = u.id
       WHERE wp.id = ?`,
      [reviewId]
    );

    if (!postResult.success || postResult.data.length === 0) {
      return res.status(500).json({ 
        error: 'Ошибка получения обновленного отзыва',
        code: 'DATABASE_ERROR' 
      });
    }

    const post = postResult.data[0];

    // Отправляем WebSocket уведомление об обновлении поста
    const { notifyPostUpdated } = await import('../services/websocketService.js');
    
    const updatedPostForFeed = {
      id: post.id,
      userId: post.user_id,
      wallOwnerId: post.wall_owner_id,
      postType: post.post_type,
      content: post.content,
      tmdbId: post.tmdb_id,
      mediaType: post.media_type,
      posterPath: post.poster_path,
      rating: post.rating,
      createdAt: post.created_at,
      editedAt: post.edited_at,
      author: {
        id: post.author_id,
        displayName: post.author_display_name,
        avatarUrl: post.author_avatar_url,
        telegramUsername: post.author_telegram_username
      }
    };

    notifyPostUpdated(userId, updatedPostForFeed).catch(err => {
      console.error('Ошибка отправки WebSocket уведомления об обновлении отзыва:', err);
    });

    res.json({
      id: post.id,
      userId: post.user_id,
      postType: post.post_type,
      content: post.content,
      tmdbId: post.tmdb_id,
      mediaType: post.media_type,
      posterPath: post.poster_path,
      rating: post.rating,
      createdAt: post.created_at,
      editedAt: post.edited_at,
      author: {
        id: post.author_id,
        displayName: post.author_display_name,
        avatarUrl: post.author_avatar_url,
        telegramUsername: post.author_telegram_username
      },
      message: 'Отзыв успешно обновлен!'
    });

  } catch (error) {
    console.error('Ошибка обновления отзыва:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * DELETE /api/reviews/:id
 * Удалить отзыв
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const reviewId = req.params.id;

    // Проверяем, что отзыв существует и принадлежит пользователю
    const existingReviewResult = await executeQuery(
      `SELECT * FROM wall_posts 
       WHERE id = ? AND user_id = ? AND post_type = 'review'`,
      [reviewId, userId]
    );

    if (!existingReviewResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки отзыва',
        code: 'DATABASE_ERROR' 
      });
    }

    if (existingReviewResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Отзыв не найден или у вас нет прав на его удаление',
        code: 'REVIEW_NOT_FOUND' 
      });
    }

    // Удаляем отзыв (пост со стены)
    const deleteResult = await executeQuery(
      `DELETE FROM wall_posts WHERE id = ?`,
      [reviewId]
    );

    if (!deleteResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка удаления отзыва',
        code: 'DATABASE_ERROR' 
      });
    }

    // Отправляем WebSocket уведомление об удалении поста
    const { notifyPostDeleted } = await import('../services/websocketService.js');
    notifyPostDeleted(userId, reviewId).catch(err => {
      console.error('Ошибка отправки WebSocket уведомления об удалении:', err);
    });

    res.json({
      message: 'Отзыв успешно удален',
      reviewId
    });

  } catch (error) {
    console.error('Ошибка удаления отзыва:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/reviews/post/:postId
 * Получить отзыв по ID поста
 * Используется для отображения страницы фильма с отзывом
 */
router.get('/post/:postId', async (req, res) => {
  try {
    const { postId } = req.params;

    // Получаем отзыв (пост) с информацией об авторе
    const reviewResult = await executeQuery(
      `SELECT 
        wp.*,
        u.id as author_id,
        u.display_name as author_display_name,
        u.avatar_url as author_avatar_url,
        u.telegram_username as author_telegram_username
       FROM wall_posts wp
       LEFT JOIN users u ON wp.user_id = u.id
       WHERE wp.id = ? AND wp.post_type = 'review'`,
      [postId]
    );

    if (!reviewResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения отзыва',
        code: 'DATABASE_ERROR' 
      });
    }

    if (reviewResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Отзыв не найден',
        code: 'REVIEW_NOT_FOUND' 
      });
    }

    const review = reviewResult.data[0];

    // Парсим content: первая строка - название фильма, остальное - текст отзыва
    const lines = review.content ? review.content.split('\n') : [];
    const mediaTitle = lines[0] || '';
    const reviewText = lines.slice(1).join('\n').trim();

    res.json({
      id: review.id,
      reviewText,
      rating: review.rating,
      createdAt: review.created_at,
      editedAt: review.edited_at,
      author: {
        userId: review.author_id,
        displayName: review.author_display_name,
        avatarUrl: review.author_avatar_url,
        telegramUsername: review.author_telegram_username
      },
      media: {
        tmdbId: review.tmdb_id,
        mediaType: review.media_type,
        title: mediaTitle,
        posterPath: review.poster_path
      }
    });

  } catch (error) {
    console.error('Ошибка получения отзыва по postId:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

export default router;
