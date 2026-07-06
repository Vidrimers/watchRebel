import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../database/db.js';
import { uploadAdRequestImages } from '../middleware/upload.js';
import { sendTelegramNotification } from '../services/notificationService.js';

const router = express.Router();

// Хранилище активных сессий верификации (в памяти для простоты)
const pendingVerifications = new Map();

/**
 * POST /api/ad-requests/notify-open
 * Уведомить админа что кто-то открыл форму заявки
 */
router.post('/notify-open', async (req, res) => {
  try {
    const adminId = process.env.TELEGRAM_ADMIN_ID;
    if (adminId) {
      await sendTelegramNotification(
        adminId,
        `👀 Кто-то открыл форму заявки на рекламу на сайте`,
        { parse_mode: 'HTML' }
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Ошибка TG уведомления:', err);
    res.json({ ok: true });
  }
});

/**
 * POST /api/ad-requests/send-code
 * Отправить код верификации в Telegram
 */
router.post('/send-code', async (req, res) => {
  try {
    const { telegram } = req.body;
    if (!telegram) {
      return res.status(400).json({ error: 'Укажите Telegram' });
    }

    const cleanTelegram = telegram.replace('@', '').trim();

    // Генерируем 6-значный код
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 минут

    // Сохраняем код
    const id = uuidv4();
    await executeQuery(
      `INSERT INTO telegram_verification_codes (id, telegram, code, expires_at)
       VALUES (?, ?, ?, ?)`,
      [id, cleanTelegram, code, expiresAt.toISOString()]
    );

    // Пытаемся отправить код через бота
    const userResult = await executeQuery(
      `SELECT id FROM users WHERE telegram_username = ? OR telegram_username = ? OR id = ? OR display_name = ?`,
      [cleanTelegram, telegram.replace('@', '').trim(), cleanTelegram, cleanTelegram]
    );

    if (userResult.success && userResult.data.length > 0) {
      const userId = userResult.data[0].id;
      await sendTelegramNotification(
        userId,
        `🔐 <b>Код верификации</b>\n\nВаш код: <code>${code}</code>\n\nВведите его на сайте для подтверждения Telegram.`,
        { parse_mode: 'HTML' }
      );
      res.json({ success: true, message: 'Код отправлен в Telegram' });
    } else {
      // Пользователь не найден в БД — возможно не зарегистрирован
      // Попробуем отправить по username напрямую
      try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (botToken) {
          // Получаем chat_id через getUpdates или хранилище
          // Пока просто сообщаем что пользователь должен нажать /start
          res.json({
            success: false,
            message: 'Пользователь не найден. Убедитесь, что вы нажали /start в боте.',
            botUsername: process.env.TELEGRAM_BOT_USERNAME || 'watchRebel_bot'
          });
        } else {
          res.json({ success: false, message: 'Бот не настроен' });
        }
      } catch (tgErr) {
        res.json({ success: false, message: 'Не удалось отправить код. Убедитесь, что вы нажали /start в боте.' });
      }
    }
  } catch (error) {
    console.error('Ошибка отправки кода:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/ad-requests/verify-code
 * Проверить код верификации
 */
router.post('/verify-code', async (req, res) => {
  try {
    const { telegram, code } = req.body;
    if (!telegram || !code) {
      return res.status(400).json({ error: 'Заполните все поля' });
    }

    const cleanTelegram = telegram.replace('@', '').trim();

    // Ищем активный код
    const result = await executeQuery(
      `SELECT * FROM telegram_verification_codes 
       WHERE telegram = ? AND code = ? AND verified = 0 AND expires_at > datetime('now')
       ORDER BY created_at DESC LIMIT 1`,
      [cleanTelegram, code]
    );

    if (!result.success || result.data.length === 0) {
      return res.json({ success: false, message: 'Неверный или просроченный код' });
    }

    // Помечаем как использованный
    await executeQuery(
      'UPDATE telegram_verification_codes SET verified = 1 WHERE id = ?',
      [result.data[0].id]
    );

    res.json({ success: true, message: 'Telegram подтверждён' });
  } catch (error) {
    console.error('Ошибка верификации:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/ad-requests
 * Отправить заявку на рекламу (публичный)
 */
router.post('/', uploadAdRequestImages.single('image'), async (req, res) => {
  try {
    const id = uuidv4();
    const { name, telegram, extraContact, calculatorData, adDescription, adLink, adLinkLabel, adText } = req.body;

    if (!name || !telegram) {
      return res.status(400).json({ error: 'Имя и Telegram обязательны' });
    }

    let calcData = {};
    try { calcData = JSON.parse(calculatorData || '{}'); } catch (e) {}

    const imageUrl = req.file ? `/uploads/ad-requests/${req.file.filename}` : null;

    const result = await executeQuery(
      `INSERT INTO ad_requests (id, user_id, name, telegram, extra_contact,
        channel_site, channel_tg, site_pin_qty, site_repeat_qty, site_interval,
        tg_mailing_qty, tg_repeat_qty, tg_interval, auto_delete_off, total_cost, currency,
        ad_description, ad_link, ad_link_label, ad_text, image_url, scheduled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, req.user?.id || null, name, telegram, extraContact || null,
        calcData.channelSite ? 1 : 0, calcData.channelTg ? 1 : 0,
        calcData.sitePinQty || 0, calcData.siteRepeatQty || 0, calcData.siteInterval || 0,
        calcData.tgMailingQty || 0, calcData.tgRepeatQty || 0, calcData.tgInterval || 0,
        calcData.autoDeleteOff ? 1 : 0, calcData.total || 0, calcData.currency || 'RUB',
        adDescription || null, adLink || null, adLinkLabel || null, adText || null, imageUrl,
        calcData.scheduledAt || null
      ]
    );

    if (!result.success) {
      return res.status(500).json({ error: 'Ошибка сохранения заявки' });
    }

    try {
      const adminId = process.env.TELEGRAM_ADMIN_ID;
      if (adminId) {
        const channels = [];
        if (calcData.channelSite) channels.push('сайт');
        if (calcData.channelTg) channels.push('Telegram');
        const channelText = channels.length ? ` (${channels.join(' + ')})` : '';

        await sendTelegramNotification(
          adminId,
          `📢 <b>Новая заявка на рекламу</b>\n\n` +
          `👤 ${name} (@${telegram})\n` +
          `📋 Каналы:${channelText}\n` +
          `💰 Сумма: ${calcData.total || 0} ${calcData.currency || 'RUB'}` +
          (adDescription ? `\n\n📝 ${adDescription}` : ''),
          { parse_mode: 'HTML' }
        );
      }
    } catch (tgErr) {
      console.error('Ошибка отправки TG уведомления:', tgErr);
    }

    res.json({ success: true, id });
  } catch (error) {
    console.error('Ошибка создания заявки:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
