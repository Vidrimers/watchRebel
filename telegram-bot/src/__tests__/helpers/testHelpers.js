import { executeQuery, getDatabase } from '../../../../server/src/database/db.js';

/**
 * Очистка тестовых данных из базы
 */
export async function cleanupTestData() {
  await executeQuery('DELETE FROM sessions WHERE user_id LIKE "test_%"');
  await executeQuery('DELETE FROM users WHERE id LIKE "test_%"');
}

/**
 * Создание тестового пользователя
 */
export async function createTestUser(userId, userData = {}) {
  const result = await executeQuery(
    `INSERT INTO users (id, telegram_username, display_name, avatar_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      userId,
      userData.username || 'test_user',
      userData.displayName || 'Test User',
      userData.avatarUrl || null
    ]
  );
  return result;
}

/**
 * Получение сессии по токену
 */
export async function getSessionByToken(token) {
  const result = await executeQuery(
    'SELECT * FROM sessions WHERE token = ?',
    [token]
  );
  return result.success && result.data.length > 0 ? result.data[0] : null;
}

/**
 * Получение пользователя по ID
 */
export async function getUserById(userId) {
  const result = await executeQuery(
    'SELECT * FROM users WHERE id = ?',
    [userId]
  );
  return result.success && result.data.length > 0 ? result.data[0] : null;
}

/**
 * Проверка существования сессии
 */
export async function sessionExists(userId) {
  const result = await executeQuery(
    'SELECT COUNT(*) as count FROM sessions WHERE user_id = ?',
    [userId]
  );
  return result.success && result.data[0].count > 0;
}
