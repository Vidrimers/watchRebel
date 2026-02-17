import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import crypto from 'crypto';

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
      await executeQuery(
        `UPDATE users 
         SET telegram_username = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [telegramUsername || user.telegram_username, avatarUrl || user.avatar_url, telegramId]
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

        await executeQuery(
          `INSERT INTO notifications (id, user_id, type, content, related_user_id)
           VALUES (?, ?, ?, ?, ?)`,
          [notificationId1, referrerId, 'friend_activity', `${displayName} зарегистрировался по вашей реферальной ссылке!`, telegramId]
        );

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
      await executeQuery(
        `UPDATE users 
         SET telegram_username = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [telegramUsername || user.telegram_username, avatarUrl || user.avatar_url, telegramId]
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

export default router;
