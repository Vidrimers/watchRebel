import { executeQuery } from '../database/db.js';
import logger from '../utils/logger.js';

/**
 * Очистка истекших токенов из базы данных
 * Запускается периодически (каждый час)
 */
export async function cleanupExpiredTokens() {
  try {
    const now = new Date().toISOString();

    // Удаляем истекшие токены подтверждения email
    const emailTokensResult = await executeQuery(
      'DELETE FROM email_verification_tokens WHERE expires_at < ?',
      [now]
    );

    if (emailTokensResult.success) {
      logger.info(`Удалено истекших токенов подтверждения email: ${emailTokensResult.changes || 0}`);
    }

    // Удаляем истекшие токены сброса пароля
    const passwordTokensResult = await executeQuery(
      'DELETE FROM password_reset_tokens WHERE expires_at < ?',
      [now]
    );

    if (passwordTokensResult.success) {
      logger.info(`Удалено истекших токенов сброса пароля: ${passwordTokensResult.changes || 0}`);
    }

    // Удаляем истекшие сессии
    const sessionsResult = await executeQuery(
      'DELETE FROM sessions WHERE expires_at < ?',
      [now]
    );

    if (sessionsResult.success) {
      logger.info(`Удалено истекших сессий: ${sessionsResult.changes || 0}`);
    }

  } catch (error) {
    logger.error('Ошибка очистки истекших токенов:', error);
  }
}

/**
 * Запуск периодической очистки токенов
 * @param {number} intervalHours - Интервал в часах (по умолчанию 1 час)
 */
export function startTokenCleanupScheduler(intervalHours = 1) {
  const intervalMs = intervalHours * 60 * 60 * 1000;

  // Запускаем сразу при старте
  cleanupExpiredTokens();

  // Запускаем периодически
  setInterval(() => {
    cleanupExpiredTokens();
  }, intervalMs);

  logger.info(`Планировщик очистки токенов запущен (интервал: ${intervalHours} час)`);
}
