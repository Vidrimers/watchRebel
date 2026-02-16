/**
 * Webhook endpoint для Telegram Bot
 */

import express from 'express';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /webhook/:token
 * Обработка webhook от Telegram
 */
router.post('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const update = req.body;

    // Проверяем токен
    if (token !== process.env.TELEGRAM_BOT_TOKEN) {
      logger.warn('Получен webhook с неверным токеном');
      return res.status(403).json({ error: 'Invalid token' });
    }

    logger.debug('Получен webhook update от Telegram', { 
      updateId: update.update_id 
    });

    // Импортируем обработчик webhook из telegram-bot
    // Это будет работать только если telegram-bot запущен как часть того же процесса
    // Для production рекомендуется использовать отдельный процесс
    try {
      const { handleWebhook } = await import('../../../telegram-bot/src/index.js');
      const result = await handleWebhook(update);
      
      if (result.success) {
        res.status(200).json({ ok: true });
      } else {
        logger.error('Ошибка обработки webhook', { error: result.error });
        res.status(500).json({ error: 'Webhook processing failed' });
      }
    } catch (importError) {
      logger.error('Ошибка импорта telegram-bot модуля', { 
        error: importError.message 
      });
      res.status(500).json({ error: 'Telegram bot not available' });
    }
  } catch (error) {
    logger.error('Ошибка обработки webhook', { 
      error: error.message, 
      stack: error.stack 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
