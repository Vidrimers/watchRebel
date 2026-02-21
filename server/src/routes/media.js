import express from 'express';
import tmdbService from '../services/tmdbService.js';

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

    // Получаем популярные в зависимости от типа
    if (type === 'movie' || type === 'all') {
      try {
        const movieResults = await tmdbService.getPopularMovies(page);
        results.movies = movieResults.results || [];
        results.totalMoviePages = movieResults.total_pages;
        results.totalMovieResults = movieResults.total_results;
      } catch (error) {
        console.error('Ошибка получения популярных фильмов:', error.message);
      }
    }

    if (type === 'tv' || type === 'all') {
      try {
        const tvResults = await tmdbService.getPopularTV(page);
        results.tv = tvResults.results || [];
        results.totalTVPages = tvResults.total_pages;
        results.totalTVResults = tvResults.total_results;
      } catch (error) {
        console.error('Ошибка получения популярных сериалов:', error.message);
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
