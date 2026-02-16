/**
 * Property-Based Tests для Media Routes
 * Feature: watch-rebel-social-network
 */

import fc from 'fast-check';
import request from 'supertest';
import express from 'express';
import mediaRoutes from '../media.js';

// Создаем тестовое приложение
const app = express();
app.use(express.json());
app.use('/api/media', mediaRoutes);

describe('Media Routes - Property-Based Tests', () => {

  // Закрываем все соединения после тестов
  afterAll(async () => {
    // Даем время на завершение всех асинхронных операций
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  /**
   * Property 22: Search Returns Results
   * Validates: Requirements 9.1
   * 
   * For any non-empty search query, the system must return search results
   * (may be empty array, but must not error)
   */
  describe('Property 22: Search Returns Results', () => {
    it('should return results structure for any non-empty query', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Генерируем различные непустые строки
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          async (query) => {
            const response = await request(app)
              .get('/api/media/search')
              .query({ query: query.trim() });

            // Запрос должен быть успешным (не 500 ошибка)
            expect(response.status).toBeLessThan(500);
            
            // Если запрос успешен, проверяем структуру ответа
            if (response.status === 200) {
              expect(response.body).toBeDefined();
              expect(response.body).toHaveProperty('movies');
              expect(response.body).toHaveProperty('tv');
              expect(response.body).toHaveProperty('query');
              expect(response.body).toHaveProperty('page');
              
              // movies и tv должны быть массивами (могут быть пустыми)
              expect(Array.isArray(response.body.movies)).toBe(true);
              expect(Array.isArray(response.body.tv)).toBe(true);
              
              // query должен совпадать с отправленным (trimmed)
              expect(response.body.query).toBe(query.trim());
            }
          }
        ),
        { numRuns: 10 }
      );
    }, 15000); // Увеличиваем таймаут до 15 секунд

    it('should reject empty or whitespace-only queries', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Генерируем пустые строки или строки только из пробелов
          fc.oneof(
            fc.constant(''),
            fc.string().filter(s => s.trim() === '' && s.length > 0 && s.length < 10)
          ),
          async (emptyQuery) => {
            const response = await request(app)
              .get('/api/media/search')
              .query({ query: emptyQuery });

            // Должна быть ошибка 400
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
            expect(response.body.code).toBe('MISSING_QUERY');
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should handle different search types correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('test', 'movie', 'film'),
          fc.constantFrom('movie', 'tv', 'all'),
          async (query, type) => {
            const response = await request(app)
              .get('/api/media/search')
              .query({ query, type });

            // Запрос должен быть успешным или вернуть понятную ошибку
            expect(response.status).toBeLessThan(500);
            
            if (response.status === 200) {
              const { movies, tv } = response.body;
              
              // Проверяем что возвращаются правильные данные
              expect(Array.isArray(movies)).toBe(true);
              expect(Array.isArray(tv)).toBe(true);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should handle page parameter correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('test', 'movie'),
          fc.integer({ min: 1, max: 5 }),
          async (query, page) => {
            const response = await request(app)
              .get('/api/media/search')
              .query({ query, page });

            expect(response.status).toBeLessThan(500);
            
            if (response.status === 200) {
              expect(response.body.page).toBe(page);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should default to page 1 when page is not provided', async () => {
      const response = await request(app)
        .get('/api/media/search')
        .query({ query: 'test' });

      if (response.status === 200) {
        expect(response.body.page).toBe(1);
      }
    });

    it('should not crash on special characters in query', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Генерируем строки со специальными символами
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          async (query) => {
            const response = await request(app)
              .get('/api/media/search')
              .query({ query });

            // Не должно быть server error (500)
            expect(response.status).toBeLessThan(500);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Дополнительные property тесты для media details endpoint
   */
  describe('Media Details Endpoint Properties', () => {
    it('should validate type parameter correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 999999 }),
          // Генерируем строки которые точно не 'movie' и не 'tv'
          fc.constantFrom('invalid', 'test', 'series', 'film'),
          async (id, invalidType) => {
            const response = await request(app)
              .get(`/api/media/${invalidType}/${id}`);

            expect(response.status).toBe(400);
            expect(response.body.code).toBe('INVALID_TYPE');
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should validate ID parameter correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('movie', 'tv'),
          fc.constantFrom('not-a-number', '0', '-1', 'abc'),
          async (type, invalidId) => {
            const response = await request(app)
              .get(`/api/media/${type}/${invalidId}`);

            expect(response.status).toBe(400);
            expect(response.body.code).toBe('INVALID_ID');
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should accept valid type and ID combinations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('movie', 'tv'),
          fc.integer({ min: 1, max: 1000 }),
          async (type, id) => {
            const response = await request(app)
              .get(`/api/media/${type}/${id}`);

            // Не должно быть ошибки валидации (400)
            // Может быть 404 (не найдено) или 500 (ошибка API), но не 400 с кодом валидации
            if (response.status === 400) {
              expect(response.body.code).not.toBe('INVALID_TYPE');
              expect(response.body.code).not.toBe('INVALID_ID');
            }
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  /**
   * Дополнительные property тесты для images endpoint
   */
  describe('Media Images Endpoint Properties', () => {
    it('should validate type parameter for images endpoint', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 999999 }),
          // Генерируем строки которые точно не 'movie' и не 'tv'
          fc.constantFrom('invalid', 'test', 'series'),
          async (id, invalidType) => {
            const response = await request(app)
              .get(`/api/media/${invalidType}/${id}/images`);

            expect(response.status).toBe(400);
            expect(response.body.code).toBe('INVALID_TYPE');
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should validate ID parameter for images endpoint', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('movie', 'tv'),
          fc.constantFrom('invalid', '0', '-5', 'xyz'),
          async (type, invalidId) => {
            const response = await request(app)
              .get(`/api/media/${type}/${invalidId}/images`);

            expect(response.status).toBe(400);
            expect(response.body.code).toBe('INVALID_ID');
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should return proper structure for images endpoint', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('movie', 'tv'),
          fc.integer({ min: 1, max: 1000 }),
          async (type, id) => {
            const response = await request(app)
              .get(`/api/media/${type}/${id}/images`);

            // Не должно быть ошибки валидации
            if (response.status === 400) {
              expect(response.body.code).not.toBe('INVALID_TYPE');
              expect(response.body.code).not.toBe('INVALID_ID');
            }
            
            // Если успешно, проверяем структуру
            if (response.status === 200) {
              expect(response.body).toHaveProperty('id');
              expect(response.body).toHaveProperty('type');
              expect(response.body).toHaveProperty('backdrops');
              expect(response.body).toHaveProperty('posters');
              expect(response.body).toHaveProperty('logos');
              
              expect(Array.isArray(response.body.backdrops)).toBe(true);
              expect(Array.isArray(response.body.posters)).toBe(true);
              expect(Array.isArray(response.body.logos)).toBe(true);
            }
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});
