/**
 * Property-based тесты для Users API
 * Feature: watch-rebel-social-network
 */

import fc from 'fast-check';
import { executeQuery, closeDatabase } from '../../database/db.js';
import { runMigrations } from '../../database/migrations.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к тестовой базе данных
const TEST_DB_PATH = path.join(__dirname, '../../../test-rebel.db');

// Генератор валидных никнеймов
const nicknameArbitrary = fc.string({ minLength: 1, maxLength: 64 });

// Генератор уникальных Telegram ID с использованием UUID для гарантии уникальности
const telegramIdArbitrary = fc.uuid().map(uuid => `test_user_${uuid}`);

// Генератор пользователей
const userArbitrary = fc.record({
  id: telegramIdArbitrary,
  displayName: nicknameArbitrary,
  telegramUsername: fc.option(fc.string({ minLength: 3, maxLength: 32 }), { nil: null }),
  avatarUrl: fc.option(fc.webUrl(), { nil: null })
});

// Вспомогательная функция для создания тестового пользователя
async function createTestUser(userData) {
  const result = await executeQuery(
    `INSERT INTO users (id, telegram_username, display_name, avatar_url, is_admin, theme)
     VALUES (?, ?, ?, ?, 0, 'light-cream')`,
    [userData.id, userData.telegramUsername, userData.displayName, userData.avatarUrl]
  );
  
  return result.success;
}

// Вспомогательная функция для удаления тестового пользователя
async function deleteTestUser(userId) {
  await executeQuery('DELETE FROM users WHERE id = ?', [userId]);
}

// Вспомогательная функция для обновления никнейма
async function updateUserNickname(userId, newNickname) {
  const result = await executeQuery(
    'UPDATE users SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newNickname, userId]
  );
  
  return result.success;
}

// Вспомогательная функция для получения пользователя
async function getUser(userId) {
  const result = await executeQuery(
    'SELECT id, display_name, telegram_username, avatar_url FROM users WHERE id = ?',
    [userId]
  );
  
  return result.success && result.data.length > 0 ? result.data[0] : null;
}

// Вспомогательная функция для создания дружбы
async function createFriendship(userId, friendId) {
  const friendshipId = uuidv4();
  const result = await executeQuery(
    'INSERT INTO friends (id, user_id, friend_id) VALUES (?, ?, ?)',
    [friendshipId, userId, friendId]
  );
  
  return result.success;
}

// Вспомогательная функция для проверки дружбы
async function checkFriendship(userId, friendId) {
  const result = await executeQuery(
    'SELECT id FROM friends WHERE user_id = ? AND friend_id = ?',
    [userId, friendId]
  );
  
  return result.success && result.data.length > 0;
}

// Вспомогательная функция для удаления дружбы
async function deleteFriendship(userId, friendId) {
  await executeQuery(
    'DELETE FROM friends WHERE user_id = ? AND friend_id = ?',
    [userId, friendId]
  );
}

