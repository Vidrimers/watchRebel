/**
 * Property-Based Tests для Wall API
 * Feature: watch-rebel-social-network
 */

import fc from 'fast-check';
import request from 'supertest';
import app from '../../index.js';
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

describe('Wall API - Property-Based Tests', () => {
  let testUser;
  let testToken;
  let anotherUser;

  beforeAll(async () => {
    // Удаляем тестовую базу данных если она существует
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    
    // Запускаем миграции для создания всех таблиц
    const migrationResult = await runMigrations();
    
    if (!migrationResult.success) {
      throw new Error(`Ошибка инициализации БД: ${migrationResult.error}`);
    }

    // Создаем тестового пользователя
    const userId = uuidv4();
    testUser = {
      id: userId,
      telegram_username: 'testuser',
      display_name: 'Test User',
      avatar_url: 'https://example.com/avatar.jpg'
    };

    await executeQuery(
      `INSERT INTO users (id, telegram_username, display_name, avatar_url)
       VALUES (?, ?, ?, ?)`,
      [testUser.id, testUser.telegram_username, testUser.display_name, testUser.avatar_url]
    );

    // Создаем сессию для тестового пользователя
    const sessionId = uuidv4();
    testToken = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await executeQuery(
      `INSERT INTO sessions (id, user_id, token, expires_at)
       VALUES (?, ?, ?, ?)`,
      [sessionId, testUser.id, testToken, expiresAt]
    );

    // Создаем второго пользователя для тестов реакций
    const anotherUserId = uuidv4();
    anotherUser = {
      id: anotherUserId,
      telegram_username: 'anotheruser',
      display_name: 'Another User',
      avatar_url: 'https://example.com/avatar2.jpg'
    };

    await executeQuery(
      `INSERT INTO users (id, telegram_username, display_name, avatar_url)
       VALUES (?, ?, ?, ?)`,
      [anotherUser.id, anotherUser.telegram_username, anotherUser.display_name, anotherUser.avatar_url]
    );
  });

  afterAll(async () => {
    // Очищаем тестовые данные
    await executeQuery('DELETE FROM sessions WHERE user_id = ?', [testUser.id]);
    await executeQuery('DELETE FROM users WHERE id IN (?, ?)', [testUser.id, anotherUser.id]);
    await closeDatabase();
    
    // Удаляем тестовую базу данных после тестов
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  afterEach(async () => {
    // Очищаем записи стены и реакции после каждого теста
    // Используем более надежную очистку с задержкой
    await new Promise(resolve => setTimeout(resolve, 100));
    await executeQuery('DELETE FROM reactions');
    await executeQuery('DELETE FROM wall_posts WHERE user_id IN (?, ?)', [testUser.id, anotherUser.id]);
    await executeQuery('DELETE FROM notifications WHERE user_id IN (?, ?)', [testUser.id, anotherUser.id]);
  });

  /**
   * Property 15: Wall Post Creation Round-Trip
   * Validates: Requirements 6.1
   * 
   * For any valid wall post, creating it and then retrieving it should return the same data
   */
  describe('Property 15: Wall Post Creation Round-Trip', () => {
    it('should create and retrieve text posts correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          async (content) => {
            // Создаем текстовый пост
            const createResponse = await request(app)
              .post('/api/wall')
              .set('Authorization', `Bearer ${testToken}`)
              .send({
                postType: 'text',
                content: content
              });

            expect(createResponse.status).toBe(201);
            expect(createResponse.body.postType).toBe('text');
            expect(createResponse.body.content).toBe(content);
            expect(createResponse.body.userId).toBe(testUser.id);

            const postId = createResponse.body.id;

            // Получаем стену пользователя
            const getResponse = await request(app)
              .get(`/api/wall/${testUser.id}`);

            expect(getResponse.status).toBe(200);
            
            // Находим созданный пост
            const foundPost = getResponse.body.find(p => p.id === postId);
            expect(foundPost).toBeDefined();
            expect(foundPost.content).toBe(content);
            expect(foundPost.postType).toBe('text');
            expect(foundPost.userId).toBe(testUser.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create and retrieve rating posts correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 999999 }),
          fc.constantFrom('movie', 'tv'),
          fc.integer({ min: 1, max: 10 }),
          async (tmdbId, mediaType, rating) => {
            // Создаем пост с рейтингом
            const createResponse = await request(app)
              .post('/api/wall')
              .set('Authorization', `Bearer ${testToken}`)
              .send({
                postType: 'rating',
                tmdbId,
                mediaType,
                rating
              });

            expect(createResponse.status).toBe(201);
            expect(createResponse.body.postType).toBe('rating');
            expect(createResponse.body.tmdbId).toBe(tmdbId);
            expect(createResponse.body.mediaType).toBe(mediaType);
            expect(createResponse.body.rating).toBe(rating);

            const postId = createResponse.body.id;

            // Получаем стену пользователя
            const getResponse = await request(app)
              .get(`/api/wall/${testUser.id}`);

            expect(getResponse.status).toBe(200);
            
            // Находим созданный пост
            const foundPost = getResponse.body.find(p => p.id === postId);
            expect(foundPost).toBeDefined();
            expect(foundPost.tmdbId).toBe(tmdbId);
            expect(foundPost.mediaType).toBe(mediaType);
            expect(foundPost.rating).toBe(rating);
            expect(foundPost.postType).toBe('rating');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create and retrieve review posts correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 999999 }),
          fc.constantFrom('movie', 'tv'),
          fc.string({ minLength: 10, maxLength: 1000 }).filter(s => s.trim().length >= 10),
          async (tmdbId, mediaType, content) => {
            // Создаем пост с отзывом
            const createResponse = await request(app)
              .post('/api/wall')
              .set('Authorization', `Bearer ${testToken}`)
              .send({
                postType: 'review',
                tmdbId,
                mediaType,
                content
              });

            expect(createResponse.status).toBe(201);
            expect(createResponse.body.postType).toBe('review');
            expect(createResponse.body.content).toBe(content);
            expect(createResponse.body.tmdbId).toBe(tmdbId);
            expect(createResponse.body.mediaType).toBe(mediaType);

            const postId = createResponse.body.id;

            // Получаем стену пользователя
            const getResponse = await request(app)
              .get(`/api/wall/${testUser.id}`);

            expect(getResponse.status).toBe(200);
            
            // Находим созданный пост
            const foundPost = getResponse.body.find(p => p.id === postId);
            expect(foundPost).toBeDefined();
            expect(foundPost.content).toBe(content);
            expect(foundPost.tmdbId).toBe(tmdbId);
            expect(foundPost.mediaType).toBe(mediaType);
            expect(foundPost.postType).toBe('review');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 16: Media Addition Creates Wall Post
   * Validates: Requirements 6.2
   * 
   * For any media item added to a list, a wall post should be automatically created
   * Note: This is tested indirectly through the lists API
   */
  describe('Property 16: Media Addition Creates Wall Post', () => {
    it('should create wall post when media_added post type is used', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 999999 }),
          fc.constantFrom('movie', 'tv'),
          async (tmdbId, mediaType) => {
            // Создаем пост типа media_added
            const createResponse = await request(app)
              .post('/api/wall')
              .set('Authorization', `Bearer ${testToken}`)
              .send({
                postType: 'media_added',
                tmdbId,
                mediaType
              });

            expect(createResponse.status).toBe(201);
            expect(createResponse.body.postType).toBe('media_added');
            expect(createResponse.body.tmdbId).toBe(tmdbId);
            expect(createResponse.body.mediaType).toBe(mediaType);

            // Проверяем что пост появился на стене
            const getResponse = await request(app)
              .get(`/api/wall/${testUser.id}`);

            expect(getResponse.status).toBe(200);
            const foundPost = getResponse.body.find(p => 
              p.postType === 'media_added' && 
              p.tmdbId === tmdbId && 
              p.mediaType === mediaType
            );
            expect(foundPost).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 17: Review Post Round-Trip
   * Validates: Requirements 6.4
   * 
   * For any review post, the content and media information should be preserved
   */
  describe('Property 17: Review Post Round-Trip', () => {
    it('should preserve review content and media info through round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tmdbId: fc.integer({ min: 1, max: 999999 }),
            mediaType: fc.constantFrom('movie', 'tv'),
            content: fc.string({ minLength: 20, maxLength: 2000 }).filter(s => s.trim().length >= 20)
          }),
          async ({ tmdbId, mediaType, content }) => {
            // Создаем отзыв
            const createResponse = await request(app)
              .post('/api/wall')
              .set('Authorization', `Bearer ${testToken}`)
              .send({
                postType: 'review',
                tmdbId,
                mediaType,
                content
              });

            expect(createResponse.status).toBe(201);
            const postId = createResponse.body.id;

            // Получаем пост обратно
            const getResponse = await request(app)
              .get(`/api/wall/${testUser.id}`);

            expect(getResponse.status).toBe(200);
            const foundPost = getResponse.body.find(p => p.id === postId);

            // Проверяем что все данные сохранились
            expect(foundPost).toBeDefined();
            expect(foundPost.postType).toBe('review');
            expect(foundPost.content).toBe(content);
            expect(foundPost.tmdbId).toBe(tmdbId);
            expect(foundPost.mediaType).toBe(mediaType);
            expect(foundPost.userId).toBe(testUser.id);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 18: Wall Chronological Order
   * Validates: Requirements 6.5
   * 
   * For any sequence of posts, they should be returned in chronological order (newest first)
   */
  describe('Property 18: Wall Chronological Order', () => {
    it('should return posts in chronological order (newest first)', async () => {
      // Очищаем посты перед тестом
      await executeQuery('DELETE FROM wall_posts WHERE user_id = ?', [testUser.id]);
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            { minLength: 3, maxLength: 4 } // Уменьшил максимум для ускорения
          ),
          async (contents) => {
            // Очищаем посты перед каждой итерацией
            await executeQuery('DELETE FROM wall_posts WHERE user_id = ?', [testUser.id]);
            
            // Создаем несколько постов последовательно
            const postIds = [];
            for (const content of contents) {
              const response = await request(app)
                .post('/api/wall')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                  postType: 'text',
                  content
                });
              
              expect(response.status).toBe(201);
              postIds.push(response.body.id);
              
              // SQLite CURRENT_TIMESTAMP имеет точность до секунды, поэтому нужна задержка >= 1000ms
              await new Promise(resolve => setTimeout(resolve, 1100));
            }

            // Получаем стену
            const getResponse = await request(app)
              .get(`/api/wall/${testUser.id}`);

            expect(getResponse.status).toBe(200);
            const posts = getResponse.body;

            // Проверяем что посты отсортированы по убыванию даты (новые сверху)
            for (let i = 0; i < posts.length - 1; i++) {
              const currentDate = new Date(posts[i].createdAt);
              const nextDate = new Date(posts[i + 1].createdAt);
              expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
            }

            // Проверяем что все созданные посты присутствуют
            expect(posts.length).toBe(postIds.length);
            
            // Проверяем что порядок обратный (последний созданный - первый в списке)
            for (let i = 0; i < posts.length; i++) {
              const expectedPostId = postIds[postIds.length - 1 - i];
              expect(posts[i].id).toBe(expectedPostId);
            }
          }
        ),
        { numRuns: 10 } // Уменьшил количество итераций из-за больших задержек
      );
    }, 120000); // Увеличенный timeout для теста (2 минуты)
  });

  /**
   * Property 19: Reaction Round-Trip
   * Validates: Requirements 7.1
   * 
   * For any reaction added to a post, it should be retrievable with the post
   */
  describe('Property 19: Reaction Round-Trip', () => {
    it('should add and retrieve reactions correctly', async () => {
      // Этот тест проверяет что один пользователь может добавить только ОДНУ реакцию на пост
      // Если пользователь добавляет несколько реакций, последняя заменяет предыдущую
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 4 }).filter(s => s.trim().length > 0),
          async (postContent, emoji) => {
            // Создаем пост
            const postResponse = await request(app)
              .post('/api/wall')
              .set('Authorization', `Bearer ${testToken}`)
              .send({
                postType: 'text',
                content: postContent
              });

            expect(postResponse.status).toBe(201);
            const postId = postResponse.body.id;

            // Очищаем старые сессии второго пользователя
            await executeQuery('DELETE FROM sessions WHERE user_id = ?', [anotherUser.id]);

            // Создаем сессию для второго пользователя
            const sessionId = uuidv4();
            const anotherToken = `token_${uuidv4()}_${Date.now()}`;
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

            const sessionResult = await executeQuery(
              `INSERT INTO sessions (id, user_id, token, expires_at)
               VALUES (?, ?, ?, ?)`,
              [sessionId, anotherUser.id, anotherToken, expiresAt]
            );

            expect(sessionResult.success).toBe(true);

            // Добавляем реакцию
            const reactionResponse = await request(app)
              .post(`/api/wall/${postId}/reactions`)
              .set('Authorization', `Bearer ${anotherToken}`)
              .send({ emoji });

            expect(reactionResponse.status).toBe(201);
            expect(reactionResponse.body.emoji).toBe(emoji);

            // Получаем пост с реакциями
            const getResponse = await request(app)
              .get(`/api/wall/${testUser.id}`);

            expect(getResponse.status).toBe(200);
            const foundPost = getResponse.body.find(p => p.id === postId);

            expect(foundPost).toBeDefined();
            expect(foundPost.reactions).toBeDefined();
            expect(foundPost.reactions.length).toBe(1); // Один пользователь = одна реакция

            // Проверяем что реакция присутствует
            expect(foundPost.reactions[0].emoji).toBe(emoji);
            expect(foundPost.reactions[0].userId).toBe(anotherUser.id);

            // Очищаем сессию
            await executeQuery('DELETE FROM sessions WHERE user_id = ?', [anotherUser.id]);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000); // Увеличенный timeout

    it('should update existing reaction when user reacts again', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 4 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 4 }).filter(s => s.trim().length > 0),
          async (emoji1, emoji2) => {
            // Создаем пост
            const postResponse = await request(app)
              .post('/api/wall')
              .set('Authorization', `Bearer ${testToken}`)
              .send({
                postType: 'text',
                content: 'Test post'
              });

            const postId = postResponse.body.id;

            // Очищаем старые сессии второго пользователя
            await executeQuery('DELETE FROM sessions WHERE user_id = ?', [anotherUser.id]);

            // Создаем сессию для второго пользователя
            const sessionId = uuidv4();
            const anotherToken = `token_${uuidv4()}_${Date.now()}`;
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

            await executeQuery(
              `INSERT INTO sessions (id, user_id, token, expires_at)
               VALUES (?, ?, ?, ?)`,
              [sessionId, anotherUser.id, anotherToken, expiresAt]
            );

            // Добавляем первую реакцию
            const reaction1Response = await request(app)
              .post(`/api/wall/${postId}/reactions`)
              .set('Authorization', `Bearer ${anotherToken}`)
              .send({ emoji: emoji1 });

            expect(reaction1Response.status).toBe(201);

            // Добавляем вторую реакцию (должна обновить первую)
            const reaction2Response = await request(app)
              .post(`/api/wall/${postId}/reactions`)
              .set('Authorization', `Bearer ${anotherToken}`)
              .send({ emoji: emoji2 });

            expect(reaction2Response.status).toBe(201);

            // Получаем пост
            const getResponse = await request(app)
              .get(`/api/wall/${testUser.id}`);

            const foundPost = getResponse.body.find(p => p.id === postId);

            // Должна быть только одна реакция (обновленная)
            expect(foundPost.reactions.length).toBe(1);
            expect(foundPost.reactions[0].emoji).toBe(emoji2);
            expect(foundPost.reactions[0].userId).toBe(anotherUser.id);

            // Очищаем сессию
            await executeQuery('DELETE FROM sessions WHERE user_id = ?', [anotherUser.id]);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000); // Увеличенный timeout
  });

  /**
   * Property 20: Reaction Creates Notification
   * Validates: Requirements 7.2
   * 
   * For any reaction on another user's post, a notification should be created
   */
  describe('Property 20: Reaction Creates Notification', () => {
    it('should create notification when user reacts to another users post', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 4 }).filter(s => s.trim().length > 0),
          async (emoji) => {
            // Создаем пост от первого пользователя
            const postResponse = await request(app)
              .post('/api/wall')
              .set('Authorization', `Bearer ${testToken}`)
              .send({
                postType: 'text',
                content: 'Test post for notification'
              });

            const postId = postResponse.body.id;

            // Очищаем старые сессии второго пользователя перед созданием новой
            await executeQuery('DELETE FROM sessions WHERE user_id = ?', [anotherUser.id]);

            // Создаем сессию для второго пользователя с уникальным токеном
            const sessionId = uuidv4();
            const anotherToken = `token_${uuidv4()}_${Date.now()}`;
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

            const sessionResult = await executeQuery(
              `INSERT INTO sessions (id, user_id, token, expires_at)
               VALUES (?, ?, ?, ?)`,
              [sessionId, anotherUser.id, anotherToken, expiresAt]
            );

            // Проверяем что сессия создана успешно
            expect(sessionResult.success).toBe(true);

            // Второй пользователь добавляет реакцию
            const reactionResponse = await request(app)
              .post(`/api/wall/${postId}/reactions`)
              .set('Authorization', `Bearer ${anotherToken}`)
              .send({ emoji });

            expect(reactionResponse.status).toBe(201);

            // Проверяем что создано уведомление для владельца поста
            const notificationsResult = await executeQuery(
              `SELECT * FROM notifications 
               WHERE user_id = ? AND type = 'reaction' AND related_post_id = ?`,
              [testUser.id, postId]
            );

            expect(notificationsResult.success).toBe(true);
            expect(notificationsResult.data.length).toBeGreaterThan(0);

            const notification = notificationsResult.data[0];
            expect(notification.related_user_id).toBe(anotherUser.id);
            expect(notification.related_post_id).toBe(postId);
            expect(notification.type).toBe('reaction');
            expect(notification.content).toContain(emoji);

            // Очищаем
            await executeQuery('DELETE FROM sessions WHERE user_id = ?', [anotherUser.id]);
            await executeQuery('DELETE FROM notifications WHERE user_id = ?', [testUser.id]);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000); // Увеличенный timeout

    it('should not create notification when user reacts to their own post', async () => {
      // Создаем пост
      const postResponse = await request(app)
        .post('/api/wall')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          postType: 'text',
          content: 'My own post'
        });

      const postId = postResponse.body.id;

      // Пользователь реагирует на свой собственный пост
      const reactionResponse = await request(app)
        .post(`/api/wall/${postId}/reactions`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({ emoji: '👍' });

      expect(reactionResponse.status).toBe(201);

      // Проверяем что уведомление НЕ создано
      const notificationsResult = await executeQuery(
        `SELECT * FROM notifications 
         WHERE user_id = ? AND type = 'reaction' AND related_post_id = ?`,
        [testUser.id, postId]
      );

      expect(notificationsResult.success).toBe(true);
      expect(notificationsResult.data.length).toBe(0);
    });
  });

  /**
   * Дополнительные property тесты для валидации
   */
  describe('Additional Validation Properties', () => {
    it('should reject invalid post types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string().filter(s => !['text', 'media_added', 'rating', 'review'].includes(s)),
          async (invalidPostType) => {
            const response = await request(app)
              .post('/api/wall')
              .set('Authorization', `Bearer ${testToken}`)
              .send({
                postType: invalidPostType,
                content: 'Test'
              });

            expect(response.status).toBe(400);
            expect(response.body.code).toBe('INVALID_POST_TYPE');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject empty content for text posts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string().filter(s => s.trim() === ''),
          async (emptyContent) => {
            const response = await request(app)
              .post('/api/wall')
              .set('Authorization', `Bearer ${testToken}`)
              .send({
                postType: 'text',
                content: emptyContent
              });

            expect(response.status).toBe(400);
            expect(response.body.code).toBe('MISSING_CONTENT');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid rating values', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer().filter(n => n < 1 || n > 10),
          async (invalidRating) => {
            const response = await request(app)
              .post('/api/wall')
              .set('Authorization', `Bearer ${testToken}`)
              .send({
                postType: 'rating',
                tmdbId: 12345,
                mediaType: 'movie',
                rating: invalidRating
              });

            expect(response.status).toBe(400);
            expect(response.body.code).toBe('INVALID_RATING');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject posts without authentication', async () => {
      const response = await request(app)
        .post('/api/wall')
        .send({
          postType: 'text',
          content: 'Test'
        });

      expect(response.status).toBe(401);
    });

    it('should allow only post owner to delete post', async () => {
      // Создаем пост
      const postResponse = await request(app)
        .post('/api/wall')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          postType: 'text',
          content: 'Test post'
        });

      const postId = postResponse.body.id;

      // Создаем сессию для второго пользователя
      const sessionId = uuidv4();
      const anotherToken = uuidv4();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at)
         VALUES (?, ?, ?, ?)`,
        [sessionId, anotherUser.id, anotherToken, expiresAt]
      );

      // Второй пользователь пытается удалить пост
      const deleteResponse = await request(app)
        .delete(`/api/wall/${postId}`)
        .set('Authorization', `Bearer ${anotherToken}`);

      expect(deleteResponse.status).toBe(403);
      expect(deleteResponse.body.code).toBe('FORBIDDEN');

      // Очищаем
      await executeQuery('DELETE FROM sessions WHERE user_id = ?', [anotherUser.id]);
    });
  });
});
