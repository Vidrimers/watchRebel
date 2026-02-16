import { executeQuery } from '../database/db.js';

/**
 * Middleware для проверки аутентификации пользователя
 * Проверяет наличие токена в заголовке Authorization и валидность сессии
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

    // Добавляем информацию о пользователе в request
    req.user = {
      id: session.user_id,
      telegramUsername: session.telegram_username,
      displayName: session.display_name,
      avatarUrl: session.avatar_url,
      isAdmin: Boolean(session.is_admin),
      theme: session.theme
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

export default {
  authenticateToken,
  requireAdmin
};