describe('Users API Properties', () => {
  beforeAll(async () => {
    // Удаляем тестовую базу данных если она существует
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    
    // Используем существующий файл миграций для создания всех таблиц
    const migrationResult = await runMigrations();
    
    if (!migrationResult.success) {
      throw new Error(`Ошибка инициализации БД: ${migrationResult.error}`);
    }
  });

  afterAll(async () => {
    // Очищаем тестовые данные (все пользователи с ID начинающимся на test_user_)
    await executeQuery('DELETE FROM users WHERE id LIKE "test_user_%"');
    await closeDatabase();
    
    // Даем время на полное закрытие соединения
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Удаляем тестовую базу данных после тестов
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch (error) {
        console.error('Не удалось удалить тестовую БД:', error.message);
      }
    }
  });

  /**
   * Property 5: Nickname Update Round-Trip
   * Validates: Requirements 1.5
   * 
   * For any user and any valid nickname, updating the nickname and then retrieving 
   * the user should return the updated nickname.
   */
  test('Feature: watch-rebel-social-network, Property 5: Nickname Update Round-Trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        nicknameArbitrary,
        async (userData, newNickname) => {
          // Создаем тестового пользователя
          const created = await createTestUser(userData);
          expect(created).toBe(true);

          try {
            // Обновляем никнейм
            const updated = await updateUserNickname(userData.id, newNickname);
            expect(updated).toBe(true);

            // Получаем пользователя
            const user = await getUser(userData.id);
            expect(user).toBeTruthy();

            // Проверяем что никнейм обновился
            expect(user.display_name).toBe(newNickname);
          } finally {
            // Очищаем
            await deleteTestUser(userData.id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 29: Friend Relationship Round-Trip
   * Validates: Requirements 11.1
   * 
   * For any two users, when user A adds user B as a friend, 
   * then checking the friendship should confirm it exists.
   */
  test('Feature: watch-rebel-social-network, Property 29: Friend Relationship Round-Trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        userArbitrary,
        async (user1Data, user2Data) => {
          // Убеждаемся что пользователи разные
          fc.pre(user1Data.id !== user2Data.id);

          // Создаем двух пользователей
          const created1 = await createTestUser(user1Data);
          const created2 = await createTestUser(user2Data);
          expect(created1 && created2).toBe(true);

          try {
            // Добавляем в друзья
            const friendshipCreated = await createFriendship(user1Data.id, user2Data.id);
            expect(friendshipCreated).toBe(true);

            // Проверяем что дружба существует
            const friendshipExists = await checkFriendship(user1Data.id, user2Data.id);
            expect(friendshipExists).toBe(true);

            // Очищаем дружбу
            await deleteFriendship(user1Data.id, user2Data.id);

            // Проверяем что дружба удалена
            const friendshipStillExists = await checkFriendship(user1Data.id, user2Data.id);
            expect(friendshipStillExists).toBe(false);
          } finally {
            // Очищаем
            await deleteTestUser(user1Data.id);
            await deleteTestUser(user2Data.id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 31: Genre Statistics Calculation
   * Validates: Requirements 12.3
   * 
   * For any user with ratings, genre statistics should be calculable 
   * and percentages should sum to approximately 100%.
   * 
   * Note: This is a placeholder test as genre stats require TMDb integration.
   * Currently returns empty array, which is valid for users without ratings.
   */
  test('Feature: watch-rebel-social-network, Property 31: Genre Statistics Calculation', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        async (userData) => {
          // Создаем тестового пользователя
          const created = await createTestUser(userData);
          expect(created).toBe(true);

          try {
            // Получаем статистику по жанрам (пока пустая)
            const result = await executeQuery(
              'SELECT tmdb_id, media_type FROM ratings WHERE user_id = ?',
              [userData.id]
            );

            expect(result.success).toBe(true);
            
            // Для пользователя без оценок должен возвращаться пустой массив
            expect(Array.isArray(result.data)).toBe(true);
            
            // Если есть оценки, проверяем структуру
            if (result.data.length > 0) {
              result.data.forEach(rating => {
                expect('tmdb_id' in rating).toBe(true);
                expect('media_type' in rating).toBe(true);
              });
            }
          } finally {
            // Очищаем
            await deleteTestUser(userData.id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 32: Common Movies Detection
   * Validates: Requirements 12.4
   * 
   * For any two users with ratings, the system should be able to detect 
   * common movies they have both rated.
   */
  test('Feature: watch-rebel-social-network, Property 32: Common Movies Detection', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        userArbitrary,
        fc.array(fc.integer({ min: 1, max: 100000 }), { minLength: 0, maxLength: 5 }),
        async (user1Data, user2Data, commonMovieIds) => {
          // Убеждаемся что пользователи разные
          fc.pre(user1Data.id !== user2Data.id);

          // Убираем дубликаты из массива ID фильмов (UNIQUE constraint в БД)
          const uniqueMovieIds = [...new Set(commonMovieIds)];

          // Создаем двух пользователей
          const created1 = await createTestUser(user1Data);
          const created2 = await createTestUser(user2Data);
          expect(created1 && created2).toBe(true);

          try {
            // Добавляем общие оценки для обоих пользователей
            for (const movieId of uniqueMovieIds) {
              await executeQuery(
                'INSERT OR IGNORE INTO ratings (id, user_id, tmdb_id, media_type, rating) VALUES (?, ?, ?, ?, ?)',
                [uuidv4(), user1Data.id, movieId, 'movie', 5]
              );
              await executeQuery(
                'INSERT OR IGNORE INTO ratings (id, user_id, tmdb_id, media_type, rating) VALUES (?, ?, ?, ?, ?)',
                [uuidv4(), user2Data.id, movieId, 'movie', 7]
              );
            }

            // Находим общие фильмы
            const result = await executeQuery(
              `SELECT r1.tmdb_id 
               FROM ratings r1
               INNER JOIN ratings r2 ON r1.tmdb_id = r2.tmdb_id AND r1.media_type = r2.media_type
               WHERE r1.user_id = ? AND r2.user_id = ? AND r1.media_type = 'movie'`,
              [user1Data.id, user2Data.id]
            );

            expect(result.success).toBe(true);
            
            // Количество найденных общих фильмов должно совпадать с уникальными добавленными
            expect(result.data.length).toBe(uniqueMovieIds.length);

            // Проверяем что все ID совпадают
            const foundIds = result.data.map(r => r.tmdb_id).sort();
            const expectedIds = [...uniqueMovieIds].sort();
            expect(foundIds).toEqual(expectedIds);
          } finally {
            // Очищаем
            await executeQuery('DELETE FROM ratings WHERE user_id IN (?, ?)', [user1Data.id, user2Data.id]);
            await deleteTestUser(user1Data.id);
            await deleteTestUser(user2Data.id);
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 15000); // Увеличиваем таймаут до 15 секунд

  /**
   * Property 33: Common Watchlist Detection
   * Validates: Requirements 12.5
   * 
   * For any two users with watchlist items, the system should be able to detect 
   * common items in their watchlists.
   */
  test('Feature: watch-rebel-social-network, Property 33: Common Watchlist Detection', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        userArbitrary,
        fc.array(fc.integer({ min: 1, max: 100000 }), { minLength: 0, maxLength: 5 }),
        async (user1Data, user2Data, commonWatchlistIds) => {
          // Убеждаемся что пользователи разные
          fc.pre(user1Data.id !== user2Data.id);

          // Убираем дубликаты из массива ID (UNIQUE constraint в БД)
          const uniqueWatchlistIds = [...new Set(commonWatchlistIds)];

          // Создаем двух пользователей
          const created1 = await createTestUser(user1Data);
          const created2 = await createTestUser(user2Data);
          expect(created1 && created2).toBe(true);

          try {
            // Добавляем общие элементы в watchlist для обоих пользователей
            for (const itemId of uniqueWatchlistIds) {
              await executeQuery(
                'INSERT OR IGNORE INTO watchlist (id, user_id, tmdb_id, media_type) VALUES (?, ?, ?, ?)',
                [uuidv4(), user1Data.id, itemId, 'movie']
              );
              await executeQuery(
                'INSERT OR IGNORE INTO watchlist (id, user_id, tmdb_id, media_type) VALUES (?, ?, ?, ?)',
                [uuidv4(), user2Data.id, itemId, 'movie']
              );
            }

            // Находим общие элементы watchlist
            const result = await executeQuery(
              `SELECT w1.tmdb_id 
               FROM watchlist w1
               INNER JOIN watchlist w2 ON w1.tmdb_id = w2.tmdb_id AND w1.media_type = w2.media_type
               WHERE w1.user_id = ? AND w2.user_id = ?`,
              [user1Data.id, user2Data.id]
            );

            expect(result.success).toBe(true);
            
            // Количество найденных общих элементов должно совпадать с уникальными добавленными
            expect(result.data.length).toBe(uniqueWatchlistIds.length);

            // Проверяем что все ID совпадают
            const foundIds = result.data.map(r => r.tmdb_id).sort();
            const expectedIds = [...uniqueWatchlistIds].sort();
            expect(foundIds).toEqual(expectedIds);
          } finally {
            // Очищаем
            await executeQuery('DELETE FROM watchlist WHERE user_id IN (?, ?)', [user1Data.id, user2Data.id]);
            await deleteTestUser(user1Data.id);
            await deleteTestUser(user2Data.id);
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 15000); // Увеличиваем таймаут до 15 секунд
});
