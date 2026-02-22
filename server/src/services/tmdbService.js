import axios from 'axios';

/**
 * TMDb Integration Service
 * Сервис для работы с The Movie Database API v3
 */

class TMDbService {
  constructor() {
    this.baseUrl = 'https://api.themoviedb.org/3';
    this.language = 'ru-RU';
    this.imageBaseUrl = null;
    this._initialized = false;
    
    // Rate limiting: TMDb позволяет ~40 запросов в секунду
    this.requestQueue = [];
    this.isProcessing = false;
    this.minRequestInterval = 25; // 25ms между запросами = 40 req/sec
    this.lastRequestTime = 0;
  }

  /**
   * Ленивая инициализация - читаем переменные окружения при первом использовании
   */
  _ensureInitialized() {
    if (this._initialized) {
      return;
    }

    this.apiKey = process.env.TMDB_API_KEY;
    this.accessToken = process.env.TMDB_API_ACCESS_KEY;
    this.baseUrl = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
    
    console.log('🎬 TMDb Service инициализация:');
    console.log('  API Key:', this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'Отсутствует');
    console.log('  Access Token:', this.accessToken ? `${this.accessToken.substring(0, 20)}...` : 'Отсутствует');
    console.log('  Base URL:', this.baseUrl);
    
    this._initialized = true;
  }

  /**
   * Инициализация сервиса - получение конфигурации для изображений
   */
  async initialize() {
    this._ensureInitialized();
    
    if (!this.imageBaseUrl) {
      try {
        const config = await this.makeRequest('/configuration');
        this.imageBaseUrl = config.images.secure_base_url;
      } catch (error) {
        console.error('Ошибка инициализации TMDb сервиса:', error.message);
        // Используем дефолтный URL если не удалось получить конфигурацию
        this.imageBaseUrl = 'https://image.tmdb.org/t/p/';
      }
    }
  }

