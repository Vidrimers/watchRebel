import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

const serverUrl = `http://${process.env.SERVER_IP || 'localhost'}:${process.env.PORT || 1313}`;

/**
 * Создание сессии для пользователя
 * @param {string} userId - Telegram ID пользователя
 * @param {Object} telegramUser - Данные пользователя из Telegram
 * @returns {Promise<Object>} - Объект с токеном и данными пользователя
 */
export async function createSession(userId, telegramUser) {
  try {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 дней

    // Отправляем запрос на backend для создания сессии
    const response = await axios.post(`${serverUrl}/api/auth/telegram`, {
      userId,
      token,
      expiresAt,
      telegramUser: {
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        photoUrl: telegramUser.photo_url
      }
    });

    return { token, user: response.data.user };
  } catch (error) {
    console.error('Ошибка создания сессии:', error.message);
    // Если backend недоступен, возвращаем временный токен
    return { token: uuidv4(), user: null };
  }
}
