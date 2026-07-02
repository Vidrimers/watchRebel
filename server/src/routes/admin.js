import express from 'express';
import { executeQuery } from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { notifyModeration, sendTelegramNotification } from '../services/notificationService.js';
import { uploadAnnouncement, uploadAdvertisingImages } from '../middleware/upload.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Все админские роуты требуют аутентификации и прав администратора
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/users
 * Получить список всех пользователей
 * Только для администратора
 */
router.get('/users', async (req, res) => {
  try {
    const usersResult = await executeQuery(
      `SELECT id, telegram_username, display_name, avatar_url, is_admin, is_blocked, theme, created_at, updated_at
       FROM users
       ORDER BY created_at DESC`
    );

    if (!usersResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения списка пользователей',
        code: 'DATABASE_ERROR' 
      });
    }

    const users = usersResult.data.map(user => ({
      id: user.id,
      telegramUsername: user.telegram_username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      isAdmin: Boolean(user.is_admin),
      isBlocked: Boolean(user.is_blocked),
      theme: user.theme,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    }));

    res.json(users);

  } catch (error) {
    console.error('Ошибка получения списка пользователей:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Удалить пользователя (каскадное удаление всех связанных данных)
 * Только для администратора
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Проверяем, что пользователь не пытается удалить самого себя
    if (req.user.id === id) {
      return res.status(400).json({ 
        error: 'Нельзя удалить самого себя',
        code: 'CANNOT_DELETE_SELF' 
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

    // Удаляем пользователя (каскадное удаление настроено через FOREIGN KEY ON DELETE CASCADE)
    const deleteResult = await executeQuery(
      'DELETE FROM users WHERE id = ?',
      [id]
    );

    if (!deleteResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка удаления пользователя',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json({
      message: 'Пользователь успешно удален',
      userId: id
    });

  } catch (error) {
    console.error('Ошибка удаления пользователя:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * PUT /api/admin/users/:id
 * Обновить данные пользователя (переименование и другие изменения)
 * Только для администратора
 * 
 * Body:
 * - displayName: string (новое имя пользователя)
 * - theme: string (тема оформления)
 * - isBlocked: boolean (статус блокировки)
 * - reason: string (опционально, причина переименования)
 */
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, theme, isBlocked, reason } = req.body;

    // Проверяем, существует ли пользователь и получаем старое имя
    const userCheck = await executeQuery(
      'SELECT id, display_name FROM users WHERE id = ?',
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

    const oldDisplayName = userCheck.data[0].display_name;

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

    if (isBlocked !== undefined) {
      updates.push('is_blocked = ?');
      params.push(isBlocked ? 1 : 0);
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
        error: 'Ошибка обновления пользователя',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем обновленные данные пользователя
    const updatedUserResult = await executeQuery(
      'SELECT id, telegram_username, display_name, avatar_url, is_admin, is_blocked, theme, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );

    const updatedUser = updatedUserResult.data[0];

    res.json({
      id: updatedUser.id,
      telegramUsername: updatedUser.telegram_username,
      displayName: updatedUser.display_name,
      avatarUrl: updatedUser.avatar_url,
      isAdmin: Boolean(updatedUser.is_admin),
      isBlocked: Boolean(updatedUser.is_blocked),
      theme: updatedUser.theme,
      createdAt: updatedUser.created_at,
      updatedAt: updatedUser.updated_at
    });

    // Если имя было изменено, отправляем уведомление в Telegram (не блокируем ответ)
    if (displayName !== undefined && displayName !== oldDisplayName) {
      const { sendRenameNotification } = await import('../services/notificationService.js');
      sendRenameNotification(id, oldDisplayName, displayName, reason).catch(err => {
        console.error('Ошибка отправки уведомления о переименовании:', err);
      });
    }

  } catch (error) {
    console.error('Ошибка обновления пользователя:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/admin/users/:id/block
 * Заблокировать/разблокировать пользователя
 * Только для администратора
 * 
 * Body:
 * - blocked: boolean (true для блокировки, false для разблокировки)
 */
router.post('/users/:id/block', async (req, res) => {
  try {
    const { id } = req.params;
    const { blocked } = req.body;

    if (typeof blocked !== 'boolean') {
      return res.status(400).json({ 
        error: 'Параметр blocked должен быть boolean',
        code: 'INVALID_PARAMETER' 
      });
    }

    // Проверяем, что админ не пытается заблокировать самого себя
    if (req.user.id === id && blocked) {
      return res.status(400).json({ 
        error: 'Нельзя заблокировать самого себя',
        code: 'CANNOT_BLOCK_SELF' 
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

    // Обновляем статус блокировки
    const updateResult = await executeQuery(
      'UPDATE users SET is_blocked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [blocked ? 1 : 0, id]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка обновления статуса блокировки',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json({
      message: blocked ? 'Пользователь заблокирован' : 'Пользователь разблокирован',
      userId: id,
      blocked
    });

  } catch (error) {
    console.error('Ошибка блокировки пользователя:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/admin/announcements
 * Создать объявление для всех пользователей
 * Только для администратора
 * 
 * Body (multipart/form-data):
 * - content: string (текст объявления)
 * - images: files (опционально, до 5 изображений для объявления)
 */
router.post('/announcements', uploadAnnouncement.array('images', 5), async (req, res) => {
  try {
    const { content } = req.body;

    // Проверяем, что есть хотя бы контент или изображения
    if ((!content || content.trim().length === 0) && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ 
        error: 'Необходимо добавить текст или изображения',
        code: 'EMPTY_ANNOUNCEMENT' 
      });
    }

    // Создаем объявление
    const { v4: uuidv4 } = await import('uuid');
    const announcementId = uuidv4();
    
    // Формируем массив URL изображений, если файлы были загружены
    const imageUrls = req.files && req.files.length > 0 
      ? req.files.map(file => `/uploads/announcements/${file.filename}`)
      : [];

    // Сохраняем первое изображение в поле image_url для обратной совместимости
    const imageUrl = imageUrls.length > 0 ? imageUrls[0] : null;

    // Используем пробел если контента нет, но есть изображения
    const announcementContent = content && content.trim().length > 0 ? content : ' ';

    const insertAnnouncementResult = await executeQuery(
      `INSERT INTO announcements (id, content, image_url, created_by, created_at) 
       VALUES (?, ?, ?, ?, datetime('now', 'localtime'))`,
      [announcementId, announcementContent, imageUrl, req.user.id]
    );

    if (!insertAnnouncementResult.success) {
      // Удаляем загруженные файлы в случае ошибки
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          await fs.unlink(file.path).catch(() => {});
        }
      }
      return res.status(500).json({ 
        error: 'Ошибка создания объявления',
        code: 'DATABASE_ERROR' 
      });
    }

    // Сохраняем все изображения в таблицу announcement_images
    if (imageUrls.length > 0) {
      for (const imageUrl of imageUrls) {
        const imageId = uuidv4();
        await executeQuery(
          'INSERT INTO announcement_images (id, announcement_id, image_path) VALUES (?, ?, ?)',
          [imageId, announcementId, imageUrl]
        );
      }
    }

    const usersResult = await executeQuery(
      'SELECT id FROM users WHERE is_blocked = 0'
    );

    if (usersResult.success && usersResult.data.length > 0) {
      // Создаем пост на стене каждого пользователя
      const postContent = announcementContent.trim().length > 0 
        ? `📢 Объявление администратора:\n\n${announcementContent}\n\n[announcement_id:${announcementId}]`
        : `📢 Объявление администратора\n\n[announcement_id:${announcementId}]`;
      
      // Преобразуем массив URL в JSON строку для хранения в БД
      const imageUrlsJson = imageUrls.length > 0 ? JSON.stringify(imageUrls) : null;
      
      console.log(`📝 Создаём посты объявления ${announcementId} для ${usersResult.data.length} пользователей`);
      
      for (const user of usersResult.data) {
        const postId = uuidv4();
        const insertResult = await executeQuery(
          `INSERT INTO wall_posts (id, user_id, wall_owner_id, post_type, content, image_urls, created_at)
           VALUES (?, ?, ?, 'announcement', ?, ?, datetime('now', 'localtime'))`,
          [postId, user.id, user.id, postContent, imageUrlsJson]
        );
        
        if (!insertResult.success) {
          console.error(`❌ Ошибка создания поста для пользователя ${user.id}:`, insertResult.error);
        } else {
          console.log(`✅ Пост создан для пользователя ${user.id}, wall_owner_id: ${user.id}`);
        }
      }
      
      console.log(`✅ Создано постов: ${usersResult.data.length}`);
    }

    res.status(201).json({
      id: announcementId,
      content,
      imageUrls,
      createdBy: req.user.id,
      postsCreated: usersResult.success ? usersResult.data.length : 0,
      message: 'Объявление создано и опубликовано на стенах всех пользователей'
    });

  } catch (error) {
    // Удаляем загруженные файлы в случае ошибки
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await fs.unlink(file.path).catch(() => {});
      }
    }
    console.error('Ошибка создания объявления:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/admin/backup
 * Создать резервную копию базы данных
 * Только для администратора
 */
router.post('/backup', async (req, res) => {
  try {
    const dbPath = process.env.NODE_ENV === 'test' 
      ? path.join(__dirname, '../../test-rebel.db')
      : path.join(__dirname, '../../rebel.db');

    const backupDir = path.join(__dirname, '../../backups');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `rebel-backup-${timestamp}.db`);

    // Создаем директорию для бэкапов если её нет
    try {
      await fs.mkdir(backupDir, { recursive: true });
    } catch (err) {
      // Директория уже существует
    }

    // Копируем файл базы данных
    await fs.copyFile(dbPath, backupPath);

    res.json({
      message: 'Резервная копия успешно создана',
      backupPath: path.basename(backupPath),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Ошибка создания резервной копии:', error);
    res.status(500).json({ 
      error: 'Ошибка создания резервной копии',
      code: 'BACKUP_ERROR',
      details: error.message
    });
  }
});

/**
 * POST /api/admin/users/:id/ban-posts
 * Запретить пользователю создавать посты на определенное время
 * Только для администратора
 * 
 * Body:
 * - reason: string (причина блокировки)
 * - durationMinutes: number (длительность блокировки в минутах)
 */
router.post('/users/:id/ban-posts', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, durationMinutes } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Необходимо указать причину блокировки',
        code: 'REASON_REQUIRED' 
      });
    }

    if (!durationMinutes || durationMinutes <= 0) {
      return res.status(400).json({ 
        error: 'Необходимо указать длительность блокировки',
        code: 'DURATION_REQUIRED' 
      });
    }

    // Проверяем, существует ли пользователь
    const userCheck = await executeQuery(
      'SELECT id, display_name FROM users WHERE id = ?',
      [id]
    );

    if (!userCheck.success || userCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND' 
      });
    }

    // Вычисляем время окончания блокировки
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    // Обновляем пользователя
    const updateResult = await executeQuery(
      'UPDATE users SET ban_reason = ?, post_ban_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [reason, expiresAt.toISOString(), id]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка обновления пользователя',
        code: 'DATABASE_ERROR' 
      });
    }

    // Создаем запись о действии модерации
    const { v4: uuidv4 } = await import('uuid');
    const actionId = uuidv4();

    await executeQuery(
      `INSERT INTO moderation_actions (id, user_id, admin_id, action_type, reason, duration_minutes, expires_at)
       VALUES (?, ?, ?, 'post_ban', ?, ?, ?)`,
      [actionId, id, req.user.id, reason, durationMinutes, expiresAt.toISOString()]
    );

    res.json({
      success: true,
      action: {
        id: actionId,
        userId: id,
        actionType: 'post_ban',
        reason,
        durationMinutes,
        expiresAt: expiresAt.toISOString()
      }
    });

    // Отправляем уведомление в Telegram (не блокируем ответ)
    notifyModeration(id, 'post_ban', {
      reason,
      durationMinutes,
      expiresAt: expiresAt.toISOString()
    }).catch(err => {
      console.error('Ошибка отправки уведомления о блокировке постов:', err);
    });

  } catch (error) {
    console.error('Ошибка блокировки постов:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/admin/users/:id/ban-permanent
 * Постоянно заблокировать пользователя
 * Только для администратора
 * 
 * Body:
 * - reason: string (причина блокировки)
 */
router.post('/users/:id/ban-permanent', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Необходимо указать причину блокировки',
        code: 'REASON_REQUIRED' 
      });
    }

    // Проверяем, что админ не пытается заблокировать самого себя
    if (req.user.id === id) {
      return res.status(400).json({ 
        error: 'Нельзя заблокировать самого себя',
        code: 'CANNOT_BLOCK_SELF' 
      });
    }

    // Проверяем, существует ли пользователь
    const userCheck = await executeQuery(
      'SELECT id, display_name FROM users WHERE id = ?',
      [id]
    );

    if (!userCheck.success || userCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND' 
      });
    }

    // Обновляем пользователя
    const updateResult = await executeQuery(
      'UPDATE users SET is_blocked = 1, ban_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [reason, id]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка обновления пользователя',
        code: 'DATABASE_ERROR' 
      });
    }

    // Создаем запись о действии модерации
    const { v4: uuidv4 } = await import('uuid');
    const actionId = uuidv4();

    await executeQuery(
      `INSERT INTO moderation_actions (id, user_id, admin_id, action_type, reason)
       VALUES (?, ?, ?, 'permanent_ban', ?)`,
      [actionId, id, req.user.id, reason]
    );

    res.json({
      success: true,
      action: {
        id: actionId,
        userId: id,
        actionType: 'permanent_ban',
        reason
      }
    });

    // Отправляем уведомление в Telegram (не блокируем ответ)
    notifyModeration(id, 'permanent_ban', {
      reason
    }).catch(err => {
      console.error('Ошибка отправки уведомления о постоянной блокировке:', err);
    });

  } catch (error) {
    console.error('Ошибка постоянной блокировки:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/admin/users/:id/unban
 * Разблокировать пользователя (снять все ограничения)
 * Только для администратора
 */
router.post('/users/:id/unban', async (req, res) => {
  try {
    const { id } = req.params;

    // Проверяем, существует ли пользователь
    const userCheck = await executeQuery(
      'SELECT id, display_name FROM users WHERE id = ?',
      [id]
    );

    if (!userCheck.success || userCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND' 
      });
    }

    // Снимаем все ограничения
    const updateResult = await executeQuery(
      'UPDATE users SET is_blocked = 0, ban_reason = NULL, post_ban_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка обновления пользователя',
        code: 'DATABASE_ERROR' 
      });
    }

    // Деактивируем все активные действия модерации
    await executeQuery(
      'UPDATE moderation_actions SET is_active = 0 WHERE user_id = ? AND is_active = 1',
      [id]
    );

    // Создаем запись о разбане
    const { v4: uuidv4 } = await import('uuid');
    const actionId = uuidv4();

    await executeQuery(
      `INSERT INTO moderation_actions (id, user_id, admin_id, action_type)
       VALUES (?, ?, ?, 'unban')`,
      [actionId, id, req.user.id]
    );

    res.json({
      success: true,
      message: 'Пользователь разблокирован',
      userId: id
    });

    // Отправляем уведомление в Telegram (не блокируем ответ)
    notifyModeration(id, 'unban').catch(err => {
      console.error('Ошибка отправки уведомления о разблокировке:', err);
    });

  } catch (error) {
    console.error('Ошибка разблокировки:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/admin/users/:id/moderation
 * Получить историю модерации пользователя
 * Только для администратора
 */
router.get('/users/:id/moderation', async (req, res) => {
  try {
    const { id } = req.params;

    // Проверяем, существует ли пользователь
    const userCheck = await executeQuery(
      'SELECT id FROM users WHERE id = ?',
      [id]
    );

    if (!userCheck.success || userCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND' 
      });
    }

    // Получаем историю модерации
    const actionsResult = await executeQuery(
      `SELECT ma.*, u.display_name as admin_name
       FROM moderation_actions ma
       LEFT JOIN users u ON ma.admin_id = u.id
       WHERE ma.user_id = ?
       ORDER BY ma.created_at DESC`,
      [id]
    );

    if (!actionsResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения истории модерации',
        code: 'DATABASE_ERROR' 
      });
    }

    const actions = actionsResult.data.map(action => ({
      id: action.id,
      userId: action.user_id,
      adminId: action.admin_id,
      adminName: action.admin_name,
      actionType: action.action_type,
      reason: action.reason,
      durationMinutes: action.duration_minutes,
      createdAt: action.created_at,
      expiresAt: action.expires_at,
      isActive: Boolean(action.is_active)
    }));

    res.json(actions);

  } catch (error) {
    console.error('Ошибка получения истории модерации:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/admin/announcements
 * Получить все объявления с изображениями
 * Только для администратора
 */
router.get('/announcements', async (req, res) => {
  try {
    const announcementsResult = await executeQuery(
      `SELECT a.*, u.display_name as creator_name
       FROM announcements a
       LEFT JOIN users u ON a.created_by = u.id
       ORDER BY a.created_at DESC`
    );

    if (!announcementsResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения объявлений',
        code: 'DATABASE_ERROR' 
      });
    }

    // Для каждого объявления получаем изображения
    const announcements = [];
    for (const announcement of announcementsResult.data) {
      const imagesResult = await executeQuery(
        'SELECT image_path FROM announcement_images WHERE announcement_id = ? ORDER BY created_at',
        [announcement.id]
      );

      const imageUrls = imagesResult.success && imagesResult.data.length > 0
        ? imagesResult.data.map(img => img.image_path)
        : (announcement.image_url ? [announcement.image_url] : []);

      announcements.push({
        id: announcement.id,
        content: announcement.content,
        imageUrl: announcement.image_url, // Для обратной совместимости
        imageUrls, // Массив всех изображений
        createdBy: announcement.created_by,
        creatorName: announcement.creator_name,
        createdAt: announcement.created_at
      });
    }

    res.json(announcements);

  } catch (error) {
    console.error('Ошибка получения объявлений:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * DELETE /api/admin/announcements/:id
 * Удалить объявление и все связанные изображения
 * Только для администратора
 */
router.delete('/announcements/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Проверяем, существует ли объявление и получаем путь к изображению
    const announcementCheck = await executeQuery(
      'SELECT id, image_url FROM announcements WHERE id = ?',
      [id]
    );

    if (!announcementCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки объявления',
        code: 'DATABASE_ERROR' 
      });
    }

    if (announcementCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Объявление не найдено',
        code: 'ANNOUNCEMENT_NOT_FOUND' 
      });
    }

    const announcement = announcementCheck.data[0];

    // Получаем все изображения объявления
    const imagesResult = await executeQuery(
      'SELECT image_path FROM announcement_images WHERE announcement_id = ?',
      [id]
    );

    // Удаляем связанные посты на стене
    console.log(`🔍 Ищем посты для удаления с announcement_id:${id}`);
    
    const deletePostsResult = await executeQuery(
      `DELETE FROM wall_posts 
       WHERE post_type = 'announcement' 
       AND content LIKE ?`,
      [`%[announcement_id:${id}]%`]
    );

    console.log(`🗑️ Удалено постов объявления ${id}:`, deletePostsResult.changes || 0);

    // Удаляем объявление (каскадно удалятся записи из announcement_images)
    const deleteResult = await executeQuery(
      'DELETE FROM announcements WHERE id = ?',
      [id]
    );

    if (!deleteResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка удаления объявления',
        code: 'DATABASE_ERROR' 
      });
    }

    // Удаляем все файлы изображений
    if (imagesResult.success && imagesResult.data.length > 0) {
      for (const image of imagesResult.data) {
        const imagePath = path.join(__dirname, '../..', image.image_path);
        await fs.unlink(imagePath).catch((err) => {
          console.error('Ошибка удаления файла изображения:', err);
        });
      }
    }

    // Удаляем старое изображение из поля image_url (для обратной совместимости)
    if (announcement.image_url) {
      const imagePath = path.join(__dirname, '../..', announcement.image_url);
      await fs.unlink(imagePath).catch((err) => {
        console.error('Ошибка удаления файла изображения:', err);
      });
    }

    res.json({
      message: 'Объявление успешно удалено',
      announcementId: id
    });

  } catch (error) {
    console.error('Ошибка удаления объявления:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/admin/telegram-announcement
 * Отправить объявление/рекламу всем пользователям в Telegram
 * 
 * Body:
 * - content: string (текст)
 * - imageUrl: string (опционально, URL изображения)
 * - type: 'announcement' | 'advertising' (тип — объявление или реклама)
 */
router.post('/telegram-announcement', async (req, res) => {
  try {
    const { content, imageUrl, type } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Содержание не может быть пустым',
        code: 'EMPTY_CONTENT' 
      });
    }

    // Формируем сообщение с заголовком
    const header = type === 'advertising' ? '📣 *Реклама*' : '📢 *Объявление*';
    const fullMessage = `${header}\n\n${content.trim()}`;

    // Получаем всех пользователей
    const usersResult = await executeQuery(
      'SELECT id FROM users WHERE is_blocked = 0'
    );

    if (!usersResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения списка пользователей',
        code: 'DATABASE_ERROR' 
      });
    }

    const users = usersResult.data;
    let successCount = 0;
    let failCount = 0;
    const errors = [];

    const publicUrl = process.env.PUBLIC_URL || 'http://localhost:1313';
    const fullImageUrl = imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `${publicUrl}${imageUrl}`) : null;

    // Отправляем каждому пользователю
    for (const user of users) {
      try {
        const { checkNotificationEnabled } = await import('../services/notificationService.js');
        const isEnabled = await checkNotificationEnabled(user.id, 'admin_announcement');
        if (!isEnabled) continue;

        if (fullImageUrl) {
          await sendTelegramNotification(user.id, fullMessage, {
            parse_mode: 'MarkdownV2',
            photo: fullImageUrl
          });
        } else {
          await notifyModeration(user.id, 'announcement', {
            content: fullMessage
          });
        }
        successCount++;
      } catch (err) {
        failCount++;
        errors.push({ userId: user.id, error: err.message });
        console.error(`Ошибка отправки пользователю ${user.id}:`, err);
      }
    }

    res.json({
      message: 'Рассылка завершена',
      total: users.length,
      success: successCount,
      failed: failCount,
      errors: errors.length > 0 ? errors : undefined
    });

    // Сохраняем в историю отправленных постов
    const { v4: uuidv4 } = await import('uuid');
    await executeQuery(
      `INSERT INTO sent_posts (id, content, image_url, type, channel, sent_to, created_by, created_at)
       VALUES (?, ?, ?, ?, 'telegram', ?, ?, datetime('now', 'localtime'))`,
      [uuidv4(), content.trim(), fullImageUrl || null, type || 'announcement', successCount, req.user.id]
    );

  } catch (error) {
    console.error('Ошибка отправки в Telegram:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/admin/telegram-announcement-self
 * Отправить объявление/рекламу только текущему админу (для проверки)
 * 
 * Body:
 * - content: string (текст)
 * - imageUrl: string (опционально)
 * - type: 'announcement' | 'advertising'
 */
router.post('/telegram-announcement-self', async (req, res) => {
  try {
    const { content, imageUrl, type } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Содержание не может быть пустым',
        code: 'EMPTY_CONTENT' 
      });
    }

    const header = type === 'advertising' ? '📣 *Реклама*' : '📢 *Объявление*';
    const fullMessage = `${header}\n\n${content.trim()}`;

    const publicUrl = process.env.PUBLIC_URL || 'http://localhost:1313';
    const fullImageUrl = imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `${publicUrl}${imageUrl}`) : null;

    if (fullImageUrl) {
      await sendTelegramNotification(req.user.id, fullMessage, {
        parse_mode: 'MarkdownV2',
        photo: fullImageUrl
      });
    } else {
      await notifyModeration(req.user.id, 'announcement', {
        content: fullMessage
      });
    }

    res.json({
      message: 'Отправлено вам в Telegram',
      success: true
    });

  } catch (error) {
    console.error('Ошибка отправки:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

// ==========================================
// Управление базой данных
// ==========================================

function getDbPath() {
  return process.env.NODE_ENV === 'test'
    ? path.join(__dirname, '../../test-rebel.db')
    : path.join(__dirname, '../../rebel.db');
}

function getBackupDir() {
  return path.join(__dirname, '../../backups');
}

/**
 * POST /api/admin/database/backup
 * Создать резервную копию базы данных
 */
router.post('/database/backup', async (req, res) => {
  try {
    const dbPath = getDbPath();
    const backupDir = getBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `rebel-backup-${timestamp}.db`);

    await fs.mkdir(backupDir, { recursive: true });
    await fs.copyFile(dbPath, backupPath);

    const stats = await fs.stat(backupPath);

    res.json({
      message: 'Резервная копия успешно создана',
      backup: {
        filename: path.basename(backupPath),
        size: stats.size,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Ошибка создания резервной копии:', error);
    res.status(500).json({ error: 'Ошибка создания резервной копии' });
  }
});

/**
 * GET /api/admin/database/backups
 * Получить список всех резервных копий
 */
router.get('/database/backups', async (req, res) => {
  try {
    const backupDir = getBackupDir();

    try {
      await fs.access(backupDir);
    } catch {
      return res.json({ backups: [] });
    }

    const files = await fs.readdir(backupDir);
    const dbFiles = files.filter(f => f.endsWith('.db'));

    const backups = await Promise.all(
      dbFiles.map(async (filename) => {
        const filePath = path.join(backupDir, filename);
        const stats = await fs.stat(filePath);
        return {
          filename,
          size: stats.size,
          createdAt: stats.birthtime.toISOString()
        };
      })
    );

    backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ backups });
  } catch (error) {
    console.error('Ошибка получения списка бэкапов:', error);
    res.status(500).json({ error: 'Ошибка получения списка резервных копий' });
  }
});

/**
 * POST /api/admin/database/restore
 * Восстановить базу данных из резервной копии
 */
router.post('/database/restore', async (req, res) => {
  try {
    const { filename } = req.body;

    if (!filename || !filename.match(/^rebel-backup-[\w-]+\.db$/)) {
      return res.status(400).json({ error: 'Неверное имя файла' });
    }

    const backupDir = getBackupDir();
    const backupPath = path.join(backupDir, filename);
    const dbPath = getDbPath();

    try {
      await fs.access(backupPath);
    } catch {
      return res.status(404).json({ error: 'Резервная копия не найдена' });
    }

    const backupContent = await fs.readFile(backupPath);
    await fs.writeFile(dbPath, backupContent);

    res.json({ message: 'База данных успешно восстановлена' });
  } catch (error) {
    console.error('Ошибка восстановления БД:', error);
    res.status(500).json({ error: 'Ошибка восстановления базы данных' });
  }
});

/**
 * DELETE /api/admin/database/backups/:filename
 * Удалить резервную копию
 */
router.delete('/database/backups/:filename', async (req, res) => {
  try {
    const { filename } = req.params;

    if (!filename || !filename.match(/^rebel-backup-[\w-]+\.db$/)) {
      return res.status(400).json({ error: 'Неверное имя файла' });
    }

    const backupDir = getBackupDir();
    const backupPath = path.join(backupDir, filename);

    try {
      await fs.access(backupPath);
    } catch {
      return res.status(404).json({ error: 'Резервная копия не найдена' });
    }

    await fs.unlink(backupPath);

    res.json({ message: 'Резервная копия удалена' });
  } catch (error) {
    console.error('Ошибка удаления бэкапа:', error);
    res.status(500).json({ error: 'Ошибка удаления резервной копии' });
  }
});

/**
 * GET /api/admin/database/stats
 * Получить статистику базы данных
 */
router.get('/database/stats', async (req, res) => {
  try {
    const dbPath = getDbPath();
    const stats = await fs.stat(dbPath);

    const tables = await executeQuery(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );

    const tableStats = [];
    if (tables.success) {
      for (const table of tables.data) {
        const count = await executeQuery(`SELECT COUNT(*) as count FROM ${table.name}`);
        tableStats.push({
          name: table.name,
          count: count.success ? count.data[0].count : 0
        });
      }
    }

    res.json({
      fileSize: stats.size,
      lastModified: stats.mtime.toISOString(),
      tables: tableStats
    });
  } catch (error) {
    console.error('Ошибка получения статистики БД:', error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

export default router;

// ==========================================
// Жалобы
// ==========================================

import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/admin/reports
 * Получить список всех жалоб
 */
router.get('/reports', async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT r.*, 
        reporter.display_name as reporter_name, reporter.avatar_url as reporter_avatar,
        reported.display_name as reported_name, reported.avatar_url as reported_avatar
      FROM reports r
      LEFT JOIN users reporter ON r.reporter_id = reporter.id
      LEFT JOIN users reported ON r.reported_user_id = reported.id
    `;
    const params = [];

    if (status && ['pending', 'reviewed', 'dismissed'].includes(status)) {
      query += ' WHERE r.status = ?';
      params.push(status);
    }

    query += ' ORDER BY r.created_at DESC';

    const result = await executeQuery(query, params);

    if (!result.success) {
      return res.status(500).json({ error: 'Ошибка получения жалоб' });
    }

    res.json({ reports: result.data });
  } catch (error) {
    console.error('Ошибка получения жалоб:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/admin/reports/unread-count
 * Получить количество непрочитанных жалоб
 */
router.get('/reports/unread-count', async (req, res) => {
  try {
    const result = await executeQuery(
      "SELECT COUNT(*) as count FROM reports WHERE status = 'pending'"
    );

    if (!result.success) {
      return res.status(500).json({ error: 'Ошибка получения количества' });
    }

    res.json({ count: result.data[0].count });
  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * PUT /api/admin/reports/:id
 * Обновить статус жалобы
 */
router.put('/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['reviewed', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Неверный статус' });
    }

    const result = await executeQuery(
      'UPDATE reports SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?',
      [status, new Date().toISOString(), req.user.id, id]
    );

    if (!result.success) {
      return res.status(500).json({ error: 'Ошибка обновления жалобы' });
    }

    res.json({ message: 'Статус жалобы обновлён' });
  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/admin/advertising/upload
 * Загрузить изображение для рекламного поста
 */
router.post('/advertising/upload', uploadAdvertisingImages.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен', code: 'NO_FILE' });
    }

    const imageUrl = `/uploads/advertising/${req.file.filename}`;
    res.json({ url: imageUrl });
  } catch (error) {
    console.error('Ошибка загрузки изображения:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/admin/advertising
 * Создать рекламный пост на стены всех пользователей
 *
 * Body:
 * - content: string (текст рекламы)
 * - linkUrl: string (опционально, ссылка)
 * - linkLabel: string (опционально, текст ссылки)
 * - imageUrls: string[] (опционально, изображения)
 */
router.post('/advertising', async (req, res) => {
  try {
    const { content, linkUrl, linkLabel, imageUrls } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Текст обязателен', code: 'EMPTY_CONTENT' });
    }

    const { v4: uuidv4 } = await import('uuid');
    const postId = uuidv4();

    // Сохраняем рекламный пост
    const result = await executeQuery(
      `INSERT INTO advertising_posts (id, content, link_url, link_label, image_urls, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
      [postId, content.trim(), linkUrl || null, linkLabel || null, JSON.stringify(imageUrls || []), req.user.id]
    );

    if (!result.success) {
      return res.status(500).json({ error: 'Ошибка создания рекламного поста', code: 'DATABASE_ERROR' });
    }

    // Сохраняем в историю
    const firstImage = (imageUrls && imageUrls.length > 0) ? imageUrls[0] : null;
    await executeQuery(
      `INSERT INTO sent_posts (id, content, image_url, type, channel, sent_to, created_by, created_at)
       VALUES (?, ?, ?, 'advertising', 'site', 0, ?, datetime('now', 'localtime'))`,
      [uuidv4(), content.trim(), firstImage, req.user.id]
    );

    res.status(201).json({ id: postId, message: 'Рекламный пост создан' });
  } catch (error) {
    console.error('Ошибка создания рекламного поста:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/admin/advertising
 * Получить все рекламные посты
 */
router.get('/advertising', async (req, res) => {
  try {
    const result = await executeQuery(
      `SELECT ap.*, u.display_name as creator_name
       FROM advertising_posts ap
       LEFT JOIN users u ON ap.created_by = u.id
       ORDER BY ap.created_at DESC`
    );

    if (!result.success) {
      return res.status(500).json({ error: 'Ошибка получения рекламных постов' });
    }

    const posts = result.data.map(p => ({
      id: p.id,
      content: p.content,
      linkUrl: p.link_url,
      linkLabel: p.link_label,
      imageUrls: p.image_urls ? JSON.parse(p.image_urls) : [],
      createdBy: p.created_by,
      creatorName: p.creator_name,
      createdAt: p.created_at
    }));

    res.json(posts);
  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * DELETE /api/admin/advertising/:id
 * Удалить рекламный пост
 */
router.delete('/advertising/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await executeQuery('DELETE FROM advertising_posts WHERE id = ?', [id]);
    if (!result.success) {
      return res.status(500).json({ error: 'Ошибка удаления' });
    }
    res.json({ message: 'Рекламный пост удалён' });
  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/admin/sent-posts
 * Получить историю отправленных постов (ТГ + сайт)
 * Query: type=announcement|advertising, channel=telegram|site
 */
router.get('/sent-posts', async (req, res) => {
  try {
    const { type, channel } = req.query;
    let where = [];
    let params = [];

    if (type) { where.push('sp.type = ?'); params.push(type); }
    if (channel) { where.push('sp.channel = ?'); params.push(channel); }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const result = await executeQuery(
      `SELECT sp.*, u.display_name as creator_name
       FROM sent_posts sp
       LEFT JOIN users u ON sp.created_by = u.id
       ${whereClause}
       ORDER BY sp.created_at DESC
       LIMIT 50`,
      params
    );

    if (!result.success) {
      return res.status(500).json({ error: 'Ошибка получения истории' });
    }

    res.json(result.data.map(p => ({
      id: p.id,
      content: p.content,
      imageUrl: p.image_url,
      type: p.type,
      channel: p.channel,
      sentTo: p.sent_to,
      createdBy: p.created_by,
      creatorName: p.creator_name,
      createdAt: p.created_at
    })));
  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * DELETE /api/admin/sent-posts/:id
 * Удалить запись из истории
 */
router.delete('/sent-posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await executeQuery('DELETE FROM sent_posts WHERE id = ?', [id]);
    res.json({ message: 'Запись удалена' });
  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * DELETE /api/admin/reports/:id
 * Удалить жалобу
 */
router.delete('/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await executeQuery('DELETE FROM reports WHERE id = ?', [id]);

    if (!result.success) {
      return res.status(500).json({ error: 'Ошибка удаления жалобы' });
    }

    res.json({ message: 'Жалоба удалена' });
  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
