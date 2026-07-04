import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/settings/ad-pricing (публичный)
 * Получить все настройки цен рекламы для прайс-листа
 */
router.get('/ad-pricing', (req, res) => {
  const db = getDatabase();
  db.all(
    "SELECT key, value FROM site_settings WHERE key IN ('ad_price_site', 'ad_price_repeat', 'ad_price_interval', 'ad_price_telegram', 'advertising_contacts', 'pricing_info_title', 'pricing_info_content', 'ad_currency')",
    [],
    (err, rows) => {
      if (err) {
        console.error('Ошибка:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }
      const settings = {};
      rows.forEach(r => { if (r.value) settings[r.key] = r.value; });
      res.json(settings);
    }
  );
});

/**
 * GET /api/settings/:key
 * Получить значение настройки по ключу (публичный endpoint)
 */
router.get('/:key', (req, res) => {
  const { key } = req.params;
  const db = getDatabase();

  db.get(
    'SELECT value, updated_at FROM site_settings WHERE key = ?',
    [key],
    (err, setting) => {
      if (err) {
        console.error('Ошибка при получении настройки:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      if (!setting) {
        return res.status(404).json({ error: 'Настройка не найдена' });
      }

      res.json({
        key,
        value: setting.value,
        updatedAt: setting.updated_at
      });
    }
  );
});

/**
 * PUT /api/settings/:key
 * Обновить значение настройки (только для админа)
 */
router.put('/:key', authenticateToken, (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  const userId = req.user.id;
  const db = getDatabase();

  db.get(
    'SELECT is_admin FROM users WHERE id = ?',
    [userId],
    (err, user) => {
      if (err) {
        console.error('Ошибка при проверке прав:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      if (!user || !user.is_admin) {
        return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора.' });
      }

      db.run(
        `UPDATE site_settings 
         SET value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
         WHERE key = ?`,
        [value, userId, key],
        function(err) {
          if (err) {
            console.error('Ошибка при обновлении настройки:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
          }

          if (this.changes === 0) {
            return res.status(404).json({ error: 'Настройка не найдена' });
          }

          db.get(
            'SELECT value, updated_at FROM site_settings WHERE key = ?',
            [key],
            (err, setting) => {
              if (err) {
                console.error('Ошибка при получении обновленной настройки:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
              }

              res.json({
                key,
                value: setting.value,
                updatedAt: setting.updated_at,
                message: 'Настройка успешно обновлена'
              });
            }
          );
        }
      );
    }
  );
});

export default router;
