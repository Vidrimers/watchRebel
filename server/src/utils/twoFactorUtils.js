import crypto from 'crypto';

// Секрет для подписи pre-auth токенов (в production брать из env)
const PRE_AUTH_SECRET = process.env.TWO_FACTOR_PRE_AUTH_SECRET || crypto.randomBytes(32).toString('hex');

/**
 * Генерация pre-auth токена для 2FA
 * Содержит: userId, iat, exp — подписан HMAC
 */
export function generatePreAuthToken(userId) {
  const payload = {
    userId,
    iat: Date.now(),
    exp: Date.now() + 5 * 60 * 1000 // 5 минут
  };
  const data = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', PRE_AUTH_SECRET).update(data).digest('hex');
  return Buffer.from(data).toString('base64') + '.' + signature;
}

/**
 * Верификация pre-auth токена
 * @returns {Object|null} payload или null если невалиден
 */
export function verifyPreAuthToken(token) {
  try {
    const [dataB64, signature] = token.split('.');
    if (!dataB64 || !signature) return null;

    const data = Buffer.from(dataB64, 'base64').toString();
    const expectedSig = crypto.createHmac('sha256', PRE_AUTH_SECRET).update(data).digest('hex');

    if (signature !== expectedSig) return null;

    const payload = JSON.parse(data);
    if (Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Хеширование trusted device токена для хранения в БД
 */
export function hashTrustedDeviceToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export default {
  generatePreAuthToken,
  verifyPreAuthToken,
  hashTrustedDeviceToken
};
