import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { verifyTelegramAuth, extractUserData } from '../utils/telegramAuth.js';
import { sendVerificationEmail } from '../services/emailService.js';
import passport from '../config/passport.js';
import { 
  loginRateLimiter, 
  registerRateLimiter, 
  passwordResetRateLimiter 
} from '../middleware/rateLimiter.js';
import { 
  checkLoginAttempts, 
  recordLoginAttempt, 
  resetLoginAttempts 
} from '../middleware/loginAttempts.js';
import {
  validateEmail,
  validateEmailDomain,
  validatePassword,
  validateDisplayName,
  sanitizeString
} from '../utils/validation.js';

const router = express.Router();

/**
 * Генерация уникального реферального кода
 */
function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * POST /api/auth/telegram
 * Авторизация пользователя через Telegram
 * 
 * Body:
 * - telegramId: string (обязательно)
 * - telegramUsername: string (опционально)
 * - displayName: string (обязательно)
 * - avatarUrl: string (опционально)
 */
router.post('/telegram', async (req, res) => {
  try {
    const { telegramId, telegramUsername, displayName, avatarUrl } = req.body;

    // Валидация входных данных
    if (!telegramId || !displayName) {
      return res.status(400).json({ 
        error: 'telegramId и displayName обязательны',
        code: 'MISSING_FIELDS' 
      });
    }

    // Проверяем, существует ли пользователь
    const userCheck = await executeQuery(
      'SELECT * FROM users WHERE id = ?',
      [telegramId]
    );

    if (!userCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки пользователя',
        code: 'DATABASE_ERROR' 
      });
    }

    let user;

    if (userCheck.data.length === 0) {
      // Создаем нового пользователя (первый вход)
      const isAdmin = telegramId === process.env.TELEGRAM_ADMIN_ID;
      
      // Генерируем уникальный реферальный код
      let referralCode;
      let isUnique = false;
      
      while (!isUnique) {
        referralCode = generateReferralCode();
        const codeCheck = await executeQuery(
          'SELECT id FROM users WHERE referral_code = ?',
          [referralCode]
        );
        if (codeCheck.success && codeCheck.data.length === 0) {
          isUnique = true;
        }
      }
      
      const insertResult = await executeQuery(
        `INSERT INTO users (id, telegram_username, display_name, avatar_url, is_admin, theme, referral_code)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [telegramId, telegramUsername || null, displayName, avatarUrl || null, isAdmin ? 1 : 0, 'light-cream', referralCode]
      );

      if (!insertResult.success) {
        return res.status(500).json({ 
          error: 'Ошибка создания пользователя',
          code: 'DATABASE_ERROR' 
        });
      }

      // Получаем созданного пользователя
      const newUserResult = await executeQuery(
        'SELECT * FROM users WHERE id = ?',
        [telegramId]
      );

      user = newUserResult.data[0];
    } else {
      user = userCheck.data[0];

      // Проверяем, не заблокирован ли пользователь
      if (user.is_blocked) {
        return res.status(403).json({ 
          error: 'Пользователь заблокирован',
          code: 'USER_BLOCKED' 
        });
      }

      // Обновляем информацию пользователя (на случай изменений в Telegram)
      // НЕ обновляем display_name, чтобы сохранить изменения пользователя на сайте
      // НЕ обновляем avatar_url, если пользователь загрузил кастомную аватарку через сайт
      const shouldUpdateAvatar = !user.avatar_url || !user.avatar_url.startsWith('/uploads/');
      const newAvatarUrl = shouldUpdateAvatar ? (avatarUrl || user.avatar_url) : user.avatar_url;
      
      await executeQuery(
        `UPDATE users 
         SET telegram_username = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [telegramUsername || user.telegram_username, newAvatarUrl, telegramId]
      );
    }

    // Создаем новую сессию
    const sessionId = uuidv4();
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Сессия на 30 дней

    const sessionResult = await executeQuery(
      `INSERT INTO sessions (id, user_id, token, expires_at)
       VALUES (?, ?, ?, ?)`,
      [sessionId, telegramId, token, expiresAt.toISOString()]
    );

    if (!sessionResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка создания сессии',
        code: 'DATABASE_ERROR' 
      });
    }

    // Возвращаем токен и информацию о пользователе
    res.json({
      token,
      user: {
        id: user.id,
        telegramUsername: user.telegram_username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        isAdmin: Boolean(user.is_admin),
        theme: user.theme,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    console.error('Ошибка авторизации через Telegram:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/auth/session
 * Проверка текущей сессии пользователя
 * Требует токен в заголовке Authorization
 */
router.get('/session', authenticateToken, async (req, res) => {
  try {
    // Информация о пользователе уже добавлена в req.user middleware'ом
    res.json({
      user: req.user
    });
  } catch (error) {
    console.error('Ошибка проверки сессии:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * DELETE /api/auth/logout
 * Выход из системы (удаление сессии)
 * Требует токен в заголовке Authorization
 */
router.delete('/logout', authenticateToken, async (req, res) => {
  try {
    // Удаляем сессию из базы данных
    const result = await executeQuery(
      'DELETE FROM sessions WHERE id = ?',
      [req.sessionId]
    );

    if (!result.success) {
      return res.status(500).json({ 
        error: 'Ошибка удаления сессии',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json({ 
      message: 'Выход выполнен успешно' 
    });

  } catch (error) {
    console.error('Ошибка выхода:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/auth/telegram-referral
 * Авторизация пользователя через Telegram с реферальным кодом
 * 
 * Body:
 * - telegramId: string (обязательно)
 * - telegramUsername: string (опционально)
 * - displayName: string (обязательно)
 * - avatarUrl: string (опционально)
 * - referralCode: string (опционально) - код пригласившего пользователя
 */
router.post('/telegram-referral', async (req, res) => {
  try {
    const { telegramId, telegramUsername, displayName, avatarUrl, referralCode } = req.body;

    // Валидация входных данных
    if (!telegramId || !displayName) {
      return res.status(400).json({ 
        error: 'telegramId и displayName обязательны',
        code: 'MISSING_FIELDS' 
      });
    }

    // Проверяем, существует ли пользователь
    const userCheck = await executeQuery(
      'SELECT * FROM users WHERE id = ?',
      [telegramId]
    );

    if (!userCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки пользователя',
        code: 'DATABASE_ERROR' 
      });
    }

    let user;
    let referrerId = null;

    // Если указан реферальный код, проверяем его
    if (referralCode) {
      const referrerCheck = await executeQuery(
        'SELECT id FROM users WHERE referral_code = ?',
        [referralCode]
      );

      if (referrerCheck.success && referrerCheck.data.length > 0) {
        referrerId = referrerCheck.data[0].id;
      }
    }

    if (userCheck.data.length === 0) {
      // Создаем нового пользователя (первый вход)
      const isAdmin = telegramId === process.env.TELEGRAM_ADMIN_ID;
      
      // Генерируем уникальный реферальный код
      let newReferralCode;
      let isUnique = false;
      
      while (!isUnique) {
        newReferralCode = generateReferralCode();
        const codeCheck = await executeQuery(
          'SELECT id FROM users WHERE referral_code = ?',
          [newReferralCode]
        );
        if (codeCheck.success && codeCheck.data.length === 0) {
          isUnique = true;
        }
      }
      
      const insertResult = await executeQuery(
        `INSERT INTO users (id, telegram_username, display_name, avatar_url, is_admin, theme, referral_code, referred_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [telegramId, telegramUsername || null, displayName, avatarUrl || null, isAdmin ? 1 : 0, 'light-cream', newReferralCode, referrerId]
      );

      if (!insertResult.success) {
        return res.status(500).json({ 
          error: 'Ошибка создания пользователя',
          code: 'DATABASE_ERROR' 
        });
      }

      // Если есть реферер, создаем запись в таблице referrals и добавляем в друзья
      if (referrerId) {
        const referralId = uuidv4();
        await executeQuery(
          'INSERT INTO referrals (id, referrer_id, referred_id, referral_code) VALUES (?, ?, ?, ?)',
          [referralId, referrerId, telegramId, referralCode]
        );

        // Увеличиваем счетчик рефералов у пригласившего
        await executeQuery(
          'UPDATE users SET referrals_count = referrals_count + 1 WHERE id = ?',
          [referrerId]
        );

        // Добавляем в друзья (двусторонняя дружба)
        const friendshipId1 = uuidv4();
        const friendshipId2 = uuidv4();
        
        await executeQuery(
          'INSERT INTO friends (id, user_id, friend_id) VALUES (?, ?, ?)',
          [friendshipId1, telegramId, referrerId]
        );
        
        await executeQuery(
          'INSERT INTO friends (id, user_id, friend_id) VALUES (?, ?, ?)',
          [friendshipId2, referrerId, telegramId]
        );

        // Создаем уведомления для обоих пользователей
        const notificationId1 = uuidv4();
        const notificationId2 = uuidv4();

        // Уведомление для реферера - сохраняем шаблон без имени
        await executeQuery(
          `INSERT INTO notifications (id, user_id, type, content, related_user_id)
           VALUES (?, ?, ?, ?, ?)`,
          [notificationId1, referrerId, 'friend_activity', 'зарегистрировался по вашей реферальной ссылке!', telegramId]
        );

        // Уведомление для нового пользователя - здесь имя не нужно
        await executeQuery(
          `INSERT INTO notifications (id, user_id, type, content, related_user_id)
           VALUES (?, ?, ?, ?, ?)`,
          [notificationId2, telegramId, 'friend_activity', 'Вы автоматически добавлены в друзья с пригласившим вас пользователем!', referrerId]
        );
      }

      // Получаем созданного пользователя
      const newUserResult = await executeQuery(
        'SELECT * FROM users WHERE id = ?',
        [telegramId]
      );

      user = newUserResult.data[0];
    } else {
      user = userCheck.data[0];

      // Проверяем, не заблокирован ли пользователь
      if (user.is_blocked) {
        return res.status(403).json({ 
          error: 'Пользователь заблокирован',
          code: 'USER_BLOCKED' 
        });
      }

      // Обновляем информацию пользователя (на случай изменений в Telegram)
      // НЕ обновляем display_name, чтобы сохранить изменения пользователя на сайте
      // НЕ обновляем avatar_url, если пользователь загрузил кастомную аватарку через сайт
      const shouldUpdateAvatar = !user.avatar_url || !user.avatar_url.startsWith('/uploads/');
      const newAvatarUrl = shouldUpdateAvatar ? (avatarUrl || user.avatar_url) : user.avatar_url;
      
      await executeQuery(
        `UPDATE users 
         SET telegram_username = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [telegramUsername || user.telegram_username, newAvatarUrl, telegramId]
      );
    }

    // Создаем новую сессию
    const sessionId = uuidv4();
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Сессия на 30 дней

    const sessionResult = await executeQuery(
      `INSERT INTO sessions (id, user_id, token, expires_at)
       VALUES (?, ?, ?, ?)`,
      [sessionId, telegramId, token, expiresAt.toISOString()]
    );

    if (!sessionResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка создания сессии',
        code: 'DATABASE_ERROR' 
      });
    }

    // Возвращаем токен и информацию о пользователе
    res.json({
      token,
      user: {
        id: user.id,
        telegramUsername: user.telegram_username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        isAdmin: Boolean(user.is_admin),
        theme: user.theme,
        createdAt: user.created_at
      },
      referralUsed: !!referrerId
    });

  } catch (error) {
    console.error('Ошибка авторизации через Telegram с реферальным кодом:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/auth/telegram-widget
 * Авторизация пользователя через Telegram Login Widget
 * 
 * Body:
 * - id: number (обязательно) - Telegram user ID
 * - first_name: string (обязательно)
 * - username: string (опционально)
 * - photo_url: string (опционально)
 * - auth_date: number (обязательно) - Unix timestamp
 * - hash: string (обязательно) - Подпись данных
 */
router.post('/telegram-widget', async (req, res) => {
  try {
    const widgetData = req.body;

    console.log('📥 Получены данные от Telegram Login Widget:', widgetData);

    // Проверяем наличие hash
    if (!widgetData.hash) {
      console.error('❌ Отсутствует hash в данных от Telegram');
      return res.status(400).json({ 
        error: 'Отсутствует hash в данных авторизации',
        code: 'MISSING_HASH' 
      });
    }

    // Проверяем подлинность данных от Telegram
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    console.log('🔑 Bot token:', botToken ? 'Есть' : 'Отсутствует');
    
    if (!botToken) {
      console.error('❌ TELEGRAM_BOT_TOKEN не найден в переменных окружения');
      return res.status(500).json({ 
        error: 'Ошибка конфигурации сервера',
        code: 'MISSING_BOT_TOKEN' 
      });
    }
    
    if (!verifyTelegramAuth(widgetData, botToken)) {
      console.error('❌ Проверка подлинности данных Telegram не прошла');
      return res.status(401).json({ 
        error: 'Неверные данные авторизации',
        code: 'INVALID_AUTH_DATA' 
      });
    }

    console.log('✅ Данные от Telegram подлинные');

    // Извлекаем данные пользователя
    const { telegramId, telegramUsername, displayName, avatarUrl } = extractUserData(widgetData);

    // Валидация
    if (!telegramId || !displayName) {
      return res.status(400).json({ 
        error: 'telegramId и displayName обязательны',
        code: 'MISSING_FIELDS' 
      });
    }

    // Проверяем, существует ли пользователь
    const userCheck = await executeQuery(
      'SELECT * FROM users WHERE id = ?',
      [telegramId]
    );

    if (!userCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки пользователя',
        code: 'DATABASE_ERROR' 
      });
    }

    let user;

    if (userCheck.data.length === 0) {
      // Создаем нового пользователя (первый вход)
      console.log(`📝 Создаем нового пользователя: ${displayName} (ID: ${telegramId})`);
      
      const isAdmin = telegramId === process.env.TELEGRAM_ADMIN_ID;
      
      // Генерируем уникальный реферальный код
      let referralCode;
      let isUnique = false;
      
      while (!isUnique) {
        referralCode = generateReferralCode();
        const codeCheck = await executeQuery(
          'SELECT id FROM users WHERE referral_code = ?',
          [referralCode]
        );
        if (codeCheck.success && codeCheck.data.length === 0) {
          isUnique = true;
        }
      }
      
      const insertResult = await executeQuery(
        `INSERT INTO users (id, telegram_username, display_name, avatar_url, is_admin, theme, referral_code)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [telegramId, telegramUsername || null, displayName, avatarUrl || null, isAdmin ? 1 : 0, 'light-cream', referralCode]
      );

      if (!insertResult.success) {
        return res.status(500).json({ 
          error: 'Ошибка создания пользователя',
          code: 'DATABASE_ERROR' 
        });
      }

      // Получаем созданного пользователя
      const newUserResult = await executeQuery(
        'SELECT * FROM users WHERE id = ?',
        [telegramId]
      );

      user = newUserResult.data[0];
      console.log(`✅ Пользователь создан: ${displayName}`);
    } else {
      user = userCheck.data[0];
      console.log(`✅ Пользователь найден: ${user.display_name} (ID: ${telegramId})`);

      // Проверяем, не заблокирован ли пользователь
      if (user.is_blocked) {
        return res.status(403).json({ 
          error: 'Пользователь заблокирован',
          code: 'USER_BLOCKED' 
        });
      }

      // Обновляем информацию пользователя (на случай изменений в Telegram)
      // НЕ обновляем display_name, чтобы сохранить изменения пользователя на сайте
      // НЕ обновляем avatar_url, если пользователь загрузил кастомную аватарку через сайт
      const shouldUpdateAvatar = !user.avatar_url || !user.avatar_url.startsWith('/uploads/');
      const newAvatarUrl = shouldUpdateAvatar ? (avatarUrl || user.avatar_url) : user.avatar_url;
      
      await executeQuery(
        `UPDATE users 
         SET telegram_username = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [telegramUsername || user.telegram_username, newAvatarUrl, telegramId]
      );
    }

    // Создаем новую сессию
    const sessionId = uuidv4();
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Сессия на 30 дней

    const sessionResult = await executeQuery(
      `INSERT INTO sessions (id, user_id, token, expires_at)
       VALUES (?, ?, ?, ?)`,
      [sessionId, telegramId, token, expiresAt.toISOString()]
    );

    if (!sessionResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка создания сессии',
        code: 'DATABASE_ERROR' 
      });
    }

    console.log(`✅ Сессия создана для пользователя ${user.display_name}`);

    // Возвращаем токен и информацию о пользователе
    res.json({
      token,
      user: {
        id: user.id,
        telegramUsername: user.telegram_username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        isAdmin: Boolean(user.is_admin),
        theme: user.theme,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    console.error('❌ Ошибка авторизации через Telegram Widget:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/auth/link-telegram
 * Привязать Telegram аккаунт к существующему пользователю
 * Требует аутентификации
 * 
 * Body:
 * - telegramId: string (обязательно)
 * - telegramUsername: string (опционально)
 */
router.post('/link-telegram', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { telegramId, telegramUsername } = req.body;

    if (!telegramId) {
      return res.status(400).json({ 
        error: 'telegramId обязателен',
        code: 'MISSING_FIELDS' 
      });
    }

    // Проверяем, не привязан ли этот Telegram к другому пользователю
    const telegramCheck = await executeQuery(
      'SELECT id FROM users WHERE id = ? AND id != ?',
      [telegramId, userId]
    );

    if (!telegramCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки Telegram аккаунта',
        code: 'DATABASE_ERROR' 
      });
    }

    if (telegramCheck.data.length > 0) {
      return res.status(400).json({ 
        error: 'Этот Telegram аккаунт уже привязан к другому пользователю',
        code: 'TELEGRAM_ALREADY_LINKED' 
      });
    }

    // Обновляем пользователя
    const updateResult = await executeQuery(
      `UPDATE users 
       SET telegram_username = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [telegramUsername || null, userId]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка привязки Telegram',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json({
      message: 'Telegram успешно привязан',
      telegramUsername
    });

  } catch (error) {
    console.error('Ошибка привязки Telegram:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * DELETE /api/auth/unlink-telegram
 * Отвязать Telegram аккаунт от пользователя
 * Требует аутентификации
 * Нельзя отвязать, если это единственный способ входа
 */
router.delete('/unlink-telegram', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Получаем информацию о пользователе
    const userResult = await executeQuery(
      'SELECT auth_method, email, google_id, discord_id FROM users WHERE id = ?',
      [userId]
    );

    if (!userResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения данных пользователя',
        code: 'DATABASE_ERROR' 
      });
    }

    if (userResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND' 
      });
    }

    const user = userResult.data[0];

    // Проверяем, есть ли другие способы входа
    const hasOtherMethods = user.email || user.google_id || user.discord_id;

    if (!hasOtherMethods) {
      return res.status(400).json({ 
        error: 'Нельзя отвязать Telegram, так как это единственный способ входа. Сначала привяжите другой способ входа.',
        code: 'LAST_AUTH_METHOD' 
      });
    }

    // Отвязываем Telegram
    const updateResult = await executeQuery(
      `UPDATE users 
       SET telegram_username = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [userId]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка отвязки Telegram',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json({
      message: 'Telegram успешно отвязан'
    });

  } catch (error) {
    console.error('Ошибка отвязки Telegram:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/auth/verify-email/:token
 * Подтверждение email адреса пользователя
 * 
 * Params:
 * - token: string (обязательно) - токен подтверждения
 */
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ 
        error: 'Токен подтверждения обязателен',
        code: 'MISSING_TOKEN' 
      });
    }

    // Ищем токен в базе данных
    const tokenResult = await executeQuery(
      'SELECT * FROM email_verification_tokens WHERE token = ?',
      [token]
    );

    if (!tokenResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки токена',
        code: 'DATABASE_ERROR' 
      });
    }

    if (tokenResult.data.length === 0) {
      return res.status(400).json({ 
        error: 'Неверный или недействительный токен подтверждения',
        code: 'INVALID_TOKEN' 
      });
    }

    const verificationToken = tokenResult.data[0];

    // Проверяем, не истек ли токен
    const now = new Date();
    const tokenExpiresAt = new Date(verificationToken.expires_at);

    if (now > tokenExpiresAt) {
      // Удаляем истекший токен
      await executeQuery(
        'DELETE FROM email_verification_tokens WHERE id = ?',
        [verificationToken.id]
      );

      return res.status(400).json({ 
        error: 'Токен подтверждения истек. Пожалуйста, запросите новое письмо.',
        code: 'TOKEN_EXPIRED' 
      });
    }

    // Получаем пользователя
    const userResult = await executeQuery(
      'SELECT * FROM users WHERE id = ?',
      [verificationToken.user_id]
    );

    if (!userResult.success || userResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND' 
      });
    }

    const user = userResult.data[0];

    // Проверяем, не подтвержден ли уже email
    if (user.email_verified) {
      // Удаляем токен
      await executeQuery(
        'DELETE FROM email_verification_tokens WHERE id = ?',
        [verificationToken.id]
      );

      return res.status(400).json({ 
        error: 'Email уже подтвержден',
        code: 'EMAIL_ALREADY_VERIFIED' 
      });
    }

    // Устанавливаем email_verified = true
    const updateResult = await executeQuery(
      'UPDATE users SET email_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка подтверждения email',
        code: 'DATABASE_ERROR' 
      });
    }

    // Удаляем использованный токен
    await executeQuery(
      'DELETE FROM email_verification_tokens WHERE id = ?',
      [verificationToken.id]
    );

    console.log(`✅ Email подтвержден для пользователя: ${user.display_name} (${user.email})`);

    // Создаем новую сессию для автоматического входа
    const sessionId = uuidv4();
    const sessionToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Сессия на 30 дней

    const sessionResult = await executeQuery(
      `INSERT INTO sessions (id, user_id, token, expires_at)
       VALUES (?, ?, ?, ?)`,
      [sessionId, user.id, sessionToken, expiresAt.toISOString()]
    );

    if (!sessionResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка создания сессии',
        code: 'DATABASE_ERROR' 
      });
    }

    // Возвращаем токен и информацию о пользователе для автоматического входа
    res.json({
      message: 'Email успешно подтвержден!',
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        isAdmin: Boolean(user.is_admin),
        theme: user.theme,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    console.error('Ошибка подтверждения email:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/auth/register-email
 * Регистрация пользователя через Email и пароль
 * 
 * Body:
 * - email: string (обязательно)
 * - password: string (обязательно)
 * - displayName: string (обязательно)
 */
router.post('/register-email', registerRateLimiter, async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    // Валидация входных данных
    if (!email || !password || !displayName) {
      return res.status(400).json({ 
        error: 'Email, пароль и имя обязательны',
        code: 'MISSING_FIELDS' 
      });
    }

    // Валидация email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ 
        error: emailValidation.error,
        code: 'INVALID_EMAIL' 
      });
    }

    const normalizedEmail = emailValidation.normalizedEmail || email.toLowerCase();

    // Проверка существования домена email (DNS lookup)
    const domainValidation = await validateEmailDomain(normalizedEmail);
    if (!domainValidation.valid) {
      return res.status(400).json({ 
        error: domainValidation.error,
        code: 'INVALID_EMAIL_DOMAIN' 
      });
    }

    // Валидация имени
    const nameValidation = validateDisplayName(displayName);
    if (!nameValidation.valid) {
      return res.status(400).json({ 
        error: nameValidation.error,
        code: 'INVALID_DISPLAY_NAME' 
      });
    }

    const sanitizedName = nameValidation.sanitizedName;

    // Валидация пароля с проверкой сложности
    const passwordValidation = validatePassword(password, [normalizedEmail, sanitizedName]);
    if (!passwordValidation.valid) {
      return res.status(400).json({ 
        error: passwordValidation.error,
        code: 'WEAK_PASSWORD',
        score: passwordValidation.score,
        feedback: passwordValidation.feedback
      });
    }

    // Проверяем, не занят ли email
    const emailCheck = await executeQuery(
      'SELECT id FROM users WHERE email = ?',
      [normalizedEmail]
    );

    if (!emailCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки email',
        code: 'DATABASE_ERROR' 
      });
    }

    if (emailCheck.data.length > 0) {
      return res.status(400).json({ 
        error: 'Этот email уже зарегистрирован',
        code: 'EMAIL_ALREADY_EXISTS' 
      });
    }

    // Хешируем пароль
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Генерируем уникальный ID для пользователя
    const userId = uuidv4();

    // Генерируем уникальный реферальный код
    let referralCode;
    let isUnique = false;
    
    while (!isUnique) {
      referralCode = generateReferralCode();
      const codeCheck = await executeQuery(
        'SELECT id FROM users WHERE referral_code = ?',
        [referralCode]
      );
      if (codeCheck.success && codeCheck.data.length === 0) {
        isUnique = true;
      }
    }

    // Создаем пользователя со статусом email_verified = false
    const insertResult = await executeQuery(
      `INSERT INTO users (
        id, 
        email, 
        password_hash, 
        display_name, 
        auth_method, 
        email_verified, 
        theme, 
        referral_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, 
        normalizedEmail, 
        passwordHash, 
        sanitizedName, 
        'email', 
        0, 
        'light-cream', 
        referralCode
      ]
    );

    if (!insertResult.success) {
      console.error('Ошибка создания пользователя:', insertResult.error);
      return res.status(500).json({ 
        error: 'Ошибка создания пользователя',
        code: 'DATABASE_ERROR' 
      });
    }

    // Генерируем токен подтверждения email
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Токен действителен 24 часа

    const tokenResult = await executeQuery(
      `INSERT INTO email_verification_tokens (id, user_id, token, expires_at)
       VALUES (?, ?, ?, ?)`,
      [tokenId, userId, verificationToken, expiresAt.toISOString()]
    );

    if (!tokenResult.success) {
      console.error('Ошибка создания токена подтверждения:', tokenResult.error);
      // Удаляем созданного пользователя
      await executeQuery('DELETE FROM users WHERE id = ?', [userId]);
      return res.status(500).json({ 
        error: 'Ошибка создания токена подтверждения',
        code: 'DATABASE_ERROR' 
      });
    }

    // Отправляем письмо с подтверждением
    const emailResult = await sendVerificationEmail(email, displayName, verificationToken);

    if (!emailResult.success) {
      console.error('Ошибка отправки письма:', emailResult.error);
      // Не удаляем пользователя, просто логируем ошибку
      // Пользователь сможет запросить повторную отправку письма
    }

    console.log(`✅ Пользователь зарегистрирован: ${displayName} (${email})`);

    res.status(201).json({
      message: 'Регистрация успешна! Проверьте свой email для подтверждения.',
      userId,
      email: email.toLowerCase(),
      emailSent: emailResult.success
    });

  } catch (error) {
    console.error('Ошибка регистрации через email:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/auth/login-email
 * Вход пользователя через Email и пароль
 * 
 * Body:
 * - email: string (обязательно)
 * - password: string (обязательно)
 */
router.post('/login-email', loginRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    // Валидация входных данных
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email и пароль обязательны',
        code: 'MISSING_FIELDS' 
      });
    }

    // Проверяем, не заблокирован ли пользователь из-за множественных неудачных попыток
    const attemptCheck = await checkLoginAttempts(email, ipAddress);

    if (attemptCheck.blocked) {
      console.warn(`⚠️ Попытка входа заблокирована для email: ${email}, IP: ${ipAddress}`);
      return res.status(429).json({
        error: `Слишком много неудачных попыток входа. Попробуйте снова через ${attemptCheck.blockDuration} минут.`,
        code: 'ACCOUNT_TEMPORARILY_LOCKED',
        blockDuration: attemptCheck.blockDuration
      });
    }

    // Ищем пользователя по email
    const userResult = await executeQuery(
      'SELECT * FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (!userResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки пользователя',
        code: 'DATABASE_ERROR' 
      });
    }

    if (userResult.data.length === 0) {
      // Записываем неудачную попытку
      await recordLoginAttempt(email, ipAddress, false);
      
      return res.status(401).json({ 
        error: 'Неверный email или пароль',
        code: 'INVALID_CREDENTIALS',
        remainingAttempts: attemptCheck.remainingAttempts - 1
      });
    }

    const user = userResult.data[0];

    // Проверяем, не заблокирован ли пользователь
    if (user.is_blocked) {
      // Записываем неудачную попытку
      await recordLoginAttempt(email, ipAddress, false);
      
      return res.status(403).json({ 
        error: 'Пользователь заблокирован',
        code: 'USER_BLOCKED' 
      });
    }

    // Проверяем, подтвержден ли email
    if (!user.email_verified) {
      // Записываем неудачную попытку
      await recordLoginAttempt(email, ipAddress, false);
      
      return res.status(403).json({ 
        error: 'Email не подтвержден. Пожалуйста, проверьте свою почту и перейдите по ссылке подтверждения.',
        code: 'EMAIL_NOT_VERIFIED' 
      });
    }

    // Проверяем пароль
    if (!user.password_hash) {
      // Записываем неудачную попытку
      await recordLoginAttempt(email, ipAddress, false);
      
      return res.status(401).json({ 
        error: 'Неверный email или пароль',
        code: 'INVALID_CREDENTIALS',
        remainingAttempts: attemptCheck.remainingAttempts - 1
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      // Записываем неудачную попытку
      await recordLoginAttempt(email, ipAddress, false);
      
      return res.status(401).json({ 
        error: 'Неверный email или пароль',
        code: 'INVALID_CREDENTIALS',
        remainingAttempts: attemptCheck.remainingAttempts - 1
      });
    }

    // Успешный вход - сбрасываем счетчик неудачных попыток
    await resetLoginAttempts(email);
    
    // Записываем успешную попытку
    await recordLoginAttempt(email, ipAddress, true);

    // Создаем новую сессию
    const sessionId = uuidv4();
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Сессия на 30 дней

    const sessionResult = await executeQuery(
      `INSERT INTO sessions (id, user_id, token, expires_at)
       VALUES (?, ?, ?, ?)`,
      [sessionId, user.id, token, expiresAt.toISOString()]
    );

    if (!sessionResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка создания сессии',
        code: 'DATABASE_ERROR' 
      });
    }

    console.log(`✅ Вход через email: ${user.display_name} (${user.email})`);

    // Возвращаем токен и информацию о пользователе
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        isAdmin: Boolean(user.is_admin),
        theme: user.theme,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    console.error('Ошибка входа через email:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Запрос на сброс пароля
 * 
 * Body:
 * - email: string (обязательно)
 */
router.post('/forgot-password', passwordResetRateLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        error: 'Email обязателен',
        code: 'MISSING_EMAIL' 
      });
    }

    // Ищем пользователя по email
    const userResult = await executeQuery(
      'SELECT * FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (!userResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки пользователя',
        code: 'DATABASE_ERROR' 
      });
    }

    // Даже если пользователь не найден, возвращаем успех (безопасность)
    if (userResult.data.length === 0) {
      console.log(`Запрос сброса пароля для несуществующего email: ${email}`);
      return res.json({
        message: 'Если этот email зарегистрирован, на него будет отправлено письмо со ссылкой для сброса пароля.'
      });
    }

    const user = userResult.data[0];

    // Проверяем, что у пользователя есть пароль (зарегистрирован через email)
    if (!user.password_hash) {
      console.log(`Запрос сброса пароля для пользователя без пароля: ${email}`);
      return res.json({
        message: 'Если этот email зарегистрирован, на него будет отправлено письмо со ссылкой для сброса пароля.'
      });
    }

    // Генерируем токен сброса пароля
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Токен действителен 1 час

    // Создаем таблицу password_reset_tokens если её нет
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Удаляем старые токены для этого пользователя
    await executeQuery(
      'DELETE FROM password_reset_tokens WHERE user_id = ?',
      [user.id]
    );

    // Сохраняем новый токен
    const tokenResult = await executeQuery(
      `INSERT INTO password_reset_tokens (id, user_id, token, expires_at)
       VALUES (?, ?, ?, ?)`,
      [tokenId, user.id, resetToken, expiresAt.toISOString()]
    );

    if (!tokenResult.success) {
      console.error('Ошибка создания токена сброса:', tokenResult.error);
      return res.status(500).json({ 
        error: 'Ошибка создания токена сброса',
        code: 'DATABASE_ERROR' 
      });
    }

    // Отправляем письмо
    const { sendPasswordResetEmail } = await import('../services/emailService.js');
    const emailResult = await sendPasswordResetEmail(email, user.display_name, resetToken);

    if (!emailResult.success) {
      console.error('Ошибка отправки письма:', emailResult.error);
    }

    console.log(`✅ Токен сброса пароля создан для: ${user.display_name} (${email})`);

    res.json({
      message: 'Если этот email зарегистрирован, на него будет отправлено письмо со ссылкой для сброса пароля.',
      emailSent: emailResult.success
    });

  } catch (error) {
    console.error('Ошибка запроса сброса пароля:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Сброс пароля по токену
 * 
 * Body:
 * - token: string (обязательно)
 * - password: string (обязательно)
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ 
        error: 'Токен и пароль обязательны',
        code: 'MISSING_FIELDS' 
      });
    }

    // Валидация пароля
    if (password.length < 8) {
      return res.status(400).json({ 
        error: 'Пароль должен содержать минимум 8 символов',
        code: 'PASSWORD_TOO_SHORT' 
      });
    }

    const hasLetter = /[a-zA-Zа-яА-Я]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    if (!hasLetter || !hasNumber) {
      return res.status(400).json({ 
        error: 'Пароль должен содержать хотя бы одну букву и одну цифру',
        code: 'PASSWORD_TOO_WEAK' 
      });
    }

    // Ищем токен в базе данных
    const tokenResult = await executeQuery(
      'SELECT * FROM password_reset_tokens WHERE token = ?',
      [token]
    );

    if (!tokenResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки токена',
        code: 'DATABASE_ERROR' 
      });
    }

    if (tokenResult.data.length === 0) {
      return res.status(400).json({ 
        error: 'Неверный или недействительный токен сброса пароля',
        code: 'INVALID_TOKEN' 
      });
    }

    const resetToken = tokenResult.data[0];

    // Проверяем, не истек ли токен
    const now = new Date();
    const tokenExpiresAt = new Date(resetToken.expires_at);

    if (now > tokenExpiresAt) {
      // Удаляем истекший токен
      await executeQuery(
        'DELETE FROM password_reset_tokens WHERE id = ?',
        [resetToken.id]
      );

      return res.status(400).json({ 
        error: 'Токен сброса пароля истек. Пожалуйста, запросите новую ссылку.',
        code: 'TOKEN_EXPIRED' 
      });
    }

    // Хешируем новый пароль
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Обновляем пароль пользователя
    const updateResult = await executeQuery(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [passwordHash, resetToken.user_id]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка обновления пароля',
        code: 'DATABASE_ERROR' 
      });
    }

    // Удаляем использованный токен
    await executeQuery(
      'DELETE FROM password_reset_tokens WHERE id = ?',
      [resetToken.id]
    );

    // Удаляем все активные сессии пользователя (для безопасности)
    await executeQuery(
      'DELETE FROM sessions WHERE user_id = ?',
      [resetToken.user_id]
    );

    console.log(`✅ Пароль сброшен для пользователя ID: ${resetToken.user_id}`);

    res.json({
      message: 'Пароль успешно изменен. Теперь вы можете войти с новым паролем.'
    });

  } catch (error) {
    console.error('Ошибка сброса пароля:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/auth/google
 * Инициация Google OAuth авторизации
 */
router.get('/google', passport.authenticate('google', { 
  scope: ['profile', 'email'],
  session: false 
}));

/**
 * GET /api/auth/google/callback
 * Обработка ответа от Google OAuth
 */
router.get('/google/callback', 
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${process.env.PUBLIC_URL || 'http://localhost:3000'}/login?error=google_auth_failed`
  }),
  async (req, res) => {
    try {
      const user = req.user;

      if (!user) {
        return res.redirect(`${process.env.PUBLIC_URL || 'http://localhost:3000'}/login?error=no_user`);
      }

      // Создаем новую сессию
      const sessionId = uuidv4();
      const token = uuidv4();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // Сессия на 30 дней

      const sessionResult = await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at)
         VALUES (?, ?, ?, ?)`,
        [sessionId, user.id, token, expiresAt.toISOString()]
      );

      if (!sessionResult.success) {
        console.error('Ошибка создания сессии:', sessionResult.error);
        return res.redirect(`${process.env.PUBLIC_URL || 'http://localhost:3000'}/login?error=session_error`);
      }

      console.log(`✅ Сессия создана для пользователя ${user.display_name} через Google OAuth`);

      // Редирект на главную страницу с токеном
      const redirectUrl = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/?token=${token}`;
      res.redirect(redirectUrl);

    } catch (error) {
      console.error('❌ Ошибка в Google OAuth callback:', error);
      res.redirect(`${process.env.PUBLIC_URL || 'http://localhost:3000'}/login?error=callback_error`);
    }
  }
);

/**
 * POST /api/auth/link-google
 * Привязать Google аккаунт к существующему пользователю
 * Требует аутентификации
 * 
 * Body:
 * - googleId: string (обязательно)
 */
router.post('/link-google', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { googleId } = req.body;

    if (!googleId) {
      return res.status(400).json({ 
        error: 'googleId обязателен',
        code: 'MISSING_FIELDS' 
      });
    }

    // Проверяем, не привязан ли этот Google аккаунт к другому пользователю
    const googleCheck = await executeQuery(
      'SELECT id FROM users WHERE google_id = ? AND id != ?',
      [googleId, userId]
    );

    if (!googleCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки Google аккаунта',
        code: 'DATABASE_ERROR' 
      });
    }

    if (googleCheck.data.length > 0) {
      return res.status(400).json({ 
        error: 'Этот Google аккаунт уже привязан к другому пользователю',
        code: 'GOOGLE_ALREADY_LINKED' 
      });
    }

    // Обновляем пользователя
    const updateResult = await executeQuery(
      `UPDATE users 
       SET google_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [googleId, userId]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка привязки Google',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json({
      message: 'Google аккаунт успешно привязан',
      googleId
    });

  } catch (error) {
    console.error('Ошибка привязки Google:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * DELETE /api/auth/unlink-google
 * Отвязать Google аккаунт от пользователя
 * Требует аутентификации
 * Нельзя отвязать, если это единственный способ входа
 */
router.delete('/unlink-google', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Получаем информацию о пользователе
    const userResult = await executeQuery(
      'SELECT auth_method, email, google_id, discord_id, telegram_username, password_hash FROM users WHERE id = ?',
      [userId]
    );

    if (!userResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения данных пользователя',
        code: 'DATABASE_ERROR' 
      });
    }

    if (userResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND' 
      });
    }

    const user = userResult.data[0];

    // Проверяем, есть ли другие способы входа
    const hasOtherMethods = user.telegram_username || user.discord_id || user.password_hash;

    if (!hasOtherMethods) {
      return res.status(400).json({ 
        error: 'Нельзя отвязать Google, так как это единственный способ входа. Сначала привяжите другой способ входа.',
        code: 'LAST_AUTH_METHOD' 
      });
    }

    // Отвязываем Google
    const updateResult = await executeQuery(
      `UPDATE users 
       SET google_id = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [userId]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка отвязки Google',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json({
      message: 'Google аккаунт успешно отвязан'
    });

  } catch (error) {
    console.error('Ошибка отвязки Google:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/auth/discord
 * Инициация Discord OAuth авторизации
 */
router.get('/discord', passport.authenticate('discord', { 
  scope: ['identify', 'email'],
  session: false 
}));

/**
 * GET /api/auth/discord/callback
 * Обработка ответа от Discord OAuth
 */
router.get('/discord/callback', 
  passport.authenticate('discord', { 
    session: false,
    failureRedirect: `${process.env.PUBLIC_URL || 'http://localhost:3000'}/login?error=discord_auth_failed`
  }),
  async (req, res) => {
    try {
      const user = req.user;

      if (!user) {
        return res.redirect(`${process.env.PUBLIC_URL || 'http://localhost:3000'}/login?error=no_user`);
      }

      // Создаем новую сессию
      const sessionId = uuidv4();
      const token = uuidv4();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // Сессия на 30 дней

      const sessionResult = await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at)
         VALUES (?, ?, ?, ?)`,
        [sessionId, user.id, token, expiresAt.toISOString()]
      );

      if (!sessionResult.success) {
        console.error('Ошибка создания сессии:', sessionResult.error);
        return res.redirect(`${process.env.PUBLIC_URL || 'http://localhost:3000'}/login?error=session_error`);
      }

      console.log(`✅ Сессия создана для пользователя ${user.display_name} через Discord OAuth`);

      // Редирект на главную страницу с токеном
      const redirectUrl = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/?token=${token}`;
      res.redirect(redirectUrl);

    } catch (error) {
      console.error('❌ Ошибка в Discord OAuth callback:', error);
      res.redirect(`${process.env.PUBLIC_URL || 'http://localhost:3000'}/login?error=callback_error`);
    }
  }
);

/**
 * POST /api/auth/link-discord
 * Привязать Discord аккаунт к существующему пользователю
 * Требует аутентификации
 * 
 * Body:
 * - discordId: string (обязательно)
 */
router.post('/link-discord', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { discordId } = req.body;

    if (!discordId) {
      return res.status(400).json({ 
        error: 'discordId обязателен',
        code: 'MISSING_FIELDS' 
      });
    }

    // Проверяем, не привязан ли этот Discord аккаунт к другому пользователю
    const discordCheck = await executeQuery(
      'SELECT id FROM users WHERE discord_id = ? AND id != ?',
      [discordId, userId]
    );

    if (!discordCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки Discord аккаунта',
        code: 'DATABASE_ERROR' 
      });
    }

    if (discordCheck.data.length > 0) {
      return res.status(400).json({ 
        error: 'Этот Discord аккаунт уже привязан к другому пользователю',
        code: 'DISCORD_ALREADY_LINKED' 
      });
    }

    // Обновляем пользователя
    const updateResult = await executeQuery(
      `UPDATE users 
       SET discord_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [discordId, userId]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка привязки Discord',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json({
      message: 'Discord аккаунт успешно привязан',
      discordId
    });

  } catch (error) {
    console.error('Ошибка привязки Discord:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * DELETE /api/auth/unlink-discord
 * Отвязать Discord аккаунт от пользователя
 * Требует аутентификации
 * Нельзя отвязать, если это единственный способ входа
 */
router.delete('/unlink-discord', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Получаем информацию о пользователе
    const userResult = await executeQuery(
      'SELECT auth_method, email, google_id, discord_id, telegram_username, password_hash FROM users WHERE id = ?',
      [userId]
    );

    if (!userResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения данных пользователя',
        code: 'DATABASE_ERROR' 
      });
    }

    if (userResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND' 
      });
    }

    const user = userResult.data[0];

    // Проверяем, есть ли другие способы входа
    const hasOtherMethods = user.telegram_username || user.google_id || user.password_hash;

    if (!hasOtherMethods) {
      return res.status(400).json({ 
        error: 'Нельзя отвязать Discord, так как это единственный способ входа. Сначала привяжите другой способ входа.',
        code: 'LAST_AUTH_METHOD' 
      });
    }

    // Отвязываем Discord
    const updateResult = await executeQuery(
      `UPDATE users 
       SET discord_id = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [userId]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка отвязки Discord',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json({
      message: 'Discord аккаунт успешно отвязан'
    });

  } catch (error) {
    console.error('Ошибка отвязки Discord:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

export default router;
