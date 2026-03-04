/**
 * Роуты для управления запросами в друзья
 */

import express from 'express';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendTelegramNotification, checkNotificationEnabled, createNotification } from '../services/notificationService.js';

const router = express.Router();

/**
 * POST /api/friend-requests
 * Отправить запрос в друзья
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId } = req.body;

    if (!toUserId) {
      return res.status(400).json({ 
        error: 'Не указан ID пользователя',
        code: 'MISSING_USER_ID' 
      });
    }

    // Нельзя отправить запрос самому себе
    if (fromUserId === toUserId) {
      return res.status(400).json({ 
        error: 'Нельзя отправить запрос самому себе',
        code: 'SELF_REQUEST' 
      });
    }

    // Проверяем, существует ли пользователь
    const userCheck = await executeQuery(
      'SELECT id FROM users WHERE id = ? AND is_blocked = 0',
      [toUserId]
    );

    if (!userCheck.success || userCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND' 
      });
    }

    // Проверяем, не заблокирован ли пользователь
    const blockCheck = await executeQuery(
      'SELECT id FROM user_blocks WHERE (user_id = ? AND blocked_user_id = ?) OR (user_id = ? AND blocked_user_id = ?)',
      [fromUserId, toUserId, toUserId, fromUserId]
    );

    if (blockCheck.success && blockCheck.data.length > 0) {
      return res.status(403).json({ 
        error: 'Невозможно отправить запрос',
        code: 'USER_BLOCKED' 
      });
    }

    // Проверяем, не друзья ли уже
    const friendCheck = await executeQuery(
      'SELECT id FROM friends WHERE user_id = ? AND friend_id = ?',
      [fromUserId, toUserId]
    );

    if (friendCheck.success && friendCheck.data.length > 0) {
      return res.status(400).json({ 
        error: 'Пользователь уже в друзьях',
        code: 'ALREADY_FRIENDS' 
      });
    }

    // Проверяем, нет ли уже активного запроса
    const existingRequest = await executeQuery(
      'SELECT id, status FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?',
      [fromUserId, toUserId]
    );

    if (existingRequest.success && existingRequest.data.length > 0) {
      const request = existingRequest.data[0];
      if (request.status === 'pending') {
        return res.status(400).json({ 
          error: 'Запрос уже отправлен',
          code: 'REQUEST_ALREADY_SENT' 
        });
      } else if (request.status === 'rejected') {
        // Если запрос был отклонён, обновляем его статус на pending
        await executeQuery(
          'UPDATE friend_requests SET status = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['pending', request.id]
        );
        
        // Получаем имя отправителя для уведомления
        const senderResult = await executeQuery(
          'SELECT display_name FROM users WHERE id = ?',
          [fromUserId]
        );

        if (senderResult.success && senderResult.data.length > 0) {
          const senderName = senderResult.data[0].display_name;
          
          // Проверяем настройки уведомлений получателя
          const isNotificationEnabled = await checkNotificationEnabled(toUserId, 'new_friend_request');
          
          if (isNotificationEnabled) {
            // Отправляем уведомление в Telegram
            const telegramMessage = `👥 <b>Новый запрос в друзья!</b>\n\n${senderName} хочет добавить вас в друзья.`;
            sendTelegramNotification(toUserId, telegramMessage).catch(err => {
              console.error('Ошибка отправки уведомления о запросе в друзья:', err);
            });
          }

          // Создаем уведомление на сайте через сервис
          await createNotification(
            toUserId,
            'friend_request',
            'хочет добавить вас в друзья',
            fromUserId,
            null
          );
        }
        
        return res.status(201).json({
          id: request.id,
          fromUserId,
          toUserId,
          status: 'pending',
          message: 'Запрос отправлен повторно'
        });
      }
    }

    // Создаем запрос
    const { v4: uuidv4 } = await import('uuid');
    const requestId = uuidv4();

    const insertResult = await executeQuery(
      'INSERT INTO friend_requests (id, from_user_id, to_user_id, status) VALUES (?, ?, ?, ?)',
      [requestId, fromUserId, toUserId, 'pending']
    );

    if (!insertResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка создания запроса',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем имя отправителя
    const senderResult = await executeQuery(
      'SELECT display_name FROM users WHERE id = ?',
      [fromUserId]
    );

    if (senderResult.success && senderResult.data.length > 0) {
      const senderName = senderResult.data[0].display_name;
      
      // Проверяем настройки уведомлений получателя
      const isNotificationEnabled = await checkNotificationEnabled(toUserId, 'new_friend_request');
      
      if (isNotificationEnabled) {
        // Отправляем уведомление в Telegram
        const telegramMessage = `👥 <b>Новый запрос в друзья!</b>\n\n${senderName} хочет добавить вас в друзья.`;
        sendTelegramNotification(toUserId, telegramMessage).catch(err => {
          console.error('Ошибка отправки уведомления о запросе в друзья:', err);
        });
      } else {
        console.log(`🔕 Уведомление о запросе в друзья не отправлено пользователю ${toUserId} (отключено в настройках)`);
      }

      // Создаем уведомление на сайте через сервис
      await createNotification(
        toUserId,
        'friend_request',
        'хочет добавить вас в друзья',
        fromUserId,
        null
      );
    }

    res.status(201).json({
      id: requestId,
      fromUserId,
      toUserId,
      status: 'pending',
      message: 'Запрос отправлен'
    });

  } catch (error) {
    console.error('Ошибка отправки запроса в друзья:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/friend-requests
 * Получить входящие запросы в друзья
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await executeQuery(`
      SELECT 
        fr.id,
        fr.from_user_id,
        fr.to_user_id,
        fr.status,
        fr.created_at,
        u.display_name,
        u.avatar_url,
        u.telegram_username
      FROM friend_requests fr
      JOIN users u ON fr.from_user_id = u.id
      WHERE fr.to_user_id = ? AND fr.status = 'pending'
      ORDER BY fr.created_at DESC
    `, [userId]);

    if (!result.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения запросов',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json(result.data);

  } catch (error) {
    console.error('Ошибка получения запросов в друзья:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/friend-requests/sent
 * Получить исходящие запросы в друзья
 */
