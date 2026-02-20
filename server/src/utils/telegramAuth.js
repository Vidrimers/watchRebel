/**
 * Утилита для проверки подлинности данных от Telegram Login Widget
 * Документация: https://core.telegram.org/widgets/login#checking-authorization
 */

import crypto from 'crypto';

/**
 * Проверка подлинности данных от Telegram Login Widget
 * @param {Object} data - Данные от виджета (id, first_name, username, photo_url, auth_date, hash)
 * @param {string} botToken - Токен бота
 * @returns {boolean} - true если данные подлинные, false если нет
 */
export function verifyTelegramAuth(data, botToken) {
  try {
    const { hash, ...userData } = data;

    // Проверяем наличие botToken
    if (!botToken) {
      console.error('❌ Bot token не передан в функцию verifyTelegramAuth');
      return false;
    }

    // Проверяем наличие обязательных полей
    if (!hash || !userData.id || !userData.auth_date) {
      console.error('❌ Отсутствуют обязательные поля');
      return false;
    }

    // Проверяем, что auth_date не старше 24 часов
    const authDate = parseInt(userData.auth_date);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = currentTime - authDate;
    
    if (timeDiff > 86400) { // 24 часа в секундах
      console.error('❌ Данные устарели (старше 24 часов)');
      return false;
    }

    // Создаем data-check-string (только поля с определенными значениями)
    const dataCheckString = Object.keys(userData)
      .filter(key => userData[key] !== undefined && userData[key] !== null)
      .sort()
      .map(key => `${key}=${userData[key]}`)
      .join('\n');

    console.log('🔍 Data-check-string:', dataCheckString);

    // Вычисляем secret_key = SHA256(bot_token)
    const secretKey = crypto
      .createHash('sha256')
      .update(botToken)
      .digest();

    // Вычисляем hash = HMAC-SHA256(data-check-string, secret_key)
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Сравниваем с полученным hash
    const isValid = calculatedHash === hash;

    if (!isValid) {
      console.error('❌ Hash не совпадает');
      console.error('Получен:', hash);
      console.error('Вычислен:', calculatedHash);
    } else {
      console.log('✅ Hash совпадает');
    }

    return isValid;
  } catch (error) {
    console.error('❌ Ошибка проверки Telegram auth:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

/**
 * Извлечение данных пользователя из ответа Telegram Widget
 * @param {Object} widgetData - Данные от виджета
 * @returns {Object} - Объект с telegramId, telegramUsername, displayName, avatarUrl
 */
export function extractUserData(widgetData) {
  return {
    telegramId: widgetData.id?.toString(),
    telegramUsername: widgetData.username || null,
    displayName: widgetData.first_name || widgetData.username || 'Пользователь',
    avatarUrl: widgetData.photo_url || null
  };
}
