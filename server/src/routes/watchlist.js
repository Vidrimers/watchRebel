import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/watchlist
 * Получить список "Хочу посмотреть" текущего пользователя
 * 
 * Query params:
 * - mediaType: 'movie' | 'tv' (опционально, для фильтрации по типу)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { mediaType } = req.query;

    let query = 'SELECT * FROM watchlist WHERE user_id = ?';
    const params = [userId];

    if (mediaType && (mediaType === 'movie' || mediaType === 'tv')) {
      query += ' AND media_type = ?';
      params.push(mediaType);
    }

    query += ' ORDER BY added_at DESC';

    const watchlistResult = await executeQuery(query, params);

    if (!watchlistResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения списка желаемого',
        code: 'DATABASE_ERROR' 
      });
    }

    // Импортируем tmdbService для получения деталей медиа
    const tmdbService = (await import('../services/tmdbService.js')).default;

    // Обогащаем данные информацией из TMDb
    const enrichedItems = await Promise.all(
      watchlistResult.data.map(async (item) => {
        try {
          let mediaDetails;
          if (item.media_type === 'movie') {
            mediaDetails = await tmdbService.getMovieDetails(item.tmdb_id);
          } else {
            mediaDetails = await tmdbService.getTVDetails(item.tmdb_id);
          }

          return {
            id: item.id,
            userId: item.user_id,
            tmdbId: item.tmdb_id,
            mediaType: item.media_type,
            addedAt: item.added_at,
            // Добавляем данные из TMDb
            title: mediaDetails.title || mediaDetails.name,
            posterPath: mediaDetails.poster_path,
            releaseDate: mediaDetails.release_date || mediaDetails.first_air_date,
            voteAverage: mediaDetails.vote_average || 0,
            overview: mediaDetails.overview
          };
        } catch (error) {
          console.error(`Ошибка получения деталей для ${item.media_type} ${item.tmdb_id}:`, error);
          // Возвращаем базовые данные если не удалось получить детали
          return {
            id: item.id,
            userId: item.user_id,
            tmdbId: item.tmdb_id,
            mediaType: item.media_type,
            addedAt: item.added_at,
            title: 'Неизвестно',
            posterPath: null,
            releaseDate: null,
            voteAverage: 0,
            overview: null
          };
        }
      })
    );

    res.json(enrichedItems);

  } catch (error) {
    console.error('Ошибка получения списка желаемого:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/watchlist
 * Добавить контент в список "Хочу посмотреть"
 * 
 * Body:
 * - tmdbId: number (обязательно)
 * - mediaType: 'movie' | 'tv' (обязательно)
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { tmdbId, mediaType } = req.body;

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

    // Проверяем, не находится ли контент уже в watchlist
    const existingCheck = await executeQuery(
      'SELECT * FROM watchlist WHERE user_id = ? AND tmdb_id = ? AND media_type = ?',
      [userId, tmdbId, mediaType]
    );

    if (!existingCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки существующих элементов',
        code: 'DATABASE_ERROR' 
      });
    }

    if (existingCheck.data.length > 0) {
      return res.status(400).json({ 
        error: 'Этот контент уже находится в списке желаемого',
        code: 'ALREADY_IN_WATCHLIST' 
      });
    }

    // Добавляем контент в watchlist
    const itemId = uuidv4();

    const insertResult = await executeQuery(
      'INSERT INTO watchlist (id, user_id, tmdb_id, media_type) VALUES (?, ?, ?, ?)',
      [itemId, userId, tmdbId, mediaType]
    );

    if (!insertResult.success) {
      // Проверяем, не нарушено ли ограничение уникальности
      if (insertResult.code === 'SQLITE_CONSTRAINT') {
        return res.status(400).json({ 
          error: 'Этот контент уже находится в списке',
          code: 'DUPLICATE_ITEM' 
        });
      }

      return res.status(500).json({ 
        error: 'Ошибка добавления контента',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем добавленный элемент
    const itemResult = await executeQuery(
      'SELECT * FROM watchlist WHERE id = ?',
      [itemId]
    );

    if (!itemResult.success || itemResult.data.length === 0) {
      return res.status(500).json({ 
        error: 'Ошибка получения добавленного элемента',
        code: 'DATABASE_ERROR' 
      });
    }

    const item = itemResult.data[0];

    res.status(201).json({
      id: item.id,
      userId: item.user_id,
      tmdbId: item.tmdb_id,
      mediaType: item.media_type,
      addedAt: item.added_at
    });

  } catch (error) {
    console.error('Ошибка добавления контента:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * DELETE /api/watchlist/:itemId
 * Удалить контент из списка желаемого
 */
router.delete('/:itemId', authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user.id;

    // Проверяем, существует ли элемент и принадлежит ли он пользователю
    const itemCheck = await executeQuery(
      'SELECT * FROM watchlist WHERE id = ?',
      [itemId]
    );

    if (!itemCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки элемента',
        code: 'DATABASE_ERROR' 
      });
    }

    if (itemCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Элемент не найден в списке желаемого',
        code: 'ITEM_NOT_FOUND' 
      });
    }

    const item = itemCheck.data[0];

    if (item.user_id !== userId) {
      return res.status(403).json({ 
        error: 'Нет прав на удаление этого элемента',
        code: 'FORBIDDEN' 
      });
    }

    // Удаляем элемент из watchlist
    const deleteResult = await executeQuery(
      'DELETE FROM watchlist WHERE id = ?',
      [itemId]
    );

    if (!deleteResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка удаления элемента из списка желаемого',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json({ 
      message: 'Элемент успешно удален из списка желаемого',
      itemId 
    });

  } catch (error) {
    console.error('Ошибка удаления элемента из списка желаемого:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

export default router;