  /**
   * Выполнение запроса с rate limiting и retry
   */
  async makeRequest(endpoint, params = {}, retryCount = 0) {
    this._ensureInitialized();
    
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ endpoint, params, resolve, reject, retryCount });
      this.processQueue();
    });
  }

  /**
   * Обработка очереди запросов с rate limiting
   */
  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      // Ждем если прошло меньше минимального интервала
      if (timeSinceLastRequest < this.minRequestInterval) {
        await new Promise(resolve => 
          setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
        );
      }

      const { endpoint, params, resolve, reject, retryCount } = this.requestQueue.shift();

      try {
        console.log(`🔑 TMDb запрос: ${endpoint}`);
        console.log(`🔑 Base URL: ${this.baseUrl}`);
        console.log(`🔑 API Key: ${this.apiKey ? 'Есть' : 'Отсутствует'}`);
        console.log(`🔑 Access Token: ${this.accessToken ? 'Есть' : 'Отсутствует'}`);
        console.log(`🌍 Language: ${this.language}`);
        
        if (!this.accessToken && !this.apiKey) {
          throw new Error('TMDb API Key или Access Token не настроены');
        }
        
        // Формируем URL и параметры
        const fullUrl = `${this.baseUrl}${endpoint}`;
        
        // Формируем параметры запроса
        const queryParams = {
          language: this.language,
          ...params
        };
        
        // Если используем API Key (v3), добавляем его в параметры
        if (!this.accessToken && this.apiKey) {
          queryParams.api_key = this.apiKey;
        }
        
        // Настройки запроса
        const config = {
          params: queryParams,
          timeout: 10000, // 10 секунд таймаут
          validateStatus: (status) => status < 500 // Не бросать ошибку на 4xx
        };
        
        // Если используем Access Token (v4), добавляем в заголовки
        if (this.accessToken) {
          config.headers = {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json;charset=utf-8'
          };
        }
        
        console.log(`🌐 Полный URL запроса: ${fullUrl}`);
        console.log(`📋 Параметры:`, queryParams);
        
        const response = await axios.get(fullUrl, config);
        
        console.log(`✅ TMDb ответ для ${endpoint}: статус ${response.status}`);
        this.lastRequestTime = Date.now();
        resolve(response.data);
      } catch (error) {
        console.error(`❌ TMDb ошибка для ${endpoint}:`);
        console.error('  Код ошибки:', error.code);
        console.error('  Сообщение:', error.message);
        if (error.response) {
          console.error('  HTTP статус:', error.response.status);
          console.error('  Данные ответа:', error.response.data);
        }
        if (error.request) {
          console.error('  Запрос был отправлен, но ответа не получено');
          console.error('  URL:', error.config?.url);
        }
        
        // Retry логика для сетевых ошибок
        const maxRetries = 3;
        const isNetworkError = error.code === 'ECONNREFUSED' || 
                              error.code === 'ENOTFOUND' || 
                              error.code === 'ETIMEDOUT' ||
                              error.code === 'EAI_AGAIN';
        
        if (isNetworkError && retryCount < maxRetries) {
          const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Экспоненциальная задержка, макс 5 сек
          console.log(`🔄 Повторная попытка ${retryCount + 1}/${maxRetries} через ${retryDelay}ms...`);
          
          this.lastRequestTime = Date.now();
          
          // Добавляем запрос обратно в очередь с увеличенным счетчиком
          setTimeout(() => {
            this.requestQueue.push({ endpoint, params, resolve, reject, retryCount: retryCount + 1 });
            this.processQueue();
          }, retryDelay);
        } else {
          this.lastRequestTime = Date.now();
          reject(this.handleError(error));
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Обработка ошибок TMDb API
   */
  handleError(error) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.status_message || error.message;

      switch (status) {
        case 401:
          return new Error('TMDb API: Неверный API ключ');
        case 404:
          return new Error('TMDb API: Контент не найден');
        case 429:
          return new Error('TMDb API: Превышен лимит запросов');
        case 500:
        case 503:
          return new Error('TMDb API: Сервер временно недоступен');
        default:
          return new Error(`TMDb API: ${message}`);
      }
    } else if (error.request) {
      return new Error('TMDb API: Нет ответа от сервера');
    } else {
      return new Error(`TMDb API: ${error.message}`);
    }
  }

  /**
   * Поиск фильмов
   * @param {string} query - Поисковый запрос
   * @param {number} page - Номер страницы (по умолчанию 1)
   * @returns {Promise<Object>} Результаты поиска
   */
  async searchMovies(query, page = 1) {
    if (!query || query.trim() === '') {
      throw new Error('Поисковый запрос не может быть пустым');
    }

    return await this.makeRequest('/search/movie', {
      query: query.trim(),
      page,
      include_adult: false
    });
  }

  /**
   * Поиск сериалов
   * @param {string} query - Поисковый запрос
   * @param {number} page - Номер страницы (по умолчанию 1)
   * @returns {Promise<Object>} Результаты поиска
   */
  async searchTV(query, page = 1) {
    if (!query || query.trim() === '') {
      throw new Error('Поисковый запрос не может быть пустым');
    }

    return await this.makeRequest('/search/tv', {
      query: query.trim(),
      page,
      include_adult: false
    });
  }

  /**
   * Получение деталей фильма
   * @param {number} movieId - ID фильма в TMDb
   * @returns {Promise<Object>} Детали фильма
   */
  async getMovieDetails(movieId) {
    if (!movieId || typeof movieId !== 'number') {
      throw new Error('ID фильма должен быть числом');
    }

    return await this.makeRequest(`/movie/${movieId}`, {
      append_to_response: 'credits,videos,images'
    });
  }

  /**
   * Получение деталей сериала
   * @param {number} tvId - ID сериала в TMDb
   * @returns {Promise<Object>} Детали сериала
   */
  async getTVDetails(tvId) {
    if (!tvId || typeof tvId !== 'number') {
      throw new Error('ID сериала должен быть числом');
    }

    return await this.makeRequest(`/tv/${tvId}`, {
      append_to_response: 'credits,videos,images'
    });
  }

  /**
   * Получение информации о сезоне сериала
   * @param {number} tvId - ID сериала в TMDb
   * @param {number} seasonNumber - Номер сезона
   * @returns {Promise<Object>} Детали сезона
   */
  async getTVSeason(tvId, seasonNumber) {
    if (!tvId || typeof tvId !== 'number') {
      throw new Error('ID сериала должен быть числом');
    }
    if (seasonNumber === undefined || typeof seasonNumber !== 'number') {
      throw new Error('Номер сезона должен быть числом');
    }

    return await this.makeRequest(`/tv/${tvId}/season/${seasonNumber}`);
  }

  /**
   * Получение популярных фильмов
   * @param {number} page - Номер страницы (по умолчанию 1)
   * @returns {Promise<Object>} Популярные фильмы
   */
  async getPopularMovies(page = 1) {
    return await this.makeRequest('/movie/popular', {
      page
    });
  }

  /**
   * Получение популярных сериалов
   * @param {number} page - Номер страницы (по умолчанию 1)
   * @returns {Promise<Object>} Популярные сериалы
   */
  async getPopularTV(page = 1) {
    return await this.makeRequest('/tv/popular', {
      page
    });
  }

  /**
   * Получение фильмов с высоким рейтингом
   * @param {number} page - Номер страницы (по умолчанию 1)
   * @returns {Promise<Object>} Фильмы с высоким рейтингом
   */
  async getTopRatedMovies(page = 1) {
    return await this.makeRequest('/movie/top_rated', {
      page
    });
  }

  /**
   * Получение сериалов с высоким рейтингом
   * @param {number} page - Номер страницы (по умолчанию 1)
   * @returns {Promise<Object>} Сериалы с высоким рейтингом
   */
  async getTopRatedTV(page = 1) {
    return await this.makeRequest('/tv/top_rated', {
      page
    });
  }

  /**
   * Получение списка жанров фильмов
   * @returns {Promise<Object>} Список жанров
   */
  async getMovieGenres() {
    return await this.makeRequest('/genre/movie/list');
  }

  /**
   * Получение списка жанров сериалов
   * @returns {Promise<Object>} Список жанров
   */
  async getTVGenres() {
    return await this.makeRequest('/genre/tv/list');
  }

  /**
   * Поиск фильмов с фильтрами
   * @param {Object} filters - Фильтры поиска
   * @returns {Promise<Object>} Результаты поиска
   */
  async discoverMovies(filters = {}) {
    const params = {
      page: filters.page || 1,
      sort_by: filters.sortBy || 'popularity.desc',
      include_adult: false
    };

    if (filters.genres) {
      params.with_genres = filters.genres;
    }

    if (filters.year) {
      params.primary_release_year = filters.year;
    }

    if (filters.minRating) {
      params['vote_average.gte'] = filters.minRating;
    }

    return await this.makeRequest('/discover/movie', params);
  }

  /**
   * Поиск сериалов с фильтрами
   * @param {Object} filters - Фильтры поиска
   * @returns {Promise<Object>} Результаты поиска
   */
  async discoverTV(filters = {}) {
    const params = {
      page: filters.page || 1,
      sort_by: filters.sortBy || 'popularity.desc',
      include_adult: false
    };

    if (filters.genres) {
      params.with_genres = filters.genres;
    }

    if (filters.year) {
      params.first_air_date_year = filters.year;
    }

    if (filters.minRating) {
      params['vote_average.gte'] = filters.minRating;
    }

    return await this.makeRequest('/discover/tv', params);
  }

  /**
   * Построение URL для изображения
   * @param {string} path - Путь к изображению из TMDb (например, poster_path)
   * @param {string} size - Размер изображения (w500, w780, original и т.д.)
   * @returns {string} Полный URL изображения
   */
  buildImageUrl(path, size = 'w500') {
    if (!path) {
      return null;
    }

    // Инициализируем базовый URL если еще не инициализирован
    const baseUrl = this.imageBaseUrl || 'https://image.tmdb.org/t/p/';
    
    // Убираем все начальные слеши
    const cleanPath = path.replace(/^\/+/, '');
    
    // Если после очистки путь пустой (был только "/"), возвращаем null
    if (!cleanPath) {
      return null;
    }
    
    // Убираем конечный слеш из baseUrl если он есть, затем добавляем один
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    
    return `${cleanBaseUrl}/${size}/${cleanPath}`;
  }
}

// Экспортируем singleton instance
const tmdbService = new TMDbService();

export default tmdbService;
