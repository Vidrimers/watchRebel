/**
 * Интеграционные тесты для Telegram Bot интеграции
 * 
 * Эти тесты проверяют:
 * 1. Отправку уведомлений о реакциях через API
 * 2. Отправку уведомлений о действиях друзей через API
 */

import { executeQuery } from '../database/db.js';
import { notifyReaction, notifyFriendActivity, sendTelegramNotification } from '../services/notificationService.js';

describe('Telegram Integration Tests', () => {
  const TEST_USER_ID = process.env.TELEGRAM_ADMIN_ID || '137981675';
  const TEST_FRIEND_ID = 'test-friend-123';
  const TEST_POST_ID = 'test-post-123';

  beforeAll(async () => {
    // Создаем тестовых пользователей
    await executeQuery(
      `INSERT OR IGNORE INTO users (id, telegram_username, display_name, avatar_url, is_admin)
       VALUES (?, ?, ?, ?, ?)`,
      [TEST_USER_ID, 'testuser', 'Тестовый Пользователь', null, 0]
    );

    await executeQuery(
      `INSERT OR IGNORE INTO users (id, telegram_username, display_name, avatar_url, is_admin)
       VALUES (?, ?, ?, ?, ?)`,
      [TEST_FRIEND_ID, 'testfriend', 'Тестовый Друг', null, 0]
    );

    // Создаем связь друзей
    await executeQuery(
      `INSERT OR IGNORE INTO friends (id, user_id, friend_id)
       VALUES (?, ?, ?)`,
      ['test-friendship-1', TEST_USER_ID, TEST_FRIEND_ID]
    );
  });

  afterAll(async () => {
    // Очищаем тестовые данные
    await executeQuery(
      `DELETE FROM notifications WHERE user_id IN (?, ?)`,
      [TEST_USER_ID, TEST_FRIEND_ID]
    );

    await executeQuery(
      `DELETE FROM friends WHERE id = ?`,
      ['test-friendship-1']
    );

    await executeQuery(
      `DELETE FROM users WHERE id IN (?, ?)`,
      [TEST_USER_ID, TEST_FRIEND_ID]
    );
  });

  describe('sendTelegramNotification', () => {
    it('должен успешно отправить уведомление в Telegram', async () => {
      const message = '🧪 <b>Тестовое уведомление</b>\n\nЭто автоматический тест интеграции.';
      
      const result = await sendTelegramNotification(TEST_USER_ID, message);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    }, 10000); // Увеличиваем timeout для HTTP запроса

    it('должен вернуть ошибку для несуществующего пользователя', async () => {
      const message = 'Тестовое сообщение';
      const invalidUserId = '999999999';
      
      const result = await sendTelegramNotification(invalidUserId, message);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, 10000);
  });

  describe('notifyReaction', () => {
    it('должен создать уведомление о реакции в БД и отправить в Telegram', async () => {
      const result = await notifyReaction(
        TEST_USER_ID,
        TEST_FRIEND_ID,
        '❤️',
        TEST_POST_ID
      );

      expect(result.success).toBe(true);
      expect(result.notification).toBeDefined();
      expect(result.notification.type).toBe('reaction');
      expect(result.notification.userId).toBe(TEST_USER_ID);
      expect(result.notification.relatedUserId).toBe(TEST_FRIEND_ID);

      // Проверяем, что уведомление сохранено в БД
      const dbCheck = await executeQuery(
        'SELECT * FROM notifications WHERE id = ?',
        [result.notification.id]
      );

      expect(dbCheck.success).toBe(true);
      expect(dbCheck.data.length).toBe(1);
      expect(dbCheck.data[0].type).toBe('reaction');
    }, 10000);

    it('должен включать имя пользователя и эмоджи в содержание уведомления', async () => {
      const result = await notifyReaction(
        TEST_USER_ID,
        TEST_FRIEND_ID,
        '🔥',
        TEST_POST_ID
      );

      expect(result.success).toBe(true);
      expect(result.notification.content).toContain('Тестовый Друг');
      expect(result.notification.content).toContain('🔥');
      expect(result.notification.content).toContain('отреагировал на вашу запись');
    }, 10000);
  });

  describe('notifyFriendActivity', () => {
    it('должен создать уведомления для всех друзей при добавлении в список', async () => {
      const result = await notifyFriendActivity(
        TEST_FRIEND_ID,
        'added_to_list',
        {
          tmdbId: 550,
          mediaType: 'movie',
          title: 'Бойцовский клуб'
        }
      );

      expect(result.success).toBe(true);
      expect(result.notificationsSent).toBeGreaterThan(0);
      expect(result.results).toBeDefined();
      expect(result.results.length).toBeGreaterThan(0);

      // Проверяем, что хотя бы одно уведомление успешно отправлено
      const successfulNotifications = result.results.filter(r => r.success);
      expect(successfulNotifications.length).toBeGreaterThan(0);

      // Проверяем, что уведомление сохранено в БД
      const dbCheck = await executeQuery(
        `SELECT * FROM notifications 
         WHERE user_id = ? AND type = 'friend_activity' 
         ORDER BY created_at DESC LIMIT 1`,
        [TEST_USER_ID]
      );

      expect(dbCheck.success).toBe(true);
      expect(dbCheck.data.length).toBe(1);
      expect(dbCheck.data[0].content).toContain('Тестовый Друг');
      expect(dbCheck.data[0].content).toContain('Бойцовский клуб');
    }, 10000);

    it('должен создать правильное содержание для действия "rated"', async () => {
      const result = await notifyFriendActivity(
        TEST_FRIEND_ID,
        'rated',
        {
          tmdbId: 550,
          mediaType: 'movie',
          title: 'Бойцовский клуб',
          rating: 9
        }
      );

      expect(result.success).toBe(true);

      // Проверяем содержание уведомления в БД
      const dbCheck = await executeQuery(
        `SELECT * FROM notifications 
         WHERE user_id = ? AND type = 'friend_activity' 
         ORDER BY created_at DESC LIMIT 1`,
        [TEST_USER_ID]
      );

      expect(dbCheck.success).toBe(true);
      expect(dbCheck.data[0].content).toContain('оценил');
      expect(dbCheck.data[0].content).toContain('9/10');
    }, 10000);

    it('должен создать правильное содержание для действия "reviewed"', async () => {
      const result = await notifyFriendActivity(
        TEST_FRIEND_ID,
        'reviewed',
        {
          tmdbId: 550,
          mediaType: 'movie',
          title: 'Бойцовский клуб'
        }
      );

      expect(result.success).toBe(true);

      // Проверяем содержание уведомления в БД
      const dbCheck = await executeQuery(
        `SELECT * FROM notifications 
         WHERE user_id = ? AND type = 'friend_activity' 
         ORDER BY created_at DESC LIMIT 1`,
        [TEST_USER_ID]
      );

      expect(dbCheck.success).toBe(true);
      expect(dbCheck.data[0].content).toContain('написал отзыв');
    }, 10000);
  });

  describe('Database Integration', () => {
    it('должен сохранять уведомления с правильной структурой', async () => {
      await notifyReaction(TEST_USER_ID, TEST_FRIEND_ID, '👍', TEST_POST_ID);

      const result = await executeQuery(
        `SELECT * FROM notifications 
         WHERE user_id = ? 
         ORDER BY created_at DESC LIMIT 1`,
        [TEST_USER_ID]
      );

      expect(result.success).toBe(true);
      expect(result.data.length).toBe(1);

      const notification = result.data[0];
      expect(notification.id).toBeDefined();
      expect(notification.user_id).toBe(TEST_USER_ID);
      expect(notification.type).toBe('reaction');
      expect(notification.content).toBeDefined();
      expect(notification.related_user_id).toBe(TEST_FRIEND_ID);
      expect(notification.related_post_id).toBe(TEST_POST_ID);
      expect(notification.is_read).toBe(0);
      expect(notification.created_at).toBeDefined();
    }, 10000);

    it('должен правильно связывать уведомления с пользователями через related_user_id', async () => {
      await notifyReaction(TEST_USER_ID, TEST_FRIEND_ID, '😊', TEST_POST_ID);

      const result = await executeQuery(
        `SELECT n.*, u.display_name 
         FROM notifications n
         LEFT JOIN users u ON n.related_user_id = u.id
         WHERE n.user_id = ? 
         ORDER BY n.created_at DESC LIMIT 1`,
        [TEST_USER_ID]
      );

      expect(result.success).toBe(true);
      expect(result.data[0].display_name).toBe('Тестовый Друг');
    }, 10000);
  });
});
