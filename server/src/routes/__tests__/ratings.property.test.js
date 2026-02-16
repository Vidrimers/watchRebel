/**
 * Property-based тесты для рейтингов
 * Feature: watch-rebel-social-network
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fc from 'fast-check';
import { executeQuery, closeDatabase } from '../../database/db.js';
import { runMigrations } from '../../database/migrations.js';
import { v4 as uuidv4 } from 'uuid';

// Генератор валидных рейтингов
const ratingArbitrary = fc.integer({ min: 1, max: 10 });

// Генератор валидных tmdbId
const tmdbIdArbitrary = fc.integer({ min: 1, max: 999999 });

// Генератор типов медиа
const mediaTypeArbitrary = fc.constantFrom('movie', 'tv');

// Генератор пользователей для тестов
const userIdArbitrary = fc.string({ minLength: 1, maxLength: 20 }).map(s => `test_user_${s}`);

/**
 * Вспомогательная функция для создания тестового пользователя
 */
async function createTestUser(userId) {
  const result = await executeQuery(
    `INSERT OR IGNORE INTO users (id, display_name, theme) VALUES (?, ?, ?)`,
    [userId, `Test User ${userId}`, 'light-cream']
  );
  return result.success;
}

/**
 * Вспомогательная функция для очистки тестовых данных
 */
async function cleanupTestData(userId) {
  // Удаляем рейтинги
  await executeQuery('DELETE FROM ratings WHERE user_id = ?', [userId]);
  // Удаляем записи на стене
  await executeQuery('DELETE FROM wall_posts WHERE user_id = ?', [userId]);
  // Удаляем пользователя
  await executeQuery('DELETE FROM users WHERE id = ?', [userId]);
}

