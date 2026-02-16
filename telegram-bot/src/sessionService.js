import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

const serverUrl = `http://${process.env.SERVER_IP || 'localhost'}:${process.env.PORT || 1313}`;

/**
 * Создание сессии для пользователя
 * @param {string} userId - Telegram ID пользователя
 * @param {Object} telegramUser - Данные пользователя из Telegram
 * @param {string} referralCode - Реферальный код (опционально)
 * @returns {Promise<Object>} - Объект с токеном и данными пользователя
 */
export async function createSession(userId, telegramUser, referralCode = null) {
  try {
    // Формируем данные для запроса
    const requestData = {
      telegramId: userId,
      telegramUsername: telegramUser.username,
      displayName: telegramUser.first_name || telegramUser.username || 'Пользователь',
      avatarUrl: telegramUser.photo_url || null
    };

    // Если есть реферальный код, добавляем его
    if (referralCode) {
      requestData.referralCode = referralCode;
    }

    // Выбираем эндпоинт в зависимости от наличия реферального кода
    const endpoint = referralCode 
      ? `${serverUrl}/api/auth/telegram-referral`
      : `${serverUrl}/api/auth/telegram`;

    // Отправляем запрос на backend для создания сессии
    const response = await axios.post(endpoint, requestData);

    return { 
      token: response.data.token, 
      user: response.data.user,
      referralUsed: response.data.referralUsed || false
    };
  } catch (error) {
    console.error('Ошибка создания сессии:', error.message);
    // Если backend недоступен, возвращаем временный токен
    return { token: uuidv4(), user: null, referralUsed: false };
  }
}
