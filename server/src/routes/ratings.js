import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/ratings
 * Создать или обновить рейтинг для контента
 * 
 * Body:
 * - tmdbId: number (обязательно)
 * - mediaType: 'movie' | 'tv' (обязательно)
 * - rating: number 1-10 (обязательно)
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { tmdbId, mediaType, rating } = req.body;

    // Валидация входных данных
    if (!tmdbId || typeof tmdbId !== 'number') {
      return res.status(400).json({ 
        error: 'tmdbId обязателен и должен быть числом',
        code: 'INVALID_TMDB_ID' 
      });
    }

    if (!mediaType || (mediaType !== 'movie' && mediaType !== 'tv')) {
      return res.status(400).json({ 
        error: 'mediaType должен быть "movie" или "tv"',
        code: 'INVALID_MEDIA_TYPE' 
      });
    }

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 10) {
      return res.status(400).json({ 
        error: 'rating должен быть числом от 1 до 10',
        code: 'INVALID_RATING' 
      });
    }

    // Проверяем, существует ли уже рейтинг для этого контента
    const existingCheck = await executeQuery(
      'SELECT * FROM ratings WHERE user_id = ? AND tmdb_id = ? AND media_type = ?',
      [userId, tmdbId, mediaType]
    );

    if (!existingCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки существующего рейтинга',
        code: 'DATABASE_ERROR' 
      });
    }

    let ratingId;
    let isUpdate = false;

    if (existingCheck.data.length > 0) {
      // Обновляем существующий рейтинг
      ratingId = existingCheck.data[0].id;
      isUpdate = true;

      const updateResult = await executeQuery(
        'UPDATE ratings SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [rating, ratingId]
      );

      if (!updateResult.success) {
        return res.status(500).json({ 
          error: 'Ошибка обновления рейтинга',
          code: 'DATABASE_ERROR' 
        });
      }
    } else {
      // Создаем новый рейтинг
      ratingId = uuidv4();

      const insertResult = await executeQuery(
        'INSERT INTO ratings (id, user_id, tmdb_id, media_type, rating) VALUES (?, ?, ?, ?, ?)',
        [ratingId, userId, tmdbId, mediaType, rating]
      );

      if (!insertResult.success) {
        return res.status(500).json({ 
          error: 'Ошибка создания рейтинга',
          code: 'DATABASE_ERROR' 
        });
      }

      // Автоматически создаем запись на стене при добавлении нового рейтинга
      const wallPostId = uuidv4();
      const wallPostResult = await executeQuery(
        `INSERT INTO wall_posts (id, user_id, post_type, tmdb_id, media_type, rating)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [wallPostId, userId, 'rating', tmdbId, mediaType, rating]
      );

      if (!wallPostResult.success) {
        console.error('Ошибка создания записи на стене:', wallPostResult.error);
        // Не возвращаем ошибку, так как рейтинг уже создан
      }
    }

    // Получаем созданный/обновленный рейтинг
    const ratingResult = await executeQuery(
      'SELECT * FROM ratings WHERE id = ?',
      [ratingId]
    );

    if (!ratingResult.success || ratingResult.data.length === 0) {
      return res.status(500).json({ 
        error: 'Ошибка получения рейтинга',
        code: 'DATABASE_ERROR' 
      });
    }

    const savedRating = ratingResult.data[0];

    res.status(isUpdate ? 200 : 201).json({
      id: savedRating.id,
      userId: savedRating.user_id,
      tmdbId: savedRating.tmdb_id,
      mediaType: savedRating.media_type,
      rating: savedRating.rating,
      createdAt: savedRating.created_at,
      updatedAt: savedRating.updated_at
    });

  } catch (error) {
    console.error('Ошибка создания/обновления рейтинга:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * PUT /api/ratings/:id
 * Обновить существующий рейтинг
 * 
 * Body:
 * - rating: number 1-10 (обязательно)
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { rating } = req.body;

    // Валидация рейтинга
    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 10) {
      return res.status(400).json({ 
        error: 'rating должен быть числом от 1 до 10',
        code: 'INVALID_RATING' 
      });
    }

    // Проверяем, существует ли рейтинг и принадлежит ли он пользователю
    const ratingCheck = await executeQuery(
      'SELECT * FROM ratings WHERE id = ?',
      [id]
    );

    if (!ratingCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки рейтинга',
        code: 'DATABASE_ERROR' 
      });
    }

    if (ratingCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Рейтинг не найден',
        code: 'RATING_NOT_FOUND' 
      });
    }

    const existingRating = ratingCheck.data[0];

    if (existingRating.user_id !== userId) {
      return res.status(403).json({ 
        error: 'Нет прав на изменение этого рейтинга',
        code: 'FORBIDDEN' 
      });
    }

    // Обновляем рейтинг
    const updateResult = await executeQuery(
      'UPDATE ratings SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [rating, id]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка обновления рейтинга',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем обновленный рейтинг
    const updatedRatingResult = await executeQuery(
      'SELECT * FROM ratings WHERE id = ?',
      [id]
    );

    if (!updatedRatingResult.success || updatedRatingResult.data.length === 0) {
      return res.status(500).json({ 
        error: 'Ошибка получения обновленного рейтинга',
        code: 'DATABASE_ERROR' 
      });
    }

    const updatedRating = updatedRatingResult.data[0];

    res.json({
      id: updatedRating.id,
      userId: updatedRating.user_id,
      tmdbId: updatedRating.tmdb_id,
      mediaType: updatedRating.media_type,
      rating: updatedRating.rating,
      createdAt: updatedRating.created_at,
      updatedAt: updatedRating.updated_at
    });

  } catch (error) {
    console.error('Ошибка обновления рейтинга:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/ratings/user/:userId
 * Получить все рейтинги пользователя
 * 
 * Query params:
 * - mediaType: 'movie' | 'tv' (опционально, для фильтрации по типу)
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { mediaType } = req.query;

    let query = 'SELECT * FROM ratings WHERE user_id = ?';
    const params = [userId];

    if (mediaType && (mediaType === 'movie' || mediaType === 'tv')) {
      query += ' AND media_type = ?';
      params.push(mediaType);
    }

    query += ' ORDER BY updated_at DESC';

    const ratingsResult = await executeQuery(query, params);

    if (!ratingsResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения рейтингов',
        code: 'DATABASE_ERROR' 
      });
    }

    const ratings = ratingsResult.data.map(r => ({
      id: r.id,
      userId: r.user_id,
      tmdbId: r.tmdb_id,
      mediaType: r.media_type,
      rating: r.rating,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    res.json(ratings);

  } catch (error) {
    console.error('Ошибка получения рейтингов пользователя:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

export default router;
