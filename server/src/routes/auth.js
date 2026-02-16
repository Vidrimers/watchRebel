import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

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
      
      const insertResult = await executeQuery(
        `INSERT INTO users (id, telegram_username, display_name, avatar_url, is_admin, theme)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [telegramId, telegramUsername || null, displayName, avatarUrl || null, isAdmin ? 1 : 0, 'light-cream']
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
      await executeQuery(
        `UPDATE users 
         SET telegram_username = ?, display_name = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [telegramUsername || user.telegram_username, displayName, avatarUrl || user.avatar_url, telegramId]
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

export default router;
