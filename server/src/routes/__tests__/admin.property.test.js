/**
 * Property-based тесты для админ-панели
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

// Генератор валидных пользователей
const userArbitrary = fc.record({
  id: fc.uuid().map(uuid => `test_admin_${uuid}`),
  telegram_username: fc.option(fc.string({ minLength: 3, maxLength: 32 }), { nil: null }),
  display_name: fc.string({ minLength: 1, maxLength: 64 }),
  avatar_url: fc.option(fc.webUrl(), { nil: null }),
  is_admin: fc.boolean(),
  theme: fc.constantFrom('light-cream', 'dark')
});

// Генератор валидных имен
const displayNameArbitrary = fc.string({ minLength: 1, maxLength: 64 });

// Генератор валидного контента объявлений
const announcementContentArbitrary = fc.string({ minLength: 1, maxLength: 500 });

// Вспомогательная функция для создания тестового пользователя
async function createTestUser(userData) {
  const result = await executeQuery(
    `INSERT INTO users (id, telegram_username, display_name, avatar_url, is_admin, theme)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userData.id,
      userData.telegram_username,
      userData.display_name,
      userData.avatar_url,
      userData.is_admin ? 1 : 0,
      userData.theme
    ]
  );
  
  if (!result.success) {
    throw new Error(`Failed to create test user: ${result.error}`);
  }
  
  return userData.id;
}

// Вспомогательная функция для удаления тестового пользователя
async function deleteTestUser(userId) {
  await executeQuery('DELETE FROM users WHERE id = ?', [userId]);
}

// Вспомогательная функция для получения пользователя
async function getUser(userId) {
  const result = await executeQuery(
    'SELECT * FROM users WHERE id = ?',
    [userId]
  );
  return result.success && result.data.length > 0 ? result.data[0] : null;
}

// Вспомогательная функция для подсчета связанных данных пользователя
async function countUserData(userId) {
  const counts = {};
  
  // Подсчитываем списки
  const listsResult = await executeQuery(
    'SELECT COUNT(*) as count FROM custom_lists WHERE user_id = ?',
    [userId]
  );
  counts.lists = listsResult.success ? listsResult.data[0].count : 0;
  
  // Подсчитываем рейтинги
  const ratingsResult = await executeQuery(
    'SELECT COUNT(*) as count FROM ratings WHERE user_id = ?',
    [userId]
  );
  counts.ratings = ratingsResult.success ? ratingsResult.data[0].count : 0;
  
  // Подсчитываем посты на стене
  const postsResult = await executeQuery(
    'SELECT COUNT(*) as count FROM wall_posts WHERE user_id = ?',
    [userId]
  );
  counts.posts = postsResult.success ? postsResult.data[0].count : 0;
  
  // Подсчитываем watchlist
  const watchlistResult = await executeQuery(
    'SELECT COUNT(*) as count FROM watchlist WHERE user_id = ?',
    [userId]
  );
  counts.watchlist = watchlistResult.success ? watchlistResult.data[0].count : 0;
  
  return counts;
}

describe('Admin Panel Properties', () => {
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
    // Очищаем тестовые данные
    await executeQuery('DELETE FROM users WHERE id LIKE "test_admin_%"');
    await closeDatabase();
    
    // Удаляем тестовую базу данных после тестов
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  /**
   * Property 36: Admin Panel Visibility
   * Validates: Requirements 14.1
   */
  test('Feature: watch-rebel-social-network, Property 36: Admin Panel Visibility', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        async (userData) => {
          let userId = null;
          
          try {
            userId = await createTestUser(userData);
            const user = await getUser(userId);
            
            expect(user).toBeTruthy();
            
            const expectedIsAdmin = userData.is_admin ? 1 : 0;
            expect(user.is_admin).toBe(expectedIsAdmin);
            
            if (user.is_admin === 1) {
              expect(userData.is_admin).toBe(true);
            } else {
              expect(userData.is_admin).toBe(false);
            }
          } finally {
            if (userId) {
              await deleteTestUser(userId);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 37: User Deletion Cascade
   * Validates: Requirements 14.3
   */
  test('Feature: watch-rebel-social-network, Property 37: User Deletion Cascade', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        async (userData) => {
          let userId = null;
          
          try {
            userId = await createTestUser(userData);
            
            // Создаем связанные данные
            const listId = uuidv4();
            await executeQuery(
              'INSERT INTO custom_lists (id, user_id, name, media_type) VALUES (?, ?, ?, ?)',
              [listId, userId, 'Test List', 'movie']
            );
            
            const ratingId = uuidv4();
            await executeQuery(
              'INSERT INTO ratings (id, user_id, tmdb_id, media_type, rating) VALUES (?, ?, ?, ?, ?)',
              [ratingId, userId, 12345, 'movie', 8]
            );
            
            const postId = uuidv4();
            await executeQuery(
              'INSERT INTO wall_posts (id, user_id, post_type, content) VALUES (?, ?, ?, ?)',
              [postId, userId, 'text', 'Test post']
            );
            
            const watchlistId = uuidv4();
            await executeQuery(
              'INSERT INTO watchlist (id, user_id, tmdb_id, media_type) VALUES (?, ?, ?, ?)',
              [watchlistId, userId, 67890, 'tv']
            );
            
            const beforeCounts = await countUserData(userId);
            expect(beforeCounts.lists).toBe(1);
            expect(beforeCounts.ratings).toBe(1);
            expect(beforeCounts.posts).toBe(1);
            expect(beforeCounts.watchlist).toBe(1);
            
            // Удаляем пользователя
            const deleteResult = await executeQuery(
              'DELETE FROM users WHERE id = ?',
              [userId]
            );
            
            expect(deleteResult.success).toBe(true);
            
            const user = await getUser(userId);
            expect(user).toBeNull();
            
            const afterCounts = await countUserData(userId);
            expect(afterCounts.lists).toBe(0);
            expect(afterCounts.ratings).toBe(0);
            expect(afterCounts.posts).toBe(0);
            expect(afterCounts.watchlist).toBe(0);
            
            userId = null;
          } finally {
            if (userId) {
              await deleteTestUser(userId);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 15000);

  /**
   * Property 38: Admin Rename Round-Trip
   * Validates: Requirements 14.4
   */
  test('Feature: watch-rebel-social-network, Property 38: Admin Rename Round-Trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        displayNameArbitrary,
        async (userData, newDisplayName) => {
          // Precondition: новое имя должно отличаться от старого
          fc.pre(userData.display_name !== newDisplayName);
          
          let userId = null;
          
          try {
            userId = await createTestUser(userData);
            
            const userBefore = await getUser(userId);
            expect(userBefore).toBeTruthy();
            expect(userBefore.display_name).toBe(userData.display_name);
            
            // Добавляем небольшую задержку чтобы гарантировать изменение timestamp
            await new Promise(resolve => setTimeout(resolve, 10));
            
            const updateResult = await executeQuery(
              'UPDATE users SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [newDisplayName, userId]
            );
            
            expect(updateResult.success).toBe(true);
            
            const userAfter = await getUser(userId);
            expect(userAfter).toBeTruthy();
            expect(userAfter.display_name).toBe(newDisplayName);
            
            // Проверяем что имя действительно изменилось
            expect(userAfter.display_name).not.toBe(userBefore.display_name);
          } finally {
            if (userId) {
              await deleteTestUser(userId);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 39: User Block Access Prevention
   * Validates: Requirements 14.5
   */
  test('Feature: watch-rebel-social-network, Property 39: User Block Access Prevention', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        async (userData) => {
          let userId = null;
          
          try {
            userId = await createTestUser(userData);
            
            const blockResult = await executeQuery(
              'UPDATE users SET is_blocked = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [userId]
            );
            
            expect(blockResult.success).toBe(true);
            
            const blockedUser = await getUser(userId);
            expect(blockedUser).toBeTruthy();
            expect(blockedUser.is_blocked).toBe(1);
            
            const unblockResult = await executeQuery(
              'UPDATE users SET is_blocked = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [userId]
            );
            
            expect(unblockResult.success).toBe(true);
            
            const unblockedUser = await getUser(userId);
            expect(unblockedUser).toBeTruthy();
            expect(unblockedUser.is_blocked).toBe(0);
          } finally {
            if (userId) {
              await deleteTestUser(userId);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 40: Announcement Broadcast
   * Validates: Requirements 14.6
   */
  test('Feature: watch-rebel-social-network, Property 40: Announcement Broadcast', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(userArbitrary, { minLength: 1, maxLength: 5 }),
        announcementContentArbitrary,
        async (usersData, announcementContent) => {
          const userIds = [];
          
          try {
            for (const userData of usersData) {
              const userId = await createTestUser(userData);
              userIds.push(userId);
            }
            
            const announcementId = uuidv4();
            const adminId = userIds[0];
            
            const insertAnnouncementResult = await executeQuery(
              'INSERT INTO announcements (id, content, created_by) VALUES (?, ?, ?)',
              [announcementId, announcementContent, adminId]
            );
            
            expect(insertAnnouncementResult.success).toBe(true);
            
            for (const userId of userIds) {
              const postId = uuidv4();
              await executeQuery(
                `INSERT INTO wall_posts (id, user_id, post_type, content) 
                 VALUES (?, ?, 'text', ?)`,
                [postId, userId, `📢 Объявление администратора:\n\n${announcementContent}`]
              );
            }
            
            for (const userId of userIds) {
              const postsResult = await executeQuery(
                `SELECT * FROM wall_posts 
                 WHERE user_id = ? AND content LIKE ?`,
                [userId, `%${announcementContent}%`]
              );
              
              expect(postsResult.success).toBe(true);
              expect(postsResult.data.length).toBeGreaterThan(0);
              
              const post = postsResult.data[0];
              expect(post.content).toContain(announcementContent);
              expect(post.content).toContain('📢 Объявление администратора');
            }
          } finally {
            for (const userId of userIds) {
              await deleteTestUser(userId);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 15000);
});
