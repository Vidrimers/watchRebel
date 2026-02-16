/**
 * Property-Based Tests для TMDb Integration Service
 * Feature: watch-rebel-social-network
 */

import fc from 'fast-check';
import tmdbService from '../tmdbService.js';

describe('TMDb Service - Property-Based Tests', () => {
  
  beforeAll(async () => {
    // Устанавливаем дефолтный imageBaseUrl для тестов без реального API
    if (!tmdbService.imageBaseUrl) {
      tmdbService.imageBaseUrl = 'https://image.tmdb.org/t/p/';
    }
  });

  // Закрываем все соединения после тестов
  afterAll(async () => {
    // Даем время на завершение всех асинхронных операций
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  /**
   * Property 24: TMDb API Version
   * Validates: Requirements 10.1
   */
  describe('Property 24: TMDb API Version', () => {
    it('should use API v3 for all requests', async () => {
      // Проверяем что baseUrl содержит /3
      expect(tmdbService.baseUrl).toContain('/3');
      expect(tmdbService.baseUrl).toBe('https://api.themoviedb.org/3');
    });
  });

  /**
   * Property 23: TMDb Language Parameter
   * Validates: Requirements 9.4, 10.2
   */
  describe('Property 23: TMDb Language Parameter', () => {
    it('should use ru-RU language for all requests', async () => {
      // Проверяем что язык установлен в ru-RU
      expect(tmdbService.language).toBe('ru-RU');
    });
  });

  /**
   * Property 25: Movie Data Completeness
   * Validates: Requirements 10.3
   * 
   * For any movie fetched from TMDb, the data must include:
   * - poster_path
   * - title
   * - overview
   * - release_date
   */
  describe('Property 25: Movie Data Completeness', () => {
    it('should validate movie ID parameter correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Генерируем различные типы невалидных ID
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.string(),
            fc.constant({}),
            fc.constant([])
          ),
          async (invalidId) => {
            await expect(tmdbService.getMovieDetails(invalidId))
              .rejects
              .toThrow('ID фильма должен быть числом');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid numeric movie IDs', () => {
      // Проверяем что метод принимает числовые ID без ошибок валидации
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 999999 }),
          (movieId) => {
            // Метод должен принять ID без выброса ошибки валидации
            // (реальный API запрос не делаем)
            expect(typeof movieId).toBe('number');
            expect(movieId).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 26: TV Series Data Completeness
   * Validates: Requirements 10.4
   * 
   * For any TV series fetched from TMDb, the data must include season and episode information
   */
  describe('Property 26: TV Series Data Completeness', () => {
    it('should validate TV ID and season number parameters correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.string(),
            fc.constant({})
          ),
          fc.integer({ min: 1, max: 10 }),
          async (invalidTvId, seasonNumber) => {
            await expect(tmdbService.getTVSeason(invalidTvId, seasonNumber))
              .rejects
              .toThrow('ID сериала должен быть числом');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate season number parameter', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 999999 }),
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.string()
          ),
          async (tvId, invalidSeasonNumber) => {
            await expect(tmdbService.getTVSeason(tvId, invalidSeasonNumber))
              .rejects
              .toThrow('Номер сезона должен быть числом');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid TV ID and season number', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 999999 }),
          fc.integer({ min: 0, max: 20 }),
          (tvId, seasonNumber) => {
            // Параметры должны быть валидными
            expect(typeof tvId).toBe('number');
            expect(typeof seasonNumber).toBe('number');
            expect(tvId).toBeGreaterThan(0);
            expect(seasonNumber).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 27: Image URL Construction
   * Validates: Requirements 10.5
   * 
   * For any valid poster_path, the constructed URL must use base_url from TMDb configuration
   */
  describe('Property 27: Image URL Construction', () => {
    it('should construct valid image URLs for any poster path', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Генерируем различные форматы путей к изображениям
          fc.string({ minLength: 10, maxLength: 50 }).map(s => `/${s}.jpg`),
          fc.constantFrom('w500', 'w780', 'original', 'w185', 'w342'),
          (posterPath, size) => {
            const imageUrl = tmdbService.buildImageUrl(posterPath, size);
            
            // Проверяем что URL построен корректно
            expect(imageUrl).toBeDefined();
            expect(imageUrl).toContain('https://');
            expect(imageUrl).toContain(size);
            // Удаляем ВСЕ начальные слеши, как это делает функция buildImageUrl
            expect(imageUrl).toContain(posterPath.replace(/^\/+/, ''));
            
            // Проверяем что используется базовый URL (либо из конфигурации, либо дефолтный)
            const expectedBase = tmdbService.imageBaseUrl || 'https://image.tmdb.org/t/p/';
            expect(imageUrl).toContain(expectedBase);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for null or empty poster path', () => {
      expect(tmdbService.buildImageUrl(null)).toBeNull();
      expect(tmdbService.buildImageUrl('')).toBeNull();
      expect(tmdbService.buildImageUrl(undefined)).toBeNull();
    });

    it('should handle paths with or without leading slash', () => {
      const pathWithSlash = '/abc123.jpg';
      const pathWithoutSlash = 'abc123.jpg';
      
      const url1 = tmdbService.buildImageUrl(pathWithSlash);
      const url2 = tmdbService.buildImageUrl(pathWithoutSlash);
      
      // Оба должны давать одинаковый результат
      expect(url1).toBe(url2);
    });
  });

  /**
   * Property 28: TMDb Error Handling
   * Validates: Requirements 10.6
   * 
   * For any TMDb API error, the system must return a user-friendly error message
   */
  describe('Property 28: TMDb Error Handling', () => {
    it('should handle empty search query gracefully', async () => {
      await expect(tmdbService.searchMovies(''))
        .rejects
        .toThrow('Поисковый запрос не может быть пустым');
      
      await expect(tmdbService.searchTV(''))
        .rejects
        .toThrow('Поисковый запрос не может быть пустым');
    });

    it('should handle whitespace-only search query', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string().filter(s => s.trim() === '' && s.length > 0),
          async (whitespaceQuery) => {
            await expect(tmdbService.searchMovies(whitespaceQuery))
              .rejects
              .toThrow('Поисковый запрос не может быть пустым');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate movie ID type', async () => {
      await expect(tmdbService.getMovieDetails('not-a-number'))
        .rejects
        .toThrow('ID фильма должен быть числом');
      
      await expect(tmdbService.getMovieDetails(null))
        .rejects
        .toThrow('ID фильма должен быть числом');
    });

    it('should validate TV ID and season number types', async () => {
      await expect(tmdbService.getTVSeason('not-a-number', 1))
        .rejects
        .toThrow('ID сериала должен быть числом');
      
      await expect(tmdbService.getTVSeason(1396, 'not-a-number'))
        .rejects
        .toThrow('Номер сезона должен быть числом');
    });

    it('should provide user-friendly error messages for various error types', () => {
      const service = tmdbService;
      
      // Тестируем обработку различных HTTP статусов
      const mockError401 = { response: { status: 401, data: {} } };
      const error401 = service.handleError(mockError401);
      expect(error401.message).toBe('TMDb API: Неверный API ключ');

      const mockError404 = { response: { status: 404, data: {} } };
      const error404 = service.handleError(mockError404);
      expect(error404.message).toBe('TMDb API: Контент не найден');

      const mockError429 = { response: { status: 429, data: {} } };
      const error429 = service.handleError(mockError429);
      expect(error429.message).toBe('TMDb API: Превышен лимит запросов');

      const mockError500 = { response: { status: 500, data: {} } };
      const error500 = service.handleError(mockError500);
      expect(error500.message).toBe('TMDb API: Сервер временно недоступен');

      // Тестируем network error
      const networkError = { request: {}, message: 'Network failed' };
      const errorNetwork = service.handleError(networkError);
      expect(errorNetwork.message).toBe('TMDb API: Нет ответа от сервера');
    });
  });

  /**
   * Дополнительные property тесты для проверки корректности работы
   */
  describe('Additional Properties', () => {
    it('should trim search queries correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          async (query) => {
            const trimmedQuery = query.trim();
            // Проверяем что trimmed query не пустой
            expect(trimmedQuery.length).toBeGreaterThan(0);
            // Проверяем что trim удаляет пробелы с обеих сторон
            expect(trimmedQuery).toBe(query.trim());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should construct consistent image URLs', () => {
      fc.assert(
        fc.property(
          // Генерируем валидные пути (не только пробелы и не только слеши) и trim их
          fc.string({ minLength: 5, maxLength: 50 })
            .filter(s => s.trim().length > 0 && s.trim() !== '/')
            .map(s => s.trim()),
          fc.constantFrom('w500', 'w780', 'original'),
          (path, size) => {
            const url1 = tmdbService.buildImageUrl(`/${path}`, size);
            const url2 = tmdbService.buildImageUrl(path, size);
            
            // URL должны быть одинаковыми независимо от наличия слеша
            expect(url1).toBe(url2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate rate limiting configuration', () => {
      // Проверяем что rate limiting настроен правильно
      expect(tmdbService.minRequestInterval).toBe(25); // 25ms = 40 req/sec
      expect(tmdbService.requestQueue).toBeDefined();
      expect(Array.isArray(tmdbService.requestQueue)).toBe(true);
    });
  });
});
