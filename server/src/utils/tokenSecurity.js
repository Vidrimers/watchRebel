import crypto from 'crypto';

/**
 * Хеширование токена для безопасного хранения в БД
 * @param {string} token - Токен для хеширования
 * @returns {string} - Хешированный токен
 */
export function hashToken(token) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

/**
 * Генерация безопасного случайного токена
 * @param {number} bytes - Количество байт (по умолчанию 32)
 * @returns {string} - Случайный токен в hex формате
 */
export function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Проверка, не истек ли токен
 * @param {string} expiresAt - Дата истечения токена (ISO string)
 * @returns {boolean} - true если токен истек
 */
export function isTokenExpired(expiresAt) {
  const now = new Date();
  const tokenExpiresAt = new Date(expiresAt);
  return now > tokenExpiresAt;
}

/**
 * Генерация времени истечения токена
 * @param {number} hours - Количество часов до истечения
 * @returns {string} - Дата истечения в ISO формате
 */
export function generateTokenExpiry(hours = 24) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + hours);
  return expiresAt.toISOString();
}
