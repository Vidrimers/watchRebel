import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * TMDb Integration Service
 * Сервис для работы с The Movie Database API v3
 */

class TMDbService {
  constructor() {
    this.apiKey = process.env.TMDB_API_KEY;
    this.baseUrl = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
    this.language = 'ru-RU';
    this.imageBaseUrl = null;
    
    // Rate limiting: TMDb позволяет ~40 запросов в секунду
    this.requestQueue = [];
    this.isProcessing = false;
    this.minRequestInterval = 25; // 25ms между запросами = 40 req/sec
    this.lastRequestTime = 0;
  }

  /**
   * Инициализация сервиса - получение конфигурации для изображений
   */
  async initialize() {
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
   * Выполнение запроса с rate limiting
   */
  async makeRequest(endpoint, params = {}) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ endpoint, params, resolve, reject });
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

      const { endpoint, params, resolve, reject } = this.requestQueue.shift();

      try {
        const response = await axios.get(`${this.baseUrl}${endpoint}`, {
          params: {
            api_key: this.apiKey,
            language: this.language,
            ...params
          }
        });
        this.lastRequestTime = Date.now();
        resolve(response.data);
      } catch (error) {
        this.lastRequestTime = Date.now();
        reject(this.handleError(error));
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
    
    // Убираем начальный слеш если он есть
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    
    // Убираем конечный слеш из baseUrl если он есть, затем добавляем один
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    
    return `${cleanBaseUrl}/${size}/${cleanPath}`;
  }
}

// Экспортируем singleton instance
const tmdbService = new TMDbService();

export default tmdbService;