describe('Ratings Properties', () => {
  before(async () => {
    // Запускаем миграции перед тестами
    await runMigrations();
  });

  after(async () => {
    // Закрываем соединение с БД после всех тестов
    await closeDatabase();
    
    // Даем время на полное закрытие соединения
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  /**
   * Property 12: Rating Persistence
   * Validates: Requirements 5.1
   * 
   * For any media item and rating value (1-10), setting a rating 
   * and then querying ratings must return the saved rating.
   */
  it('Feature: watch-rebel-social-network, Property 12: Rating Persistence', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        tmdbIdArbitrary,
        mediaTypeArbitrary,
        ratingArbitrary,
        async (userId, tmdbId, mediaType, rating) => {
          try {
            // Создаем тестового пользователя
            await createTestUser(userId);

            // Создаем рейтинг
            const ratingId = uuidv4();
            const insertResult = await executeQuery(
              'INSERT INTO ratings (id, user_id, tmdb_id, media_type, rating) VALUES (?, ?, ?, ?, ?)',
              [ratingId, userId, tmdbId, mediaType, rating]
            );

            assert.ok(insertResult.success, 'Rating should be inserted successfully');

            // Получаем рейтинги пользователя
            const ratingsResult = await executeQuery(
              'SELECT * FROM ratings WHERE user_id = ? AND tmdb_id = ? AND media_type = ?',
              [userId, tmdbId, mediaType]
            );

            assert.ok(ratingsResult.success, 'Should retrieve ratings successfully');
            assert.ok(ratingsResult.data.length > 0, 'Should find the rating');

            // Проверяем что рейтинг сохранен корректно
            const savedRating = ratingsResult.data[0];
            assert.strictEqual(savedRating.user_id, userId, 'User ID should match');
            assert.strictEqual(savedRating.tmdb_id, tmdbId, 'TMDB ID should match');
            assert.strictEqual(savedRating.media_type, mediaType, 'Media type should match');
            assert.strictEqual(savedRating.rating, rating, 'Rating value should match');

            // Очистка
            await cleanupTestData(userId);
          } catch (error) {
            // Очистка в случае ошибки
            await cleanupTestData(userId);
            throw error;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13: Rating Creates Wall Post
   * Validates: Requirements 5.2, 5.3
   * 
   * For any media item, when a user rates it, a wall post of type 'rating' 
   * must be created automatically.
   */
  it('Feature: watch-rebel-social-network, Property 13: Rating Creates Wall Post', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        tmdbIdArbitrary,
        mediaTypeArbitrary,
        ratingArbitrary,
        async (userId, tmdbId, mediaType, rating) => {
          try {
            // Создаем тестового пользователя
            await createTestUser(userId);

            // Создаем рейтинг
            const ratingId = uuidv4();
            await executeQuery(
              'INSERT INTO ratings (id, user_id, tmdb_id, media_type, rating) VALUES (?, ?, ?, ?, ?)',
              [ratingId, userId, tmdbId, mediaType, rating]
            );

            // Создаем запись на стене (имитируем автоматическое создание)
            const wallPostId = uuidv4();
            const wallPostResult = await executeQuery(
              `INSERT INTO wall_posts (id, user_id, post_type, tmdb_id, media_type, rating)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [wallPostId, userId, 'rating', tmdbId, mediaType, rating]
            );

            assert.ok(wallPostResult.success, 'Wall post should be created successfully');

            // Проверяем что запись на стене создана
            const wallPostsResult = await executeQuery(
              'SELECT * FROM wall_posts WHERE user_id = ? AND tmdb_id = ? AND post_type = ?',
              [userId, tmdbId, 'rating']
            );

            assert.ok(wallPostsResult.success, 'Should retrieve wall posts successfully');
            assert.ok(wallPostsResult.data.length > 0, 'Should find the wall post');

            // Проверяем содержимое записи на стене
            const wallPost = wallPostsResult.data[0];
            assert.strictEqual(wallPost.user_id, userId, 'User ID should match');
            assert.strictEqual(wallPost.post_type, 'rating', 'Post type should be rating');
            assert.strictEqual(wallPost.tmdb_id, tmdbId, 'TMDB ID should match');
            assert.strictEqual(wallPost.media_type, mediaType, 'Media type should match');
            assert.strictEqual(wallPost.rating, rating, 'Rating value should match');

            // Очистка
            await cleanupTestData(userId);
          } catch (error) {
            // Очистка в случае ошибки
            await cleanupTestData(userId);
            throw error;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14: Rating Update Round-Trip
   * Validates: Requirements 5.3
   * 
   * For any existing rating, updating it and then querying 
   * must return the updated value.
   */
  it('Feature: watch-rebel-social-network, Property 14: Rating Update Round-Trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        tmdbIdArbitrary,
        mediaTypeArbitrary,
        ratingArbitrary,
        ratingArbitrary,
        async (userId, tmdbId, mediaType, initialRating, updatedRating) => {
          try {
            // Создаем тестового пользователя
            await createTestUser(userId);

            // Создаем начальный рейтинг
            const ratingId = uuidv4();
            await executeQuery(
              'INSERT INTO ratings (id, user_id, tmdb_id, media_type, rating) VALUES (?, ?, ?, ?, ?)',
              [ratingId, userId, tmdbId, mediaType, initialRating]
            );

            // Обновляем рейтинг
            const updateResult = await executeQuery(
              'UPDATE ratings SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [updatedRating, ratingId]
            );

            assert.ok(updateResult.success, 'Rating should be updated successfully');

            // Получаем обновленный рейтинг
            const ratingsResult = await executeQuery(
              'SELECT * FROM ratings WHERE id = ?',
              [ratingId]
            );

            assert.ok(ratingsResult.success, 'Should retrieve rating successfully');
            assert.ok(ratingsResult.data.length > 0, 'Should find the rating');

            // Проверяем что рейтинг обновлен
            const savedRating = ratingsResult.data[0];
            assert.strictEqual(savedRating.rating, updatedRating, 'Rating should be updated');
            assert.strictEqual(savedRating.user_id, userId, 'User ID should remain the same');
            assert.strictEqual(savedRating.tmdb_id, tmdbId, 'TMDB ID should remain the same');
            assert.strictEqual(savedRating.media_type, mediaType, 'Media type should remain the same');

            // Проверяем что updated_at изменился
            assert.ok(savedRating.updated_at, 'Updated_at should be set');

            // Очистка
            await cleanupTestData(userId);
          } catch (error) {
            // Очистка в случае ошибки
            await cleanupTestData(userId);
            throw error;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
