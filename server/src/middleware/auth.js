import { executeQuery } from '../database/db.js';

/**
 * Middleware для проверки аутентификации пользователя
 * Проверяет наличие токена в заголовке Authorization и валидность сессии
 * Поддерживает разные способы аутентификации: telegram, email, google, discord
 */
export async function authenticateToken(req, res, next) {
  try {
    // Получаем токен из заголовка Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Токен не предоставлен',
        code: 'NO_TOKEN' 
      });
    }

    // Проверяем токен в базе данных
    const result = await executeQuery(
      `SELECT s.*, u.* 
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = ? AND s.expires_at > datetime('now')`,
      [token]
    );

    if (!result.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки токена',
        code: 'DATABASE_ERROR' 
      });
    }

    if (!result.data || result.data.length === 0) {
      return res.status(401).json({ 
        error: 'Недействительный или истекший токен',
        code: 'INVALID_TOKEN' 
      });
    }

    const session = result.data[0];

    // Проверяем, не заблокирован ли пользователь
    if (session.is_blocked) {
      return res.status(403).json({ 
        error: 'Пользователь заблокирован',
        code: 'USER_BLOCKED' 
      });
    }

    // Для email аккаунтов проверяем подтверждение email
    if (session.auth_method === 'email' && !session.email_verified) {
      return res.status(403).json({ 
        error: 'Email не подтвержден. Проверьте свою почту.',
        code: 'EMAIL_NOT_VERIFIED' 
      });
    }

    // Добавляем информацию о пользователе в request
    req.user = {
      id: session.user_id,
      telegramUsername: session.telegram_username,
      displayName: session.display_name,
      avatarUrl: session.avatar_url,
      userStatus: session.user_status,
      isAdmin: Boolean(session.is_admin),
      theme: session.theme,
      authMethod: session.auth_method || 'telegram', // По умолчанию telegram для старых пользователей
      email: session.email,
      emailVerified: Boolean(session.email_verified),
      googleId: session.google_id,
      discordId: session.discord_id
    };

    req.sessionId = session.id;

    next();
  } catch (error) {
    console.error('Ошибка middleware аутентификации:', error);
    return res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
}

/**
 * Middleware для проверки прав администратора
 * Должен использоваться после authenticateToken
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Требуется аутентификация',
      code: 'NO_AUTH' 
    });
  }

  if (!req.user.isAdmin) {
    return res.status(403).json({ 
      error: 'Требуются права администратора',
      code: 'NOT_ADMIN' 
    });
  }

  next();
}

/**
 * Middleware для проверки блокировок на создание постов
 * Должен использоваться после authenticateToken
 * Проверяет постоянный бан и временный бан на посты
 */
export async function checkPostBan(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Требуется аутентификация',
        code: 'NO_AUTH' 
      });
    }

    // Получаем актуальные данные пользователя
    const result = await executeQuery(
      'SELECT is_blocked, ban_reason, post_ban_until FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!result.success || !result.data || result.data.length === 0) {
      return res.status(500).json({ 
        error: 'Ошибка проверки пользователя',
        code: 'DATABASE_ERROR' 
      });
    }

    const user = result.data[0];

    // Проверка постоянного бана
    if (user.is_blocked) {
      return res.status(403).json({ 
        error: 'Ваш аккаунт заблокирован',
        code: 'USER_BLOCKED',
        reason: user.ban_reason
      });
    }

    // Проверка временного бана на посты
    if (user.post_ban_until) {
      const banUntil = new Date(user.post_ban_until);
      const now = new Date();

      if (banUntil > now) {
        return res.status(403).json({ 
          error: 'Создание постов временно запрещено',
          code: 'POST_BAN_ACTIVE',
          reason: user.ban_reason,
          expiresAt: user.post_ban_until
        });
      }
    }

    next();
  } catch (error) {
    console.error('Ошибка middleware проверки блокировок:', error);
    return res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
}

export default {
  authenticateToken,
  requireAdmin,
  checkPostBan
};
