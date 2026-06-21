import express from 'express';
import tmdbService from '../services/tmdbService.js';
import mediaCacheService from '../services/mediaCacheService.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { executeQuery } from '../database/db.js';

const router = express.Router();

/**
 * GET /api/media/popular
 * Получение популярных фильмов и сериалов
 * 
 * Query params:
 * - type: 'movie' | 'tv' | 'all' (опционально, по умолчанию 'all')
 * - page: number (опционально, по умолчанию 1)
 */
router.get('/popular', async (req, res) => {
  try {
    const { type = 'all', page = 1 } = req.query;

    // Инициализируем TMDb сервис
    await tmdbService.initialize();

    let results = {
      movies: [],
      tv: [],
      page: parseInt(page)
    };

    // Получаем трендовый контент
    if (type === 'movie' || type === 'all') {
      try {
        const movieResults = await tmdbService.getTrendingMovies(page);
        results.movies = movieResults.results || [];
        results.totalMoviePages = movieResults.total_pages;
        results.totalMovieResults = movieResults.total_results;
      } catch (error) {
        console.error('Ошибка получения трендовых фильмов:', error.message);
      }
    }

    if (type === 'tv' || type === 'all') {
      try {
        const tvResults = await tmdbService.getTrendingTV(page);
        results.tv = tvResults.results || [];
        results.totalTVPages = tvResults.total_pages;
        results.totalTVResults = tvResults.total_results;
      } catch (error) {
        console.error('Ошибка получения трендовых сериалов:', error.message);
      }
    }

    res.json(results);

  } catch (error) {
    console.error('Ошибка получения популярного контента:', error);
    res.status(500).json({ 
      error: 'Ошибка получения популярного контента',
      message: error.message,
      code: 'POPULAR_ERROR' 
    });
  }
});

/**
 * GET /api/media/discover
 * Поиск фильмов и сериалов с фильтрами
 * 
 * Query params:
 * - type: 'movie' | 'tv' (обязательно)
 * - page: number (опционально, по умолчанию 1)
 * - sortBy: string (опционально, по умолчанию 'popularity.desc')
 * - genres: string (опционально, ID жанров через запятую)
 * - year: number (опционально)
 * - minRating: number (опционально)
 */
router.get('/discover', async (req, res) => {
  try {
    const { type, page = 1, sortBy, genres, year, minRating } = req.query;

    // Валидация типа
    if (!type || (type !== 'movie' && type !== 'tv')) {
      return res.status(400).json({ 
        error: 'Параметр type обязателен и должен быть movie или tv',
        code: 'INVALID_TYPE' 
      });
    }

    // Инициализируем TMDb сервис
    await tmdbService.initialize();

    // Формируем фильтры
    const filters = {
      page: parseInt(page),
      sortBy: sortBy || 'popularity.desc'
    };

    if (genres) {
      filters.genres = genres;
    }

    if (year) {
      filters.year = parseInt(year);
    }

    if (minRating) {
      filters.minRating = parseFloat(minRating);
    }

    // Выполняем поиск
    let results;
    if (type === 'movie') {
      results = await tmdbService.discoverMovies(filters);
    } else {
      results = await tmdbService.discoverTV(filters);
    }

    res.json(results);

  } catch (error) {
    console.error('Ошибка discover:', error);
    res.status(500).json({ 
      error: 'Ошибка поиска контента',
      message: error.message,
      code: 'DISCOVER_ERROR' 
    });
  }
});

/**
 * GET /api/media/genres
 * Получение списка жанров
 * 
 * Query params:
 * - type: 'movie' | 'tv' | 'all' (опционально, по умолчанию 'all')
 */
router.get('/genres', async (req, res) => {
  try {
    const { type = 'all' } = req.query;

    // Инициализируем TMDb сервис
    await tmdbService.initialize();

    let results = {
      movieGenres: [],
      tvGenres: []
    };

    // Получаем жанры в зависимости от типа
    if (type === 'movie' || type === 'all') {
      try {
        const movieGenres = await tmdbService.getMovieGenres();
        results.movieGenres = movieGenres.genres || [];
      } catch (error) {
        console.error('Ошибка получения жанров фильмов:', error.message);
      }
    }

    if (type === 'tv' || type === 'all') {
      try {
        const tvGenres = await tmdbService.getTVGenres();
        results.tvGenres = tvGenres.genres || [];
      } catch (error) {
        console.error('Ошибка получения жанров сериалов:', error.message);
      }
    }

    res.json(results);

  } catch (error) {
    console.error('Ошибка получения жанров:', error);
    res.status(500).json({ 
      error: 'Ошибка получения жанров',
      message: error.message,
      code: 'GENRES_ERROR' 
    });
  }
});

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
 * GET /api/media/person/:id
 * Получение данных персоны (актёра/режиссёра) с кэшированием
 */
