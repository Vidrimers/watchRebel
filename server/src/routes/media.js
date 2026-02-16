import express from 'express';
import tmdbService from '../services/tmdbService.js';

const router = express.Router();

/**
 * GET /api/media/search
 * Поиск фильмов и сериалов через TMDb API
 * 
 * Query params:
 * - query: string (обязательно) - поисковый запрос
 * - type: 'movie' | 'tv' | 'all' (опционально, по умолчанию 'all')
 * - page: number (опционально, по умолчанию 1)
 */
router.get('/search', async (req, res) => {
  try {
    const { query, type = 'all', page = 1 } = req.query;

    // Валидация входных данных
    if (!query || query.trim() === '') {
      return res.status(400).json({ 
        error: 'Параметр query обязателен',
        code: 'MISSING_QUERY' 
      });
    }

    // Инициализируем TMDb сервис если еще не инициализирован
    await tmdbService.initialize();

    let results = {
      movies: [],
      tv: [],
      page: parseInt(page),
      query: query.trim()
    };

    // Поиск в зависимости от типа
    if (type === 'movie' || type === 'all') {
      try {
        const movieResults = await tmdbService.searchMovies(query, page);
        results.movies = movieResults.results || [];
        results.totalMoviePages = movieResults.total_pages;
        results.totalMovieResults = movieResults.total_results;
      } catch (error) {
        console.error('Ошибка поиска фильмов:', error.message);
        // Продолжаем выполнение, просто оставляем movies пустым
      }
    }

    if (type === 'tv' || type === 'all') {
      try {
        const tvResults = await tmdbService.searchTV(query, page);
        results.tv = tvResults.results || [];
        results.totalTVPages = tvResults.total_pages;
        results.totalTVResults = tvResults.total_results;
      } catch (error) {
        console.error('Ошибка поиска сериалов:', error.message);
        // Продолжаем выполнение, просто оставляем tv пустым
      }
    }

    res.json(results);

  } catch (error) {
    console.error('Ошибка поиска контента:', error);
    res.status(500).json({ 
      error: 'Ошибка поиска контента',
      message: error.message,
      code: 'SEARCH_ERROR' 
    });
  }
});

/**
 * GET /api/media/:type/:id
 * Получение детальной информации о фильме или сериале
 * 
 * Params:
 * - type: 'movie' | 'tv' (обязательно)
 * - id: number (обязательно) - TMDb ID контента
 */
router.get('/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;

    // Валидация типа
    if (type !== 'movie' && type !== 'tv') {
      return res.status(400).json({ 
        error: 'Тип должен быть movie или tv',
        code: 'INVALID_TYPE' 
      });
    }

    // Валидация ID
    const tmdbId = parseInt(id);
    if (isNaN(tmdbId) || tmdbId <= 0) {
      return res.status(400).json({ 
        error: 'ID должен быть положительным числом',
        code: 'INVALID_ID' 
      });
    }

    // Инициализируем TMDb сервис
    await tmdbService.initialize();

    // Получаем детали в зависимости от типа
    let details;
    if (type === 'movie') {
      details = await tmdbService.getMovieDetails(tmdbId);
    } else {
      details = await tmdbService.getTVDetails(tmdbId);
    }

    // Добавляем построенные URL для изображений
    if (details.poster_path) {
      details.poster_url = tmdbService.buildImageUrl(details.poster_path, 'w500');
      details.poster_url_original = tmdbService.buildImageUrl(details.poster_path, 'original');
    }

    if (details.backdrop_path) {
      details.backdrop_url = tmdbService.buildImageUrl(details.backdrop_path, 'w1280');
      details.backdrop_url_original = tmdbService.buildImageUrl(details.backdrop_path, 'original');
    }

    res.json(details);

  } catch (error) {
    console.error('Ошибка получения деталей контента:', error);
    
    // Обрабатываем специфичные ошибки TMDb
    if (error.message.includes('не найден')) {
      return res.status(404).json({ 
        error: 'Контент не найден',
        code: 'NOT_FOUND' 
      });
    }

    res.status(500).json({ 
      error: 'Ошибка получения деталей контента',
      message: error.message,
      code: 'DETAILS_ERROR' 
    });
  }
});

/**
 * GET /api/media/:type/:id/images
 * Получение изображений для фильма или сериала
 * 
 * Params:
 * - type: 'movie' | 'tv' (обязательно)
 * - id: number (обязательно) - TMDb ID контента
 */
router.get('/:type/:id/images', async (req, res) => {
  try {
    const { type, id } = req.params;

    // Валидация типа
    if (type !== 'movie' && type !== 'tv') {
      return res.status(400).json({ 
        error: 'Тип должен быть movie или tv',
        code: 'INVALID_TYPE' 
      });
    }

    // Валидация ID
    const tmdbId = parseInt(id);
    if (isNaN(tmdbId) || tmdbId <= 0) {
      return res.status(400).json({ 
        error: 'ID должен быть положительным числом',
        code: 'INVALID_ID' 
      });
    }

    // Инициализируем TMDb сервис
    await tmdbService.initialize();

    // Получаем детали контента (они включают изображения через append_to_response)
    let details;
    if (type === 'movie') {
      details = await tmdbService.getMovieDetails(tmdbId);
    } else {
      details = await tmdbService.getTVDetails(tmdbId);
    }

    // Извлекаем изображения из ответа
    const images = details.images || { backdrops: [], posters: [], logos: [] };

    // Добавляем построенные URL для каждого изображения
    const processImages = (imageArray) => {
      return imageArray.map(img => ({
        ...img,
        url_w500: tmdbService.buildImageUrl(img.file_path, 'w500'),
        url_original: tmdbService.buildImageUrl(img.file_path, 'original')
      }));
    };

    const result = {
      id: tmdbId,
      type,
      backdrops: processImages(images.backdrops || []),
      posters: processImages(images.posters || []),
      logos: processImages(images.logos || [])
    };

    res.json(result);

  } catch (error) {
    console.error('Ошибка получения изображений:', error);
    
    // Обрабатываем специфичные ошибки TMDb
    if (error.message.includes('не найден')) {
      return res.status(404).json({ 
        error: 'Контент не найден',
        code: 'NOT_FOUND' 
      });
    }

    res.status(500).json({ 
      error: 'Ошибка получения изображений',
      message: error.message,
      code: 'IMAGES_ERROR' 
    });
  }
});

export default router;
