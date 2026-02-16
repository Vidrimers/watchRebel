import express from 'express';
import { executeQuery } from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
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
 */
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, theme, isBlocked } = req.body;

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
 * Body:
 * - content: string (текст объявления)
 */
router.post('/announcements', async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Содержание объявления не может быть пустым',
        code: 'EMPTY_CONTENT' 
      });
    }

    // Создаем объявление
    const { v4: uuidv4 } = await import('uuid');
    const announcementId = uuidv4();

    const insertAnnouncementResult = await executeQuery(
      'INSERT INTO announcements (id, content, created_by) VALUES (?, ?, ?)',
      [announcementId, content, req.user.id]
    );

    if (!insertAnnouncementResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка создания объявления',
        code: 'DATABASE_ERROR' 
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

    // Создаем wall post для каждого пользователя
    const wallPostPromises = usersResult.data.map(async (user) => {
      const postId = uuidv4();
      return executeQuery(
        `INSERT INTO wall_posts (id, user_id, post_type, content) 
         VALUES (?, ?, 'text', ?)`,
        [postId, user.id, `📢 Объявление администратора:\n\n${content}`]
      );
    });

    await Promise.all(wallPostPromises);

    res.status(201).json({
      id: announcementId,
      content,
      createdBy: req.user.id,
      message: 'Объявление создано и отправлено всем пользователям'
    });

  } catch (error) {
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

export default router;
