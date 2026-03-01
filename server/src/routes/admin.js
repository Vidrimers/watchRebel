import express from 'express';
import { executeQuery } from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { notifyModeration } from '../services/notificationService.js';
import { uploadAnnouncement } from '../middleware/upload.js';
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
 * - image: file (опционально, изображение для объявления)
 */
router.post('/announcements', uploadAnnouncement.single('image'), async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      // Удаляем загруженный файл, если контент пустой
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      return res.status(400).json({ 
        error: 'Содержание объявления не может быть пустым',
        code: 'EMPTY_CONTENT' 
      });
    }

    // Создаем объявление
    const { v4: uuidv4 } = await import('uuid');
    const announcementId = uuidv4();
    
    // Формируем URL изображения, если файл был загружен
    const imageUrl = req.file ? `/uploads/announcements/${req.file.filename}` : null;

    const insertAnnouncementResult = await executeQuery(
      'INSERT INTO announcements (id, content, image_url, created_by) VALUES (?, ?, ?, ?)',
      [announcementId, content, imageUrl, req.user.id]
    );

    if (!insertAnnouncementResult.success) {
      // Удаляем загруженный файл в случае ошибки
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      return res.status(500).json({ 
        error: 'Ошибка создания объявления',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем всех пользователей
    const usersResult = await executeQuery(
      'SELECT id FROM users WHERE is_blocked = 0'
    );

    let notificationsSent = 0;
    let notificationsSkipped = 0;

    if (usersResult.success && usersResult.data.length > 0) {
      // Создаем пост на стене каждого пользователя
      const announcementContent = `📢 Объявление администратора:\n\n${content}\n\n[announcement_id:${announcementId}]`;
      
      for (const user of usersResult.data) {
        const postId = uuidv4();
        await executeQuery(
          `INSERT INTO wall_posts (id, user_id, post_type, content)
           VALUES (?, ?, 'text', ?)`,
          [postId, user.id, announcementContent]
        );

        // Отправляем уведомление в Telegram
        const notificationResult = await notifyModeration(user.id, 'announcement', { content });
        if (notificationResult.success) {
          if (notificationResult.skipped) {
            notificationsSkipped++;
          } else {
            notificationsSent++;
          }
        }
      }
    }

    res.status(201).json({
      id: announcementId,
      content,
      imageUrl,
      createdBy: req.user.id,
      postsCreated: usersResult.success ? usersResult.data.length : 0,
      notificationsSent,
      notificationsSkipped,
      message: 'Объявление создано и опубликовано на стенах всех пользователей'
    });

  } catch (error) {
    // Удаляем загруженный файл в случае ошибки
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
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
 * Получить все объявления
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

    const announcements = announcementsResult.data.map(announcement => ({
      id: announcement.id,
      content: announcement.content,
      imageUrl: announcement.image_url,
      createdBy: announcement.created_by,
      creatorName: announcement.creator_name,
      createdAt: announcement.created_at
    }));

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
 * Удалить объявление
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

    // Удаляем связанные посты на стене
    await executeQuery(
      `DELETE FROM wall_posts 
       WHERE post_type = 'text' 
       AND (content LIKE ? OR content LIKE ?)`,
      [`%announcement_id:${id}%`, `📢 Объявление администратора:%`]
    );

    // Удаляем объявление
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

    // Удаляем файл изображения, если он существует
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
 * Отправить объявление всем пользователям в Telegram
 * Только для администратора
 * 
 * Body:
 * - content: string (текст объявления)
 */
router.post('/telegram-announcement', async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Содержание объявления не может быть пустым',
        code: 'EMPTY_CONTENT' 
      });
    }

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

    // Отправляем объявление каждому пользователю
    for (const user of users) {
      try {
        await notifyModeration(user.id, 'announcement', {
          content: content.trim()
        });
        successCount++;
      } catch (err) {
        failCount++;
        errors.push({
          userId: user.id,
          error: err.message
        });
        console.error(`Ошибка отправки объявления пользователю ${user.id}:`, err);
      }
    }

    res.json({
      message: 'Рассылка завершена',
      total: users.length,
      success: successCount,
      failed: failCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Ошибка отправки объявления в Telegram:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

export default router;
