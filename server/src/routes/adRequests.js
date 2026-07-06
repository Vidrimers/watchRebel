import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../database/db.js';
import { uploadAdRequestImages } from '../middleware/upload.js';
import { sendTelegramNotification } from '../services/notificationService.js';

const router = express.Router();

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
