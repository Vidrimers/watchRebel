import { executeQuery } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Создание таблицы для отслеживания попыток входа
 */
export async function createLoginAttemptsTable() {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      success BOOLEAN NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_login_attempts_email 
    ON login_attempts(email, created_at DESC)
  `);

  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_login_attempts_ip 
    ON login_attempts(ip_address, created_at DESC)
  `);
}

/**
 * Проверка, не заблокирован ли пользователь из-за множественных неудачных попыток входа
 * @param {string} email - Email пользователя
 * @param {string} ipAddress - IP адрес
 * @returns {Promise<{blocked: boolean, remainingAttempts: number, blockDuration: number}>}
 */
export async function checkLoginAttempts(email, ipAddress) {
  const MAX_ATTEMPTS = 5; // Максимум 5 неудачных попыток
  const BLOCK_DURATION_MINUTES = 30; // Блокировка на 30 минут
  const TIME_WINDOW_MINUTES = 15; // Окно времени для подсчета попыток

  // Получаем время начала окна
  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - TIME_WINDOW_MINUTES);

  // Подсчитываем неудачные попытки за последние 15 минут
  const attemptsResult = await executeQuery(
    `SELECT COUNT(*) as count 
     FROM login_attempts 
     WHERE email = ? 
     AND success = 0 
     AND created_at > ?`,
    [email.toLowerCase(), windowStart.toISOString()]
  );

  if (!attemptsResult.success) {
    console.error('Ошибка проверки попыток входа:', attemptsResult.error);
    return { blocked: false, remainingAttempts: MAX_ATTEMPTS, blockDuration: 0 };
  }

  const failedAttempts = attemptsResult.data[0]?.count || 0;

  // Если превышен лимит попыток
  if (failedAttempts >= MAX_ATTEMPTS) {
    // Проверяем, когда была последняя неудачная попытка
    const lastAttemptResult = await executeQuery(
      `SELECT created_at 
       FROM login_attempts 
       WHERE email = ? 
       AND success = 0 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [email.toLowerCase()]
    );

    if (lastAttemptResult.success && lastAttemptResult.data.length > 0) {
      const lastAttemptTime = new Date(lastAttemptResult.data[0].created_at);
      const now = new Date();
      const minutesSinceLastAttempt = (now - lastAttemptTime) / (1000 * 60);

      // Если прошло меньше времени блокировки
      if (minutesSinceLastAttempt < BLOCK_DURATION_MINUTES) {
        const remainingBlockTime = Math.ceil(BLOCK_DURATION_MINUTES - minutesSinceLastAttempt);
        return {
          blocked: true,
          remainingAttempts: 0,
          blockDuration: remainingBlockTime
        };
      }
    }
  }

  return {
    blocked: false,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - failedAttempts),
    blockDuration: 0
  };
}

/**
 * Записать попытку входа
 * @param {string} email - Email пользователя
 * @param {string} ipAddress - IP адрес
 * @param {boolean} success - Успешна ли попытка
 */
export async function recordLoginAttempt(email, ipAddress, success) {
  const attemptId = uuidv4();

  await executeQuery(
    `INSERT INTO login_attempts (id, email, ip_address, success)
     VALUES (?, ?, ?, ?)`,
    [attemptId, email.toLowerCase(), ipAddress, success ? 1 : 0]
  );

  // Очищаем старые записи (старше 24 часов)
  const cleanupTime = new Date();
  cleanupTime.setHours(cleanupTime.getHours() - 24);

  await executeQuery(
    'DELETE FROM login_attempts WHERE created_at < ?',
    [cleanupTime.toISOString()]
  );
}

/**
 * Сбросить счетчик неудачных попыток для пользователя (после успешного входа)
 * @param {string} email - Email пользователя
 */
export async function resetLoginAttempts(email) {
  await executeQuery(
    'DELETE FROM login_attempts WHERE email = ? AND success = 0',
    [email.toLowerCase()]
  );
}
