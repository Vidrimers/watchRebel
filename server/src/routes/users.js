import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { uploadAvatar } from '../middleware/upload.js';
import { sendTelegramNotification, checkNotificationEnabled } from '../services/notificationService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    // Ищем пользователей по имени (case-insensitive для кириллицы)
    // SQLite LOWER() не работает с кириллицей, поэтому делаем сравнение на уровне приложения
    const searchQuery = q.toLowerCase();
    
    // Получаем всех незаблокированных пользователей
    const allUsersResult = await executeQuery(
      `SELECT id, telegram_username, display_name, avatar_url, user_status, is_admin, created_at 
       FROM users 
       WHERE is_blocked = 0`
    );

    if (!allUsersResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка поиска пользователей',
        code: 'DATABASE_ERROR' 
      });
    }

    // Фильтруем на уровне приложения для корректной работы с кириллицей
    const filteredUsers = allUsersResult.data.filter(user => {
      const displayName = (user.display_name || '').toLowerCase();
      const telegramUsername = (user.telegram_username || '').toLowerCase();
      return displayName.includes(searchQuery) || telegramUsername.includes(searchQuery);
    });

    // Ограничиваем результат 50 пользователями
    const users = filteredUsers.slice(0, 50).map(user => ({
      id: user.id,
      telegramUsername: user.telegram_username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      userStatus: user.user_status,
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
      'SELECT id, telegram_username, display_name, avatar_url, user_status, is_admin, is_blocked, ban_reason, post_ban_until, theme, wall_privacy, auth_method, email, google_id, discord_id, email_verified, created_at FROM users WHERE id = ?',
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
      userStatus: user.user_status,
      isAdmin: Boolean(user.is_admin),
      isBlocked: Boolean(user.is_blocked),
      banReason: user.ban_reason,
      postBanUntil: user.post_ban_until,
      theme: user.theme,
      wallPrivacy: user.wall_privacy || 'all',
      authMethod: user.auth_method || 'telegram',
      email: user.email,
      hasGoogleLinked: Boolean(user.google_id),
      hasDiscordLinked: Boolean(user.discord_id),
      emailVerified: Boolean(user.email_verified),
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
 * Body (multipart/form-data):
 * - displayName: string (опционально)
 * - userStatus: string (опционально, максимум 100 символов)
 * - theme: string (опционально)
 * - avatar: file (опционально) - изображение для аватарки
 */
router.put('/:id', authenticateToken, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, userStatus, theme, wallPrivacy } = req.body;
    const avatarFile = req.file;

    // Проверяем права: пользователь может редактировать только свой профиль или админ может редактировать любой
    if (req.user.id !== id && !req.user.isAdmin) {
      // Удаляем загруженный файл, если нет прав
      if (avatarFile) {
        fs.unlinkSync(avatarFile.path);
      }
      return res.status(403).json({ 
        error: 'Нет прав на редактирование этого профиля',
        code: 'FORBIDDEN' 
      });
    }

    // Валидация userStatus
    if (userStatus !== undefined && userStatus !== null && userStatus.length > 100) {
      // Удаляем загруженный файл при ошибке валидации
      if (avatarFile) {
        fs.unlinkSync(avatarFile.path);
      }
      return res.status(400).json({ 
        error: 'Статус не может быть длиннее 100 символов',
        code: 'STATUS_TOO_LONG' 
      });
    }

    // Проверяем, существует ли пользователь
    const userCheck = await executeQuery(
      'SELECT id, avatar_url FROM users WHERE id = ?',
      [id]
    );

    if (!userCheck.success) {
      // Удаляем загруженный файл при ошибке
      if (avatarFile) {
        fs.unlinkSync(avatarFile.path);
      }
      return res.status(500).json({ 
        error: 'Ошибка проверки пользователя',
        code: 'DATABASE_ERROR' 
      });
    }

    if (userCheck.data.length === 0) {
      // Удаляем загруженный файл, если пользователь не найден
      if (avatarFile) {
        fs.unlinkSync(avatarFile.path);
      }
      return res.status(404).json({ 
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND' 
      });
    }

    const oldAvatarUrl = userCheck.data[0].avatar_url;

    // Формируем запрос на обновление
    const updates = [];
    const params = [];

    if (displayName !== undefined) {
      updates.push('display_name = ?');
      params.push(displayName);
    }

    if (userStatus !== undefined) {
      // Проверяем текущий статус перед обновлением
      const currentUserResult = await executeQuery(
        'SELECT user_status FROM users WHERE id = ?',
        [id]
      );
      
      const currentStatus = currentUserResult.success && currentUserResult.data.length > 0 
        ? currentUserResult.data[0].user_status 
        : null;
      
      const newStatus = userStatus && userStatus.trim() !== '' ? userStatus.trim() : null;
      
      updates.push('user_status = ?');
      params.push(newStatus);
      
      // Создаем wall post при изменении статуса
      // Только если статус действительно изменился И новый статус не пустой
      if (currentStatus !== newStatus && newStatus !== null) {
        console.log('📝 Создание поста со статусом:');
        console.log('  - userId:', id);
        console.log('  - currentStatus:', currentStatus);
        console.log('  - newStatus:', newStatus);
        
        const postId = uuidv4();
        const insertResult = await executeQuery(
          `INSERT INTO wall_posts (id, user_id, wall_owner_id, post_type, content, created_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          [postId, id, id, 'status_update', newStatus]
        );
        
        if (insertResult.success) {
          console.log('✅ Пост со статусом создан:', postId);
        } else {
          console.error('❌ Ошибка создания поста со статусом:', insertResult);
        }
      } else {
        console.log('⏭️  Пост со статусом не создан:');
        console.log('  - currentStatus === newStatus:', currentStatus === newStatus);
        console.log('  - newStatus === null:', newStatus === null);
      }
    }

    if (theme !== undefined) {
      updates.push('theme = ?');
      params.push(theme);
    }

    if (wallPrivacy !== undefined) {
      // Валидация wallPrivacy
      const validPrivacyValues = ['all', 'friends', 'none'];
      if (!validPrivacyValues.includes(wallPrivacy)) {
        if (avatarFile) {
          fs.unlinkSync(avatarFile.path);
        }
        return res.status(400).json({ 
          error: 'wallPrivacy должен быть одним из: all, friends, none',
          code: 'INVALID_WALL_PRIVACY' 
        });
      }
      updates.push('wall_privacy = ?');
      params.push(wallPrivacy);
    }

    // Если загружена новая аватарка
    if (avatarFile) {
      // Формируем URL для аватарки
      const avatarUrl = `/uploads/avatars/${avatarFile.filename}`;
      updates.push('avatar_url = ?');
      params.push(avatarUrl);

      // Удаляем старую аватарку, если она была загружена пользователем (не из Telegram)
      if (oldAvatarUrl && oldAvatarUrl.startsWith('/uploads/')) {
        const oldAvatarPath = path.join(__dirname, '../../', oldAvatarUrl);
        if (fs.existsSync(oldAvatarPath)) {
          try {
            fs.unlinkSync(oldAvatarPath);
          } catch (err) {
            console.error('Ошибка удаления старой аватарки:', err);
          }
        }
      }
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
      // Удаляем загруженный файл при ошибке обновления
      if (avatarFile) {
        fs.unlinkSync(avatarFile.path);
      }
      return res.status(500).json({ 
        error: 'Ошибка обновления профиля',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем обновленные данные пользователя
    const updatedUserResult = await executeQuery(
      'SELECT id, telegram_username, display_name, avatar_url, user_status, is_admin, theme, wall_privacy, created_at FROM users WHERE id = ?',
      [id]
    );

    const updatedUser = updatedUserResult.data[0];

    res.json({
      id: updatedUser.id,
      telegramUsername: updatedUser.telegram_username,
      displayName: updatedUser.display_name,
      avatarUrl: updatedUser.avatar_url,
      userStatus: updatedUser.user_status,
      isAdmin: Boolean(updatedUser.is_admin),
      theme: updatedUser.theme,
      wallPrivacy: updatedUser.wall_privacy || 'all',
      createdAt: updatedUser.created_at
    });

  } catch (error) {
    console.error('Ошибка обновления профиля пользователя:', error);
    
    // Удаляем загруженный файл при ошибке
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('Ошибка удаления файла:', err);
      }
    }
    
    // Обработка ошибок multer
    if (error.message && error.message.includes('Недопустимый тип файла')) {
      return res.status(400).json({ 
        error: error.message,
        code: 'INVALID_FILE_TYPE' 
      });
    }
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'Файл слишком большой. Максимальный размер: 5MB',
        code: 'FILE_TOO_LARGE' 
      });
    }
    
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

    // Получаем имя пользователя, который добавил в друзья
    const userResult = await executeQuery(
      'SELECT display_name FROM users WHERE id = ?',
      [userId]
    );

    if (userResult.success && userResult.data.length > 0) {
      const userName = userResult.data[0].display_name;
      
      // Проверяем настройки уведомлений получателя
      const isNotificationEnabled = await checkNotificationEnabled(friendId, 'new_friend_request');
      
      if (isNotificationEnabled) {
        // Отправляем уведомление в Telegram
        const telegramMessage = `👥 <b>Новый друг!</b>\n\n${userName} добавил вас в друзья!`;
        sendTelegramNotification(friendId, telegramMessage).catch(err => {
          console.error('Ошибка отправки уведомления о добавлении в друзья:', err);
        });
      } else {
        console.log(`🔕 Уведомление о добавлении в друзья не отправлено пользователю ${friendId} (отключено в настройках)`);
      }
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
      `SELECT u.id, u.telegram_username, u.display_name, u.avatar_url, u.user_status, u.is_admin, u.created_at, f.created_at as friendship_created_at
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
      userStatus: friend.user_status,
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

/**
 * GET /api/users/:id/referral-code
 * Получить реферальный код пользователя
 */
router.get('/:id/referral-code', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Проверяем права: пользователь может получить только свой реферальный код
    if (req.user.id !== id && !req.user.isAdmin) {
      return res.status(403).json({ 
        error: 'Нет прав на просмотр реферального кода',
        code: 'FORBIDDEN' 
      });
    }

    // Получаем реферальный код пользователя
    const userResult = await executeQuery(
      'SELECT referral_code, referrals_count FROM users WHERE id = ?',
      [id]
    );

    if (!userResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения реферального кода',
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
      referralCode: user.referral_code,
      referralsCount: user.referrals_count || 0
    });

  } catch (error) {
    console.error('Ошибка получения реферального кода:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/users/:id/referrals
 * Получить список приглашенных пользователей (рефералов)
 */
router.get('/:id/referrals', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Проверяем права: пользователь может получить только свой список рефералов
    if (req.user.id !== id && !req.user.isAdmin) {
      return res.status(403).json({ 
        error: 'Нет прав на просмотр списка рефералов',
        code: 'FORBIDDEN' 
      });
    }

    // Получаем список рефералов
    const referralsResult = await executeQuery(
      `SELECT u.id, u.telegram_username, u.display_name, u.avatar_url, u.created_at, r.created_at as referral_created_at
       FROM referrals r
       JOIN users u ON r.referred_id = u.id
       WHERE r.referrer_id = ?
       ORDER BY r.created_at DESC`,
      [id]
    );

    if (!referralsResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения списка рефералов',
        code: 'DATABASE_ERROR' 
      });
    }

    const referrals = referralsResult.data.map(referral => ({
      id: referral.id,
      telegramUsername: referral.telegram_username,
      displayName: referral.display_name,
      avatarUrl: referral.avatar_url,
      createdAt: referral.created_at,
      referralCreatedAt: referral.referral_created_at
    }));

    res.json(referrals);

  } catch (error) {
    console.error('Ошибка получения списка рефералов:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/users/:id/notification-settings
 * Получить настройки уведомлений пользователя
 */
router.get('/:id/notification-settings', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Проверяем права: пользователь может получить только свои настройки (или админ любые)
    if (req.user.id !== id && !req.user.isAdmin) {
      return res.status(403).json({ 
        error: 'Нет прав на просмотр настроек уведомлений',
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

    // Получаем настройки уведомлений
    const settingsResult = await executeQuery(
      'SELECT * FROM notification_settings WHERE user_id = ?',
      [id]
    );

    if (!settingsResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения настроек уведомлений',
        code: 'DATABASE_ERROR' 
      });
    }

    // Если настроек нет, создаем их с дефолтными значениями
    if (settingsResult.data.length === 0) {
      const settingsId = uuidv4();
      const createResult = await executeQuery(
        `INSERT INTO notification_settings (id, user_id) VALUES (?, ?)`,
        [settingsId, id]
      );

      if (!createResult.success) {
        return res.status(500).json({ 
          error: 'Ошибка создания настроек уведомлений',
          code: 'DATABASE_ERROR' 
        });
      }

      // Возвращаем дефолтные настройки
      return res.json({
        userId: id,
        friendAddedToList: true,
        friendRatedMedia: true,
        friendPostedReview: true,
        friendReactedToPost: true,
        newMessage: true,
        newFriendRequest: true,
        adminAnnouncement: true
      });
    }

    const settings = settingsResult.data[0];

    res.json({
      userId: settings.user_id,
      friendAddedToList: Boolean(settings.friend_added_to_list),
      friendRatedMedia: Boolean(settings.friend_rated_media),
      friendPostedReview: Boolean(settings.friend_posted_review),
      friendReactedToPost: Boolean(settings.friend_reacted_to_post),
      newMessage: Boolean(settings.new_message),
      newFriendRequest: Boolean(settings.new_friend_request),
      adminAnnouncement: Boolean(settings.admin_announcement)
    });

  } catch (error) {
    console.error('Ошибка получения настроек уведомлений:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * PUT /api/users/:id/notification-settings
 * Обновить настройки уведомлений пользователя
 * 
 * Body:
 * - friendAddedToList: boolean (опционально)
 * - friendRatedMedia: boolean (опционально)
 * - friendPostedReview: boolean (опционально)
 * - friendReactedToPost: boolean (опционально)
 * - newMessage: boolean (опционально)
 * - newFriendRequest: boolean (опционально)
 * - adminAnnouncement: boolean (опционально)
 */
router.put('/:id/notification-settings', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      friendAddedToList,
      friendRatedMedia,
      friendPostedReview,
      friendReactedToPost,
      newMessage,
      newFriendRequest,
      adminAnnouncement
    } = req.body;

    // Проверяем права: пользователь может обновить только свои настройки (или админ любые)
    if (req.user.id !== id && !req.user.isAdmin) {
      return res.status(403).json({ 
        error: 'Нет прав на изменение настроек уведомлений',
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

    // Проверяем, существуют ли настройки
    const settingsCheck = await executeQuery(
      'SELECT id FROM notification_settings WHERE user_id = ?',
      [id]
    );

    if (!settingsCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки настроек',
        code: 'DATABASE_ERROR' 
      });
    }

    // Если настроек нет, создаем их
    if (settingsCheck.data.length === 0) {
      const settingsId = uuidv4();
      const createResult = await executeQuery(
        `INSERT INTO notification_settings (id, user_id) VALUES (?, ?)`,
        [settingsId, id]
      );

      if (!createResult.success) {
        return res.status(500).json({ 
          error: 'Ошибка создания настроек уведомлений',
          code: 'DATABASE_ERROR' 
        });
      }
    }

    // Формируем запрос на обновление
    const updates = [];
    const params = [];

    if (friendAddedToList !== undefined) {
      updates.push('friend_added_to_list = ?');
      params.push(friendAddedToList ? 1 : 0);
    }

    if (friendRatedMedia !== undefined) {
      updates.push('friend_rated_media = ?');
      params.push(friendRatedMedia ? 1 : 0);
    }

    if (friendPostedReview !== undefined) {
      updates.push('friend_posted_review = ?');
      params.push(friendPostedReview ? 1 : 0);
    }

    if (friendReactedToPost !== undefined) {
      updates.push('friend_reacted_to_post = ?');
      params.push(friendReactedToPost ? 1 : 0);
    }

    if (newMessage !== undefined) {
      updates.push('new_message = ?');
      params.push(newMessage ? 1 : 0);
    }

    if (newFriendRequest !== undefined) {
      updates.push('new_friend_request = ?');
      params.push(newFriendRequest ? 1 : 0);
    }

    if (adminAnnouncement !== undefined) {
      updates.push('admin_announcement = ?');
      params.push(adminAnnouncement ? 1 : 0);
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
      `UPDATE notification_settings SET ${updates.join(', ')} WHERE user_id = ?`,
      params
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка обновления настроек уведомлений',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем обновленные настройки
    const updatedSettingsResult = await executeQuery(
      'SELECT * FROM notification_settings WHERE user_id = ?',
      [id]
    );

    const settings = updatedSettingsResult.data[0];

    res.json({
      userId: settings.user_id,
      friendAddedToList: Boolean(settings.friend_added_to_list),
      friendRatedMedia: Boolean(settings.friend_rated_media),
      friendPostedReview: Boolean(settings.friend_posted_review),
      friendReactedToPost: Boolean(settings.friend_reacted_to_post),
      newMessage: Boolean(settings.new_message),
      newFriendRequest: Boolean(settings.new_friend_request),
      adminAnnouncement: Boolean(settings.admin_announcement)
    });

  } catch (error) {
    console.error('Ошибка обновления настроек уведомлений:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * DELETE /api/users/me
 * Удалить свой аккаунт
 * Требует подтверждения через body.confirmation = "УДАЛИТЬ"
 * Каскадно удаляет все данные пользователя
 */
router.delete('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { confirmation } = req.body;

    // Проверяем подтверждение
    if (confirmation !== 'УДАЛИТЬ') {
      return res.status(400).json({ 
        error: 'Для удаления аккаунта введите "УДАЛИТЬ" в поле подтверждения',
        code: 'INVALID_CONFIRMATION' 
      });
    }

    // Получаем информацию о пользователе для удаления аватарки
    const userResult = await executeQuery(
      'SELECT avatar_url FROM users WHERE id = ?',
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

    const avatarUrl = userResult.data[0].avatar_url;

    // Удаляем пользователя (каскадное удаление настроено в БД)
    const deleteResult = await executeQuery(
      'DELETE FROM users WHERE id = ?',
      [userId]
    );

    if (!deleteResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка удаления аккаунта',
        code: 'DATABASE_ERROR' 
      });
    }

    // Удаляем аватарку, если она была загружена пользователем
    if (avatarUrl && avatarUrl.startsWith('/uploads/')) {
      const avatarPath = path.join(__dirname, '../../', avatarUrl);
      if (fs.existsSync(avatarPath)) {
        try {
          fs.unlinkSync(avatarPath);
        } catch (err) {
          console.error('Ошибка удаления аватарки:', err);
        }
      }
    }

    // Удаляем все сессии пользователя
    await executeQuery(
      'DELETE FROM sessions WHERE user_id = ?',
      [userId]
    );

    res.json({
      message: 'Аккаунт успешно удален',
      userId
    });

  } catch (error) {
    console.error('Ошибка удаления аккаунта:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

export default router;
