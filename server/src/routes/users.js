import express from 'express';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/users/search
 * Поиск пользователей по имени
 * 
 * Query params:
 * - q: string (поисковый запрос)
 */
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Поисковый запрос не может быть пустым',
        code: 'EMPTY_QUERY' 
      });
    }

    // Ищем пользователей по имени (case-insensitive)
    const searchResult = await executeQuery(
      `SELECT id, telegram_username, display_name, avatar_url, is_admin, created_at 
       FROM users 
       WHERE (display_name LIKE ? OR telegram_username LIKE ?) 
       AND is_blocked = 0
       LIMIT 50`,
      [`%${q}%`, `%${q}%`]
    );

    if (!searchResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка поиска пользователей',
        code: 'DATABASE_ERROR' 
      });
    }

    const users = searchResult.data.map(user => ({
      id: user.id,
      telegramUsername: user.telegram_username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      isAdmin: Boolean(user.is_admin),
      createdAt: user.created_at
    }));

    res.json(users);

  } catch (error) {
    console.error('Ошибка поиска пользователей:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/users/:id
 * Получить профиль пользователя по ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Получаем информацию о пользователе
    const userResult = await executeQuery(
      'SELECT id, telegram_username, display_name, avatar_url, is_admin, theme, created_at FROM users WHERE id = ?',
      [id]
    );

    if (!userResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения профиля пользователя',
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

    res.json({
      id: user.id,
      telegramUsername: user.telegram_username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      isAdmin: Boolean(user.is_admin),
      theme: user.theme,
      createdAt: user.created_at
    });

  } catch (error) {
    console.error('Ошибка получения профиля пользователя:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * PUT /api/users/:id
 * Обновить профиль пользователя
 * Требует аутентификации и права на редактирование (свой профиль или админ)
 * 
 * Body:
 * - displayName: string (опционально)
 * - theme: string (опционально)
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, theme } = req.body;

    // Проверяем права: пользователь может редактировать только свой профиль или админ может редактировать любой
    if (req.user.id !== id && !req.user.isAdmin) {
      return res.status(403).json({ 
        error: 'Нет прав на редактирование этого профиля',
        code: 'FORBIDDEN' 
      });
    }

    // Проверяем, существует ли пользователь
    const userCheck = await executeQuery(
      'SELECT id FROM users WHERE id = ?',
      [id]
    );

    if (!userCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки пользователя',
        code: 'DATABASE_ERROR' 
      });
    }

    if (userCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND' 
      });
    }

    // Формируем запрос на обновление
    const updates = [];
    const params = [];

    if (displayName !== undefined) {
      updates.push('display_name = ?');
      params.push(displayName);
    }

    if (theme !== undefined) {
      updates.push('theme = ?');
      params.push(theme);
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        error: 'Нет данных для обновления',
        code: 'NO_UPDATE_DATA' 
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const updateResult = await executeQuery(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка обновления профиля',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем обновленные данные пользователя
    const updatedUserResult = await executeQuery(
      'SELECT id, telegram_username, display_name, avatar_url, is_admin, theme, created_at FROM users WHERE id = ?',
      [id]
    );

    const updatedUser = updatedUserResult.data[0];

    res.json({
      id: updatedUser.id,
      telegramUsername: updatedUser.telegram_username,
      displayName: updatedUser.display_name,
      avatarUrl: updatedUser.avatar_url,
      isAdmin: Boolean(updatedUser.is_admin),
      theme: updatedUser.theme,
      createdAt: updatedUser.created_at
    });

  } catch (error) {
    console.error('Ошибка обновления профиля пользователя:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/users/:id/friends
 * Добавить пользователя в друзья
 */
router.post('/:id/friends', authenticateToken, async (req, res) => {
  try {
    const friendId = req.params.id;
    const userId = req.user.id;

    // Нельзя добавить самого себя в друзья
    if (userId === friendId) {
      return res.status(400).json({ 
        error: 'Нельзя добавить самого себя в друзья',
        code: 'SELF_FRIEND' 
      });
    }

    // Проверяем, существует ли пользователь, которого добавляем
    const friendCheck = await executeQuery(
      'SELECT id FROM users WHERE id = ? AND is_blocked = 0',
      [friendId]
    );

    if (!friendCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки пользователя',
        code: 'DATABASE_ERROR' 
      });
    }

    if (friendCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND' 
      });
    }

    // Проверяем, не добавлен ли уже в друзья
    const existingFriendship = await executeQuery(
      'SELECT id FROM friends WHERE user_id = ? AND friend_id = ?',
      [userId, friendId]
    );

    if (!existingFriendship.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки дружбы',
        code: 'DATABASE_ERROR' 
      });
    }

    if (existingFriendship.data.length > 0) {
      return res.status(400).json({ 
        error: 'Пользователь уже в друзьях',
        code: 'ALREADY_FRIENDS' 
      });
    }

    // Добавляем в друзья
    const { v4: uuidv4 } = await import('uuid');
    const friendshipId = uuidv4();

    const insertResult = await executeQuery(
      'INSERT INTO friends (id, user_id, friend_id) VALUES (?, ?, ?)',
      [friendshipId, userId, friendId]
    );

    if (!insertResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка добавления в друзья',
        code: 'DATABASE_ERROR' 
      });
    }

    res.status(201).json({
      id: friendshipId,
      userId,
      friendId,
      message: 'Пользователь добавлен в друзья'
    });

  } catch (error) {
    console.error('Ошибка добавления в друзья:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/users/:id/friends
 * Получить список друзей пользователя
 */
router.get('/:id/friends', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Получаем список друзей
    const friendsResult = await executeQuery(
      `SELECT u.id, u.telegram_username, u.display_name, u.avatar_url, u.is_admin, u.created_at, f.created_at as friendship_created_at
       FROM friends f
       JOIN users u ON f.friend_id = u.id
       WHERE f.user_id = ? AND u.is_blocked = 0
       ORDER BY f.created_at DESC`,
      [id]
    );

    if (!friendsResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения списка друзей',
        code: 'DATABASE_ERROR' 
      });
    }

    const friends = friendsResult.data.map(friend => ({
      id: friend.id,
      telegramUsername: friend.telegram_username,
      displayName: friend.display_name,
      avatarUrl: friend.avatar_url,
      isAdmin: Boolean(friend.is_admin),
      createdAt: friend.created_at,
      friendshipCreatedAt: friend.friendship_created_at
    }));

    res.json(friends);

  } catch (error) {
    console.error('Ошибка получения списка друзей:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/users/:id/genre-stats
 * Получить статистику по жанрам пользователя
 * Вычисляет процентное соотношение жанров на основе оценок пользователя
 */
router.get('/:id/genre-stats', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Проверяем, существует ли пользователь
    const userCheck = await executeQuery(
      'SELECT id FROM users WHERE id = ?',
      [id]
    );

    if (!userCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки пользователя',
        code: 'DATABASE_ERROR' 
      });
    }

    if (userCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND' 
      });
    }

    // Получаем все оценки пользователя
    const ratingsResult = await executeQuery(
      'SELECT tmdb_id, media_type FROM ratings WHERE user_id = ?',
      [id]
    );

    if (!ratingsResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения оценок',
        code: 'DATABASE_ERROR' 
      });
    }

    // Если у пользователя нет оценок, возвращаем пустую статистику
    if (ratingsResult.data.length === 0) {
      return res.json([]);
    }

    // Для реальной реализации нужно было бы получить жанры из TMDb API
    // Но для базовой реализации возвращаем заглушку
    // TODO: Интегрировать с TMDb API для получения жанров
    
    res.json([]);

  } catch (error) {
    console.error('Ошибка получения статистики по жанрам:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

export default router;
