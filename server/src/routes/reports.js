import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * POST /api/reports
 * Создать жалобу
 */
router.post('/', async (req, res) => {
  try {
    const { reportedUserId, reason } = req.body;
    const reporterId = req.user.id;

    if (!reportedUserId || !reason) {
      return res.status(400).json({ error: 'Укажите пользователя и причину жалобы' });
    }

    if (reason.trim().length < 10) {
      return res.status(400).json({ error: 'Причина жалобы должна содержать минимум 10 символов' });
    }

    if (reporterId === reportedUserId) {
      return res.status(400).json({ error: 'Нельзя пожаловаться на себя' });
    }

    const userCheck = await executeQuery('SELECT id FROM users WHERE id = ?', [reportedUserId]);
    if (!userCheck.success || userCheck.data.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const id = uuidv4();
    const result = await executeQuery(
      'INSERT INTO reports (id, reporter_id, reported_user_id, reason) VALUES (?, ?, ?, ?)',
      [id, reporterId, reportedUserId, reason.trim()]
    );

    if (!result.success) {
      return res.status(500).json({ error: 'Ошибка создания жалобы' });
    }

    // Уведомляем админов
    try {
      const reporter = await executeQuery('SELECT display_name FROM users WHERE id = ?', [reporterId]);
      const reported = await executeQuery('SELECT display_name FROM users WHERE id = ?', [reportedUserId]);
      
      const reporterName = reporter.data?.[0]?.display_name || 'Неизвестный';
      const reportedName = reported.data?.[0]?.display_name || 'Неизвестный';

      // Уведомление в Telegram всем админам
      const admins = await executeQuery("SELECT id FROM users WHERE is_admin = 1");
      if (admins.success) {
        const adminIds = admins.data.map(a => a.id);
        for (const adminId of adminIds) {
          if (adminId !== reporterId) {
            await executeQuery(
              `INSERT INTO notifications (id, user_id, type, content, related_user_id) VALUES (?, ?, ?, ?, ?)`,
              [
                uuidv4(),
                adminId,
                'new_report',
                `Новая жалоба от ${reporterName} на ${reportedName}`,
                reporterId
              ]
            );
          }
        }
      }
    } catch (notifError) {
      console.error('Ошибка уведомления:', notifError);
    }

    res.status(201).json({ message: 'Жалоба отправлена' });
  } catch (error) {
    console.error('Ошибка создания жалобы:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
