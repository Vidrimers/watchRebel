/**
 * Property-Based Tests для Notifications API
 * Feature: watch-rebel-social-network
 */

import fc from 'fast-check';
import request from 'supertest';
import app from '../../index.js';
import { executeQuery, closeDatabase } from '../../database/db.js';
import { runMigrations } from '../../database/migrations.js';
import { v4 as uuidv4 } from 'uuid';
import { notifyFriendActivity } from '../../services/notificationService.js';

describe('Notifications API - Property-Based Tests', () => {
  let testUser;
  let testToken;
  let friendUser;
  let friendToken;

  beforeAll(async () => {
    // Запускаем миграции перед тестами
    await runMigrations();
    
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

    // Создаем друга
    const friendUserId = uuidv4();
    friendUser = {
      id: friendUserId,
      telegram_username: 'frienduser',
      display_name: 'Friend User',
      avatar_url: 'https://example.com/avatar2.jpg'
    };

    await executeQuery(
      `INSERT INTO users (id, telegram_username, display_name, avatar_url)
       VALUES (?, ?, ?, ?)`,
      [friendUser.id, friendUser.telegram_username, friendUser.display_name, friendUser.avatar_url]
    );

    // Создаем сессию для друга
    const friendSessionId = uuidv4();
    friendToken = uuidv4();

    await executeQuery(
      `INSERT INTO sessions (id, user_id, token, expires_at)
       VALUES (?, ?, ?, ?)`,
      [friendSessionId, friendUser.id, friendToken, expiresAt]
    );

    // Добавляем в друзья (testUser добавляет friendUser)
    const friendshipId = uuidv4();
    await executeQuery(
      `INSERT INTO friends (id, user_id, friend_id)
       VALUES (?, ?, ?)`,
      [friendshipId, testUser.id, friendUser.id]
    );
  });

  afterAll(async () => {
    // Очищаем тестовые данные
    await executeQuery('DELETE FROM friends WHERE user_id IN (?, ?)', [testUser.id, friendUser.id]);
    await executeQuery('DELETE FROM sessions WHERE user_id IN (?, ?)', [testUser.id, friendUser.id]);
    await executeQuery('DELETE FROM users WHERE id IN (?, ?)', [testUser.id, friendUser.id]);
    await closeDatabase();
    
    // Даем время на полное закрытие соединения
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    // Очищаем уведомления после каждого теста
    await executeQuery('DELETE FROM notifications WHERE user_id IN (?, ?)', [testUser.id, friendUser.id]);
    await executeQuery('DELETE FROM list_items');
    await executeQuery('DELETE FROM custom_lists WHERE user_id IN (?, ?)', [testUser.id, friendUser.id]);
  });

  /**
   * Property 30: Friend Activity Creates Notification
   * Validates: Requirements 11.2
   * 
   * For any friend activity (adding media to list), all friends should receive a notification
   */
  describe('Property 30: Friend Activity Creates Notification', () => {
    it('should create notification when friend adds media to list', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tmdbId: fc.integer({ min: 1, max: 999999 }),
            mediaType: fc.constantFrom('movie', 'tv'),
            title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
          }),
          async ({ tmdbId, mediaType, title }) => {
            // Очищаем уведомления перед тестом
            await executeQuery('DELETE FROM notifications WHERE user_id = ?', [testUser.id]);

            // Друг добавляет контент в список (используем сервис напрямую)
            const result = await notifyFriendActivity(friendUser.id, 'added_to_list', {
              tmdbId,
              mediaType,
              title
            });

            // Проверяем что уведомление было создано
            expect(result.success).toBe(true);
            expect(result.notificationsSent).toBeGreaterThan(0);

            // Проверяем что уведомление есть в базе данных с актуальным именем
            const notificationsResult = await executeQuery(
              `SELECT n.*, u.display_name as related_user_name
               FROM notifications n
               LEFT JOIN users u ON n.related_user_id = u.id
               WHERE n.user_id = ? AND n.type = 'friend_activity' AND n.related_user_id = ?`,
              [testUser.id, friendUser.id]
            );

            expect(notificationsResult.success).toBe(true);
            expect(notificationsResult.data.length).toBeGreaterThan(0);

            const notification = notificationsResult.data[0];
            expect(notification.type).toBe('friend_activity');
            expect(notification.related_user_id).toBe(friendUser.id);
            // Проверяем что content содержит шаблон без имени
            expect(notification.content).toContain(title);
            expect(notification.content).toContain('добавил');
            // Проверяем что актуальное имя получено через JOIN
            expect(notification.related_user_name).toBe(friendUser.display_name);
            expect(notification.is_read).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create notification for all friends when user adds media', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tmdbId: fc.integer({ min: 1, max: 999999 }),
            mediaType: fc.constantFrom('movie', 'tv'),
            title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
          }),
          async ({ tmdbId, mediaType, title }) => {
            // Создаем второго друга
            const secondFriendId = uuidv4();
            await executeQuery(
              `INSERT INTO users (id, telegram_username, display_name, avatar_url)
               VALUES (?, ?, ?, ?)`,
              [secondFriendId, 'secondfriend', 'Second Friend', 'https://example.com/avatar3.jpg']
            );

            // Добавляем второго друга в список друзей friendUser
            const friendshipId = uuidv4();
            await executeQuery(
              `INSERT INTO friends (id, user_id, friend_id)
               VALUES (?, ?, ?)`,
              [friendshipId, secondFriendId, friendUser.id]
            );

            // Очищаем уведомления
            await executeQuery('DELETE FROM notifications');

            // Друг добавляет контент
            const result = await notifyFriendActivity(friendUser.id, 'added_to_list', {
              tmdbId,
              mediaType,
              title
            });

            expect(result.success).toBe(true);
            expect(result.notificationsSent).toBe(2); // Два друга должны получить уведомления

            // Проверяем что оба друга получили уведомления
            const testUserNotifications = await executeQuery(
              `SELECT * FROM notifications WHERE user_id = ? AND related_user_id = ?`,
              [testUser.id, friendUser.id]
            );

            const secondFriendNotifications = await executeQuery(
              `SELECT * FROM notifications WHERE user_id = ? AND related_user_id = ?`,
              [secondFriendId, friendUser.id]
            );

            expect(testUserNotifications.data.length).toBe(1);
            expect(secondFriendNotifications.data.length).toBe(1);

            // Очищаем
            await executeQuery('DELETE FROM friends WHERE user_id = ?', [secondFriendId]);
            await executeQuery('DELETE FROM users WHERE id = ?', [secondFriendId]);
          }
        ),
        { numRuns: 50 } // Меньше итераций из-за создания дополнительных пользователей
      );
    }, 60000); // Увеличенный timeout

    it('should create notification with correct action type for ratings', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tmdbId: fc.integer({ min: 1, max: 999999 }),
            mediaType: fc.constantFrom('movie', 'tv'),
            title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            rating: fc.integer({ min: 1, max: 10 })
          }),
          async ({ tmdbId, mediaType, title, rating }) => {
            // Очищаем уведомления
            await executeQuery('DELETE FROM notifications');

            // Друг оценивает контент
            const result = await notifyFriendActivity(friendUser.id, 'rated', {
              tmdbId,
              mediaType,
              title,
              rating
            });

            expect(result.success).toBe(true);

            // Проверяем содержимое уведомления с актуальным именем
            const notificationsResult = await executeQuery(
              `SELECT n.*, u.display_name as related_user_name
               FROM notifications n
               LEFT JOIN users u ON n.related_user_id = u.id
               WHERE n.user_id = ? AND n.related_user_id = ?`,
              [testUser.id, friendUser.id]
            );

            expect(notificationsResult.data.length).toBe(1);
            const notification = notificationsResult.data[0];
            // Проверяем шаблон без имени
            expect(notification.content).toContain('оценил');
            expect(notification.content).toContain(title);
            expect(notification.content).toContain(rating.toString());
            // Проверяем актуальное имя через JOIN
            expect(notification.related_user_name).toBe(friendUser.display_name);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create notification with correct action type for reviews', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tmdbId: fc.integer({ min: 1, max: 999999 }),
            mediaType: fc.constantFrom('movie', 'tv'),
            title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
          }),
          async ({ tmdbId, mediaType, title }) => {
            // Очищаем уведомления
            await executeQuery('DELETE FROM notifications');

            // Друг пишет отзыв
            const result = await notifyFriendActivity(friendUser.id, 'reviewed', {
              tmdbId,
              mediaType,
              title
            });

            expect(result.success).toBe(true);

            // Проверяем содержимое уведомления с актуальным именем
            const notificationsResult = await executeQuery(
              `SELECT n.*, u.display_name as related_user_name
               FROM notifications n
               LEFT JOIN users u ON n.related_user_id = u.id
               WHERE n.user_id = ? AND n.related_user_id = ?`,
              [testUser.id, friendUser.id]
            );

            expect(notificationsResult.data.length).toBe(1);
            const notification = notificationsResult.data[0];
            // Проверяем шаблон без имени
            expect(notification.content).toContain('написал отзыв');
            expect(notification.content).toContain(title);
            // Проверяем актуальное имя через JOIN
            expect(notification.related_user_name).toBe(friendUser.display_name);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Тесты для API endpoints уведомлений
   */
  describe('Notifications API Endpoints', () => {
    it('should retrieve all notifications for authenticated user', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              type: fc.constantFrom('reaction', 'friend_activity'),
              content: fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length >= 10)
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (notificationData) => {
            // Очищаем уведомления
            await executeQuery('DELETE FROM notifications');

            // Создаем несколько уведомлений
            for (const data of notificationData) {
              const notificationId = uuidv4();
              await executeQuery(
                `INSERT INTO notifications (id, user_id, type, content, related_user_id)
                 VALUES (?, ?, ?, ?, ?)`,
                [notificationId, testUser.id, data.type, data.content, friendUser.id]
              );
            }

            // Получаем уведомления через API
            const response = await request(app)
              .get('/api/notifications')
              .set('Authorization', `Bearer ${testToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(notificationData.length);

            // Проверяем что все уведомления присутствуют с правильной структурой
            for (const data of notificationData) {
              const found = response.body.find(n => n.content === data.content);
              expect(found).toBeDefined();
              // Проверяем что есть информация о связанном пользователе
              expect(found.relatedUser).toBeDefined();
              expect(found.relatedUser.displayName).toBe(friendUser.display_name);
              expect(found.type).toBe(data.type);
              expect(found.isRead).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should mark notification as read', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length >= 10),
          async (content) => {
            // Создаем уведомление
            const notificationId = uuidv4();
            await executeQuery(
              `INSERT INTO notifications (id, user_id, type, content, related_user_id)
               VALUES (?, ?, ?, ?, ?)`,
              [notificationId, testUser.id, 'friend_activity', content, friendUser.id]
            );

            // Отмечаем как прочитанное
            const response = await request(app)
              .put(`/api/notifications/${notificationId}/read`)
              .set('Authorization', `Bearer ${testToken}`);

            expect(response.status).toBe(200);
            expect(response.body.isRead).toBe(true);
            expect(response.body.id).toBe(notificationId);

            // Проверяем в базе данных
            const checkResult = await executeQuery(
              'SELECT * FROM notifications WHERE id = ?',
              [notificationId]
            );

            expect(checkResult.data[0].is_read).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should delete notification', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length >= 10),
          async (content) => {
            // Создаем уведомление
            const notificationId = uuidv4();
            await executeQuery(
              `INSERT INTO notifications (id, user_id, type, content, related_user_id)
               VALUES (?, ?, ?, ?, ?)`,
              [notificationId, testUser.id, 'friend_activity', content, friendUser.id]
            );

            // Удаляем уведомление
            const response = await request(app)
              .delete(`/api/notifications/${notificationId}`)
              .set('Authorization', `Bearer ${testToken}`);

            expect(response.status).toBe(200);
            expect(response.body.notificationId).toBe(notificationId);

            // Проверяем что уведомление удалено
            const checkResult = await executeQuery(
              'SELECT * FROM notifications WHERE id = ?',
              [notificationId]
            );

            expect(checkResult.data.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should filter unread notifications', async () => {
      // Создаем несколько уведомлений, некоторые прочитанные
      const unreadId = uuidv4();
      const readId = uuidv4();

      await executeQuery(
        `INSERT INTO notifications (id, user_id, type, content, is_read)
         VALUES (?, ?, ?, ?, ?)`,
        [unreadId, testUser.id, 'friend_activity', 'Unread notification', 0]
      );

      await executeQuery(
        `INSERT INTO notifications (id, user_id, type, content, is_read)
         VALUES (?, ?, ?, ?, ?)`,
        [readId, testUser.id, 'friend_activity', 'Read notification', 1]
      );

      // Получаем только непрочитанные
      const response = await request(app)
        .get('/api/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].id).toBe(unreadId);
      expect(response.body[0].isRead).toBe(false);
    });

    it('should not allow user to access another users notifications', async () => {
      // Создаем уведомление для testUser
      const notificationId = uuidv4();
      await executeQuery(
        `INSERT INTO notifications (id, user_id, type, content)
         VALUES (?, ?, ?, ?)`,
        [notificationId, testUser.id, 'friend_activity', 'Test notification']
      );

      // Пытаемся отметить как прочитанное от имени друга
      const response = await request(app)
        .put(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${friendToken}`);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('should require authentication for all notification endpoints', async () => {
      const getResponse = await request(app)
        .get('/api/notifications');

      expect(getResponse.status).toBe(401);

      const putResponse = await request(app)
        .put('/api/notifications/some-id/read');

      expect(putResponse.status).toBe(401);

      const deleteResponse = await request(app)
        .delete('/api/notifications/some-id');

      expect(deleteResponse.status).toBe(401);
    });
  });
});