router.get('/person/:id', async (req, res) => {
  try {
    const personId = parseInt(req.params.id);
    if (isNaN(personId) || personId <= 0) {
      return res.status(400).json({ error: 'Неверный ID персоны' });
    }

    const cached = await mediaCacheService.getCachedPerson(personId);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    res.setHeader('X-Cache', 'MISS');
    const data = await mediaCacheService.getOrFetchPerson(personId);
    if (!data) {
      return res.status(404).json({ error: 'Персона не найдена' });
    }

    res.json(data);
  } catch (error) {
    console.error('Ошибка получения персоны:', error);
    res.status(500).json({ error: 'Ошибка получения данных персоны' });
  }
});

/**
 * GET /api/media/:type/:id
 * Получение детальной информации о фильме или сериале (с кэшированием)
 */
router.get('/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;

    if (type !== 'movie' && type !== 'tv') {
      return res.status(400).json({ 
        error: 'Тип должен быть movie или tv',
        code: 'INVALID_TYPE' 
      });
    }

    const tmdbId = parseInt(id);
    if (isNaN(tmdbId) || tmdbId <= 0) {
      return res.status(400).json({ 
        error: 'ID должен быть положительным числом',
        code: 'INVALID_ID' 
      });
    }

    // Cache-through: сначала кэш, потом TMDb
    const cached = await mediaCacheService.getCachedMedia(tmdbId, type);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      if (cached.poster_path) {
        cached.poster_url = tmdbService.buildImageUrl(cached.poster_path, 'w500');
      }
      if (cached.backdrop_path) {
        cached.backdrop_url = tmdbService.buildImageUrl(cached.backdrop_path, 'w1280');
      }
      return res.json(cached);
    }

    res.setHeader('X-Cache', 'MISS');
    await tmdbService.initialize();

    let details;
    if (type === 'movie') {
      details = await tmdbService.getMovieDetails(tmdbId);
    } else {
      details = await tmdbService.getTVDetails(tmdbId);
    }

    // Сохраняем в кэш
    await mediaCacheService.saveToCache(details, type);

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

/**
 * GET /api/media/cache/stats
 * Статистика кэша
 */
router.get('/cache/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await mediaCacheService.getCacheStats();
    res.json(stats);
  } catch (error) {
    console.error('Ошибка статистики кэша:', error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

/**
 * POST /api/media/cache/refresh/:tmdbId
 * Принудительно обновить кэш (admin)
 */
router.post('/cache/refresh/:tmdbId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const tmdbId = parseInt(req.params.tmdbId);
    const { mediaType = 'movie' } = req.body;
    const data = await mediaCacheService.refreshCache(tmdbId, mediaType);
    if (!data) return res.status(404).json({ error: 'Медиа не найдено' });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Ошибка обновления кэша:', error);
    res.status(500).json({ error: 'Ошибка обновления кэша' });
  }
});

/**
 * POST /api/media/cache/migrate
 * Миграция существующих фильмов в кэш (admin)
 */
router.post('/cache/migrate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const listItems = await executeQuery('SELECT DISTINCT tmdb_id, media_type FROM list_items');
    const wallPosts = await executeQuery('SELECT DISTINCT tmdb_id, media_type FROM wall_posts WHERE tmdb_id IS NOT NULL');
    const watchlistItems = await executeQuery('SELECT DISTINCT tmdb_id, media_type FROM watchlist');

    const allItems = new Map();
    const addItems = (result) => {
      if (result.success) {
        result.data.forEach(item => {
          if (item.tmdb_id && !allItems.has(`${item.tmdb_id}_${item.media_type}`)) {
            allItems.set(`${item.tmdb_id}_${item.media_type}`, {
              tmdbId: item.tmdb_id,
              mediaType: item.media_type
            });
          }
        });
      }
    };

    addItems(listItems);
    addItems(wallPosts);
    addItems(watchlistItems);

    let cached = 0, skipped = 0, errors = 0;

    for (const [, item] of allItems) {
      const existing = await mediaCacheService.getCachedMedia(item.tmdbId, item.mediaType);
      if (existing) { skipped++; continue; }
      try {
        await mediaCacheService.getOrFetch(item.tmdbId, item.mediaType);
        cached++;
        await new Promise(r => setTimeout(r, 30));
      } catch (error) {
        console.error(`Ошибка кэширования ${item.mediaType}/${item.tmdbId}:`, error.message);
        errors++;
      }
    }

    res.json({ success: true, total: allItems.size, cached, skipped, errors });
  } catch (error) {
    console.error('Ошибка миграции кэша:', error);
    res.status(500).json({ error: 'Ошибка миграции' });
  }
});

export default router;
