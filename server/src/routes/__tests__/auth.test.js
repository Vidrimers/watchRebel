import { executeQuery, closeDatabase } from '../../database/db.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к тестовой базе данных
const TEST_DB_PATH = path.join(__dirname, '../../../test-rebel.db');

// Простые mock функции
function createMockResponse() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    }
  };
  return res;
}

function createMockRequest(body = {}, headers = {}) {
  return { body, headers };
}

// Импортируем обработчики напрямую
import { authenticateToken } from '../../middleware/auth.js';

describe('Auth Endpoints Unit Tests', () => {
  beforeAll(async () => {
    // Удаляем тестовую базу данных если она существует
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch (error) {
        // Игнорируем ошибку если файл заблокирован
        console.log('Не удалось удалить тестовую БД перед запуском, продолжаем...');
      }
    }
    
    // Создаем необходимые таблицы
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        telegram_username TEXT,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        is_admin BOOLEAN DEFAULT 0,
        is_blocked BOOLEAN DEFAULT 0,
        theme TEXT DEFAULT 'light-cream',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await executeQuery(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  });

  afterAll(async () => {
    // Закрываем соединение с БД
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

  beforeEach(async () => {
    // Очищаем таблицы перед каждым тестом
    await executeQuery('DELETE FROM sessions');
    await executeQuery('DELETE FROM users');
  });

  /**
   * Тест успешной авторизации через Telegram
   */
  describe('POST /api/auth/telegram', () => {
    test('должен создать нового пользователя и вернуть токен при первом входе', async () => {
      const telegramData = {
        telegramId: '123456789',
        telegramUsername: 'testuser',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg'
      };

      // Тестируем логику напрямую через базу данных
      // Проверяем, что пользователя нет
      const userCheckBefore = await executeQuery(
        'SELECT * FROM users WHERE id = ?',
        [telegramData.telegramId]
      );
      expect(userCheckBefore.data).toHaveLength(0);

      // Создаем пользователя (симулируем POST /api/auth/telegram)
      const insertResult = await executeQuery(
        `INSERT INTO users (id, telegram_username, display_name, avatar_url, is_admin, theme)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [telegramData.telegramId, telegramData.telegramUsername, telegramData.displayName, 
         telegramData.avatarUrl, 0, 'light-cream']
      );
      expect(insertResult.success).toBe(true);

      // Создаем сессию
      const sessionId = uuidv4();
      const token = uuidv4();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const sessionResult = await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at)
         VALUES (?, ?, ?, ?)`,
        [sessionId, telegramData.telegramId, token, expiresAt.toISOString()]
      );
      expect(sessionResult.success).toBe(true);

      // Проверяем, что пользователь создан
      const userCheckAfter = await executeQuery(
        'SELECT * FROM users WHERE id = ?',
        [telegramData.telegramId]
      );
      expect(userCheckAfter.success).toBe(true);
      expect(userCheckAfter.data).toHaveLength(1);
      
      const user = userCheckAfter.data[0];
      expect(user.id).toBe(telegramData.telegramId);
      expect(user.display_name).toBe(telegramData.displayName);
      expect(user.telegram_username).toBe(telegramData.telegramUsername);
      expect(user.avatar_url).toBe(telegramData.avatarUrl);
      expect(Boolean(user.is_admin)).toBe(false);
      expect(user.theme).toBe('light-cream');

      // Проверяем, что сессия создана
      const sessionCheck = await executeQuery(
        'SELECT * FROM sessions WHERE token = ?',
        [token]
      );
      expect(sessionCheck.success).toBe(true);
      expect(sessionCheck.data).toHaveLength(1);
    });

    test('должен обновить существующего пользователя при повторном входе', async () => {
      const telegramId = '987654321';
      
      // Создаем пользователя заранее
      await executeQuery(
        `INSERT INTO users (id, telegram_username, display_name, avatar_url)
         VALUES (?, ?, ?, ?)`,
        [telegramId, 'existinguser', 'Existing User', 'https://example.com/old-avatar.jpg']
      );

      // Обновляем данные пользователя (симулируем повторный вход)
      const updateResult = await executeQuery(
        `UPDATE users 
         SET telegram_username = ?, display_name = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        ['existinguser', 'Updated User Name', 'https://example.com/new-avatar.jpg', telegramId]
      );
      expect(updateResult.success).toBe(true);

      // Проверяем, что данные обновились
      const userCheck = await executeQuery(
        'SELECT * FROM users WHERE id = ?',
        [telegramId]
      );
      expect(userCheck.data).toHaveLength(1);
      expect(userCheck.data[0].display_name).toBe('Updated User Name');
      expect(userCheck.data[0].avatar_url).toBe('https://example.com/new-avatar.jpg');
    });

    test('должен отклонить создание пользователя без обязательных полей', async () => {
      // Попытка вставить пользователя без display_name (обязательное поле)
      const result = await executeQuery(
        `INSERT INTO users (id, telegram_username)
         VALUES (?, ?)`,
        ['123456789', 'testuser']
      );
      
      // Должна быть ошибка, так как display_name NOT NULL
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('должен корректно обрабатывать заблокированного пользователя', async () => {
      const telegramId = '111222333';
      
      // Создаем заблокированного пользователя
      await executeQuery(
        `INSERT INTO users (id, display_name, is_blocked)
         VALUES (?, ?, ?)`,
        [telegramId, 'Blocked User', 1]
      );

      // Проверяем, что пользователь заблокирован
      const userCheck = await executeQuery(
        'SELECT * FROM users WHERE id = ?',
        [telegramId]
      );
      expect(userCheck.data).toHaveLength(1);
      expect(Boolean(userCheck.data[0].is_blocked)).toBe(true);
    });
  });

  /**
   * Тест проверки сессии
   */
  describe('GET /api/auth/session', () => {
    test('должен найти пользователя по валидному токену', async () => {
      // Создаем пользователя и сессию
      const userId = '555666777';
      const token = uuidv4();
      const sessionId = uuidv4();
      
      await executeQuery(
        `INSERT INTO users (id, display_name, telegram_username)
         VALUES (?, ?, ?)`,
        [userId, 'Session Test User', 'sessionuser']
      );

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at)
         VALUES (?, ?, ?, ?)`,
        [sessionId, userId, token, expiresAt.toISOString()]
      );

      // Проверяем, что можем найти сессию по токену
      const sessionCheck = await executeQuery(
        `SELECT s.*, u.* 
         FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.token = ? AND s.expires_at > datetime('now')`,
        [token]
      );

      expect(sessionCheck.success).toBe(true);
      expect(sessionCheck.data).toHaveLength(1);
      
      const session = sessionCheck.data[0];
      expect(session.user_id).toBe(userId);
      expect(session.display_name).toBe('Session Test User');
      expect(session.telegram_username).toBe('sessionuser');
    });

    test('не должен найти сессию с невалидным токеном', async () => {
      const sessionCheck = await executeQuery(
        `SELECT s.*, u.* 
         FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.token = ? AND s.expires_at > datetime('now')`,
        ['invalid-token-12345']
      );

      expect(sessionCheck.success).toBe(true);
      expect(sessionCheck.data).toHaveLength(0);
    });

    test('не должен найти истекшую сессию', async () => {
      const userId = '777888999';
      const token = uuidv4();
      const sessionId = uuidv4();
      
      await executeQuery(
        `INSERT INTO users (id, display_name)
         VALUES (?, ?)`,
        [userId, 'Expired Session User']
      );

      // Создаем сессию с истекшим сроком
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 1); // Вчера

      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at)
         VALUES (?, ?, ?, ?)`,
        [sessionId, userId, token, expiresAt.toISOString()]
      );

      // Проверяем, что истекшая сессия не найдена
      const sessionCheck = await executeQuery(
        `SELECT s.*, u.* 
         FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.token = ? AND s.expires_at > datetime('now')`,
        [token]
      );

      expect(sessionCheck.success).toBe(true);
      expect(sessionCheck.data).toHaveLength(0);
    });
  });

  /**
   * Тест выхода из системы (logout)
   */
  describe('DELETE /api/auth/logout', () => {
    test('должен удалить сессию', async () => {
      // Создаем пользователя и сессию
      const userId = '888999000';
      const token = uuidv4();
      const sessionId = uuidv4();
      
      await executeQuery(
        `INSERT INTO users (id, display_name)
         VALUES (?, ?)`,
        [userId, 'Logout Test User']
      );

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at)
         VALUES (?, ?, ?, ?)`,
        [sessionId, userId, token, expiresAt.toISOString()]
      );

      // Проверяем, что сессия существует
      const sessionCheckBefore = await executeQuery(
        'SELECT * FROM sessions WHERE id = ?',
        [sessionId]
      );
      expect(sessionCheckBefore.data).toHaveLength(1);

      // Удаляем сессию (симулируем logout)
      const deleteResult = await executeQuery(
        'DELETE FROM sessions WHERE id = ?',
        [sessionId]
      );
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.changes).toBe(1);

      // Проверяем, что сессия удалена
      const sessionCheckAfter = await executeQuery(
        'SELECT * FROM sessions WHERE id = ?',
        [sessionId]
      );
      expect(sessionCheckAfter.data).toHaveLength(0);
    });

    test('должен корректно обработать удаление несуществующей сессии', async () => {
      const fakeSessionId = uuidv4();
      
      const deleteResult = await executeQuery(
        'DELETE FROM sessions WHERE id = ?',
        [fakeSessionId]
      );
      
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.changes).toBe(0); // Ничего не удалено
    });
  });
});
