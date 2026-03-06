import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { uploadBugReportImages } from '../middleware/upload.js';

const router = express.Router();

/**
 * POST /api/bug-reports/upload-images
 * Загрузить изображения для багрепорта
 * Возвращает массив путей к загруженным изображениям
 */
router.post('/upload-images', authenticateToken, uploadBugReportImages.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        error: 'Изображения не загружены',
        code: 'NO_IMAGES' 
      });
    }

    // Возвращаем пути к загруженным изображениям
    const imagePaths = req.files.map(file => `/uploads/bug-reports/${file.filename}`);

    res.json({
      images: imagePaths,
      message: `Загружено ${imagePaths.length} изображений`
    });

  } catch (error) {
    console.error('Ошибка загрузки изображений багрепорта:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/bug-reports
 * Создать багрепорт
 * 
 * Body:
 * - title: string (обязательно)
 * - description: string (обязательно)
 * - images: array of image paths (опционально, максимум 5)
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, description, images } = req.body;

    // Валидация title
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Заголовок обязателен',
        code: 'MISSING_TITLE' 
      });
    }

    // Валидация description
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Описание обязательно',
        code: 'MISSING_DESCRIPTION' 
      });
    }

    // Валидация images
    if (images && (!Array.isArray(images) || images.length > 5)) {
      return res.status(400).json({ 
        error: 'Максимум 5 изображений',
        code: 'TOO_MANY_IMAGES' 
      });
    }

    // Создаем багрепорт
    const bugReportId = uuidv4();
    const insertResult = await executeQuery(
      `INSERT INTO bug_reports (id, user_id, title, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'new', datetime('now', 'localtime'), datetime('now', 'localtime'))`,
      [bugReportId, userId, title.trim(), description.trim()]
    );

    if (!insertResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка создания багрепорта',
        code: 'DATABASE_ERROR' 
      });
    }

    // Сохраняем изображения если есть
    if (images && images.length > 0) {
      for (const imagePath of images) {
        const imageId = uuidv4();
        await executeQuery(
          `INSERT INTO bug_report_images (id, bug_report_id, image_path, created_at)
           VALUES (?, ?, ?, datetime('now', 'localtime'))`,
          [imageId, bugReportId, imagePath]
        );
      }
    }

    // Получаем созданный багрепорт с изображениями
    const bugReportResult = await executeQuery(
      `SELECT br.*, u.display_name as user_name, u.avatar_url as user_avatar
       FROM bug_reports br
       LEFT JOIN users u ON br.user_id = u.id
       WHERE br.id = ?`,
      [bugReportId]
    );

    const imagesResult = await executeQuery(
      `SELECT id, image_path FROM bug_report_images WHERE bug_report_id = ?`,
      [bugReportId]
    );

    const bugReport = bugReportResult.data[0];
    const bugReportImages = imagesResult.success ? imagesResult.data : [];

    // Отправляем уведомление админу о новом багрепорте
    const { notifyAdminNewBugReport } = await import('../services/notificationService.js');
    notifyAdminNewBugReport(bugReportId, bugReport.title, userId).catch(err => {
      console.error('Ошибка отправки уведомления админу о новом багрепорте:', err);
    });

    res.status(201).json({
      bugReport: {
        id: bugReport.id,
        userId: bugReport.user_id,
        userName: bugReport.user_name,
        userAvatar: bugReport.user_avatar,
        title: bugReport.title,
        description: bugReport.description,
        status: bugReport.status,
        images: bugReportImages,
        created_at: bugReport.created_at,
        updated_at: bugReport.updated_at
      },
      message: 'Багрепорт успешно создан!'
    });

  } catch (error) {
    console.error('Ошибка создания багрепорта:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/bug-reports
 * Получить свои багрепорты
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Получаем багрепорты пользователя
    const bugReportsResult = await executeQuery(
      `SELECT br.*, u.display_name as user_name, u.avatar_url as user_avatar
       FROM bug_reports br
       LEFT JOIN users u ON br.user_id = u.id
       WHERE br.user_id = ?
       ORDER BY br.created_at DESC`,
      [userId]
    );

    if (!bugReportsResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения багрепортов',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем изображения для каждого багрепорта
    const bugReports = await Promise.all(
      bugReportsResult.data.map(async (report) => {
        const imagesResult = await executeQuery(
          `SELECT id, image_path FROM bug_report_images WHERE bug_report_id = ?`,
          [report.id]
        );

        return {
          id: report.id,
          userId: report.user_id,
          userName: report.user_name,
          userAvatar: report.user_avatar,
          title: report.title,
          description: report.description,
          status: report.status,
          images: imagesResult.success ? imagesResult.data : [],
          created_at: report.created_at,
          updated_at: report.updated_at
        };
      })
    );

    res.json({ bugReports });

  } catch (error) {
    console.error('Ошибка получения багрепортов:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/bug-reports/:id
 * Получить детали багрепорта
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.isAdmin || req.user.is_admin;
    const bugReportId = req.params.id;

    // Получаем багрепорт
    const bugReportResult = await executeQuery(
      `SELECT br.*, u.display_name as user_name, u.avatar_url as user_avatar
       FROM bug_reports br
       LEFT JOIN users u ON br.user_id = u.id
       WHERE br.id = ?`,
      [bugReportId]
    );

    if (!bugReportResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения багрепорта',
        code: 'DATABASE_ERROR' 
      });
    }

    if (bugReportResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Багрепорт не найден',
        code: 'NOT_FOUND' 
      });
    }

    const bugReport = bugReportResult.data[0];

    // Проверяем права доступа (только автор или админ)
    if (bugReport.user_id !== userId && !isAdmin) {
      return res.status(403).json({ 
        error: 'Нет доступа к этому багрепорту',
        code: 'FORBIDDEN' 
      });
    }

    // Получаем изображения
    const imagesResult = await executeQuery(
      `SELECT id, image_path FROM bug_report_images WHERE bug_report_id = ?`,
      [bugReportId]
    );

    res.json({
      id: bugReport.id,
      userId: bugReport.user_id,
      userName: bugReport.user_name,
      userAvatar: bugReport.user_avatar,
      title: bugReport.title,
      description: bugReport.description,
      status: bugReport.status,
      images: imagesResult.success ? imagesResult.data : [],
      created_at: bugReport.created_at,
      updated_at: bugReport.updated_at
    });

  } catch (error) {
    console.error('Ошибка получения багрепорта:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/bug-reports/admin/all
 * Получить все багрепорты (только для админа)
 */
router.get('/admin/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Получаем все багрепорты
    const bugReportsResult = await executeQuery(
      `SELECT br.*, u.display_name as user_name, u.avatar_url as user_avatar
       FROM bug_reports br
       LEFT JOIN users u ON br.user_id = u.id
       ORDER BY 
         CASE br.status
           WHEN 'new' THEN 1
           WHEN 'in_progress' THEN 2
           WHEN 'resolved' THEN 3
           WHEN 'rejected' THEN 4
         END,
         br.created_at DESC`
    );

    if (!bugReportsResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения багрепортов',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем изображения для каждого багрепорта
    const bugReports = await Promise.all(
      bugReportsResult.data.map(async (report) => {
        const imagesResult = await executeQuery(
          `SELECT id, image_path FROM bug_report_images WHERE bug_report_id = ?`,
          [report.id]
        );

        return {
          id: report.id,
          userId: report.user_id,
          userName: report.user_name,
          userAvatar: report.user_avatar,
          title: report.title,
          description: report.description,
          status: report.status,
          images: imagesResult.success ? imagesResult.data : [],
          created_at: report.created_at,
          updated_at: report.updated_at
        };
      })
    );

    res.json({ bugReports });

  } catch (error) {
    console.error('Ошибка получения багрепортов:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/bug-reports/admin/stats
 * Получить статистику по багрепортам (только для админа)
 */
router.get('/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Получаем количество багрепортов по статусам
    const statsResult = await executeQuery(
      `SELECT 
         status,
         COUNT(*) as count
       FROM bug_reports
       GROUP BY status`
    );

    if (!statsResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения статистики',
        code: 'DATABASE_ERROR' 
      });
    }

    // Формируем объект статистики
    const stats = {
      new: 0,
      in_progress: 0,
      resolved: 0,
      rejected: 0
    };

    statsResult.data.forEach(row => {
      stats[row.status] = row.count;
    });

    res.json(stats);

  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * PUT /api/bug-reports/admin/:id/status
 * Изменить статус багрепорта (только для админа)
 * 
 * Body:
 * - status: 'new' | 'in_progress' | 'resolved' | 'rejected'
 */
router.put('/admin/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const bugReportId = req.params.id;
    const { status } = req.body;

    // Валидация status
    const validStatuses = ['new', 'in_progress', 'resolved', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Неверный статус. Допустимые значения: new, in_progress, resolved, rejected',
        code: 'INVALID_STATUS' 
      });
    }

    // Проверяем существование багрепорта
    const bugReportResult = await executeQuery(
      `SELECT * FROM bug_reports WHERE id = ?`,
      [bugReportId]
    );

    if (!bugReportResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки багрепорта',
        code: 'DATABASE_ERROR' 
      });
    }

    if (bugReportResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Багрепорт не найден',
        code: 'NOT_FOUND' 
      });
    }

    const bugReport = bugReportResult.data[0];

    // Обновляем статус
    const updateResult = await executeQuery(
      `UPDATE bug_reports 
       SET status = ?, updated_at = datetime('now', 'localtime')
       WHERE id = ?`,
      [status, bugReportId]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка обновления статуса',
        code: 'DATABASE_ERROR' 
      });
    }

    // Отправляем уведомление пользователю о изменении статуса
    // Это будет реализовано в подзадаче 107.4
    const { notifyBugReportStatusChanged } = await import('../services/notificationService.js');
    notifyBugReportStatusChanged(bugReport.user_id, bugReport.title, status, bugReportId).catch(err => {
      console.error('Ошибка отправки уведомления об изменении статуса багрепорта:', err);
    });

    res.json({
      id: bugReportId,
      status,
      message: 'Статус успешно обновлен'
    });

  } catch (error) {
    console.error('Ошибка обновления статуса багрепорта:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * DELETE /api/bug-reports/admin/:id
 * Удалить багрепорт (только для админа)
 */
router.delete('/admin/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const bugReportId = req.params.id;

    // Проверяем существование багрепорта
    const bugReportResult = await executeQuery(
      `SELECT * FROM bug_reports WHERE id = ?`,
      [bugReportId]
    );

    if (!bugReportResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки багрепорта',
        code: 'DATABASE_ERROR' 
      });
    }

    if (bugReportResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Багрепорт не найден',
        code: 'NOT_FOUND' 
      });
    }

    const bugReport = bugReportResult.data[0];

    // Удаляем изображения багрепорта
    await executeQuery(
      `DELETE FROM bug_report_images WHERE bug_report_id = ?`,
      [bugReportId]
    );

    // Удаляем сам багрепорт
    const deleteResult = await executeQuery(
      `DELETE FROM bug_reports WHERE id = ?`,
      [bugReportId]
    );

    if (!deleteResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка удаления багрепорта',
        code: 'DATABASE_ERROR' 
      });
    }

    // Отправляем уведомление пользователю об удалении багрепорта
    const { notifyBugReportDeleted } = await import('../services/notificationService.js');
    notifyBugReportDeleted(bugReport.user_id, bugReport.title, bugReportId).catch(err => {
      console.error('Ошибка отправки уведомления об удалении багрепорта:', err);
    });

    res.json({
      id: bugReportId,
      message: 'Багрепорт успешно удален'
    });

  } catch (error) {
    console.error('Ошибка удаления багрепорта:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

export default router;