router.get('/sent', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await executeQuery(`
      SELECT 
        fr.id,
        fr.from_user_id,
        fr.to_user_id,
        fr.status,
        fr.created_at,
        u.display_name,
        u.avatar_url,
        u.telegram_username
      FROM friend_requests fr
      JOIN users u ON fr.to_user_id = u.id
      WHERE fr.from_user_id = ? AND fr.status = 'pending'
      ORDER BY fr.created_at DESC
    `, [userId]);

    if (!result.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения запросов',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json(result.data);

  } catch (error) {
    console.error('Ошибка получения исходящих запросов:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * PUT /api/friend-requests/:id/accept
 * Принять запрос в друзья
 */
router.put('/:id/accept', authenticateToken, async (req, res) => {
  try {
    const requestId = req.params.id;
    const userId = req.user.id;

    // Получаем запрос
    const requestResult = await executeQuery(
      'SELECT * FROM friend_requests WHERE id = ? AND to_user_id = ? AND status = ?',
      [requestId, userId, 'pending']
    );

    if (!requestResult.success || requestResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Запрос не найден',
        code: 'REQUEST_NOT_FOUND' 
      });
    }

    const request = requestResult.data[0];
    const fromUserId = request.from_user_id;

    // Обновляем статус запроса
    const updateResult = await executeQuery(
      'UPDATE friend_requests SET status = ? WHERE id = ?',
      ['accepted', requestId]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка обновления запроса',
        code: 'DATABASE_ERROR' 
      });
    }

    // Добавляем в друзья (двусторонняя связь)
    const { v4: uuidv4 } = await import('uuid');
    const friendship1Id = uuidv4();
    const friendship2Id = uuidv4();

    await executeQuery(
      'INSERT INTO friends (id, user_id, friend_id) VALUES (?, ?, ?)',
      [friendship1Id, userId, fromUserId]
    );

    await executeQuery(
      'INSERT INTO friends (id, user_id, friend_id) VALUES (?, ?, ?)',
      [friendship2Id, fromUserId, userId]
    );

    // Получаем имя принявшего запрос
    const accepterResult = await executeQuery(
      'SELECT display_name FROM users WHERE id = ?',
      [userId]
    );

    if (accepterResult.success && accepterResult.data.length > 0) {
      const accepterName = accepterResult.data[0].display_name;
      
      // Проверяем настройки уведомлений отправителя
      const isNotificationEnabled = await checkNotificationEnabled(fromUserId, 'new_friend_request');
      
      if (isNotificationEnabled) {
        // Отправляем уведомление отправителю
        const telegramMessage = `✅ <b>Запрос принят!</b>\n\n${accepterName} принял ваш запрос в друзья.`;
        sendTelegramNotification(fromUserId, telegramMessage).catch(err => {
          console.error('Ошибка отправки уведомления о принятии запроса:', err);
        });
      } else {
        console.log(`🔕 Уведомление о принятии запроса не отправлено пользователю ${fromUserId} (отключено в настройках)`);
      }

      // Создаем уведомление на сайте через сервис
      await createNotification(
        fromUserId,
        'friend_request_accepted',
        'принял ваш запрос в друзья',
        userId,
        null
      );
    }

    res.json({
      message: 'Запрос принят',
      requestId,
      fromUserId,
      toUserId: userId
    });

  } catch (error) {
    console.error('Ошибка принятия запроса в друзья:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * PUT /api/friend-requests/:id/reject
 * Отклонить запрос в друзья
 */
router.put('/:id/reject', authenticateToken, async (req, res) => {
  try {
    const requestId = req.params.id;
    const userId = req.user.id;

    // Проверяем, что запрос существует и адресован текущему пользователю
    const requestResult = await executeQuery(
      'SELECT * FROM friend_requests WHERE id = ? AND to_user_id = ? AND status = ?',
      [requestId, userId, 'pending']
    );

    if (!requestResult.success || requestResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Запрос не найден',
        code: 'REQUEST_NOT_FOUND' 
      });
    }

    // Обновляем статус запроса
    const updateResult = await executeQuery(
      'UPDATE friend_requests SET status = ? WHERE id = ?',
      ['rejected', requestId]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка обновления запроса',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json({
      message: 'Запрос отклонен',
      requestId
    });

  } catch (error) {
    console.error('Ошибка отклонения запроса в друзья:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * DELETE /api/friend-requests/:id
 * Отменить свой запрос в друзья
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const requestId = req.params.id;
    const userId = req.user.id;

    // Проверяем, что запрос существует и отправлен текущим пользователем
    const requestResult = await executeQuery(
      'SELECT * FROM friend_requests WHERE id = ? AND from_user_id = ? AND status = ?',
      [requestId, userId, 'pending']
    );

    if (!requestResult.success || requestResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Запрос не найден',
        code: 'REQUEST_NOT_FOUND' 
      });
    }

    // Удаляем запрос
    const deleteResult = await executeQuery(
      'DELETE FROM friend_requests WHERE id = ?',
      [requestId]
    );

    if (!deleteResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка удаления запроса',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json({
      message: 'Запрос отменен',
      requestId
    });

  } catch (error) {
    console.error('Ошибка отмены запроса в друзья:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

export default router;
