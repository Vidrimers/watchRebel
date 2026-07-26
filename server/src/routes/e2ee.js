import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/e2ee/keys
 * Загрузить/обновить публичный ключ E2EE
 */
router.post('/keys', authenticateToken, async (req, res) => {
  try {
    const { publicKey } = req.body;
    const userId = req.user.id;

    if (!publicKey || typeof publicKey !== 'string') {
      return res.status(400).json({
        error: 'publicKey обязателен и должен быть строкой',
        code: 'INVALID_PUBLIC_KEY'
      });
    }

    // Проверяем, есть ли уже ключ у пользователя
    const existing = await executeQuery(
      'SELECT id FROM user_keys WHERE user_id = ?',
      [userId]
    );

    if (existing.success && existing.data.length > 0) {
      // Обновляем существующий ключ
      const result = await executeQuery(
        'UPDATE user_keys SET public_key = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [publicKey, userId]
      );

      if (!result.success) {
        return res.status(500).json({
          error: 'Ошибка обновления ключа',
          code: 'DATABASE_ERROR'
        });
      }

      return res.json({
        message: 'Публичный ключ обновлён',
        keyId: existing.data[0].id
      });
    }

    // Создаём новый ключ
    const keyId = uuidv4();
    const result = await executeQuery(
      'INSERT INTO user_keys (id, user_id, public_key) VALUES (?, ?, ?)',
      [keyId, userId, publicKey]
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Ошибка сохранения ключа',
        code: 'DATABASE_ERROR'
      });
    }

    res.status(201).json({
      message: 'Публичный ключ сохранён',
      keyId
    });

  } catch (error) {
    console.error('Ошибка загрузки E2EE ключа:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/e2ee/keys/:userId
 * Получить публичный ключ пользователя
 */
router.get('/keys/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: 'userId обязателен',
        code: 'INVALID_USER_ID'
      });
    }

    const result = await executeQuery(
      'SELECT public_key, created_at, updated_at FROM user_keys WHERE user_id = ?',
      [userId]
    );

    if (!result.success || result.data.length === 0) {
      return res.status(404).json({
        error: 'Публичный ключ не найден',
        code: 'KEY_NOT_FOUND'
      });
    }

    const key = result.data[0];
    res.json({
      publicKey: key.public_key,
      createdAt: key.created_at,
      updatedAt: key.updated_at
    });

  } catch (error) {
    console.error('Ошибка получения E2EE ключа:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * DELETE /api/e2ee/keys
 * Удалить свой публичный ключ
 */
router.delete('/keys', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await executeQuery(
      'DELETE FROM user_keys WHERE user_id = ?',
      [userId]
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Ошибка удаления ключа',
        code: 'DATABASE_ERROR'
      });
    }

    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Ключ не найден',
        code: 'KEY_NOT_FOUND'
      });
    }

    res.json({
      message: 'Публичный ключ удалён'
    });

  } catch (error) {
    console.error('Ошибка удаления E2EE ключа:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

// === Key Backup (Recovery Phrase) ===

/**
 * POST /api/e2ee/backup
 * Сохранить зашифрованный бэкап приватного ключа
 */
router.post('/backup', authenticateToken, async (req, res) => {
  try {
    const { encryptedPrivateKey, salt, iv } = req.body;
    const userId = req.user.id;

    if (!encryptedPrivateKey || !salt || !iv) {
      return res.status(400).json({
        error: 'encryptedPrivateKey, salt и iv обязательны',
        code: 'MISSING_FIELDS'
      });
    }

    // Проверяем, есть ли уже бэкап
    const existing = await executeQuery(
      'SELECT id FROM key_backups WHERE user_id = ?',
      [userId]
    );

    if (existing.success && existing.data.length > 0) {
      // Обновляем существующий бэкап
      const result = await executeQuery(
        'UPDATE key_backups SET encrypted_private_key = ?, salt = ?, iv = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [encryptedPrivateKey, salt, iv, userId]
      );

      if (!result.success) {
        return res.status(500).json({ error: 'Ошибка обновления бэкапа', code: 'DATABASE_ERROR' });
      }

      return res.json({ message: 'Бэкап обновлён' });
    }

    // Создаём новый бэкап
    const backupId = uuidv4();
    const result = await executeQuery(
      'INSERT INTO key_backups (id, user_id, encrypted_private_key, salt, iv) VALUES (?, ?, ?, ?, ?)',
      [backupId, userId, encryptedPrivateKey, salt, iv]
    );

    if (!result.success) {
      return res.status(500).json({ error: 'Ошибка сохранения бэкапа', code: 'DATABASE_ERROR' });
    }

    res.status(201).json({ message: 'Бэкап сохранён', backupId });

  } catch (error) {
    console.error('Ошибка сохранения бэкапа:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/e2ee/backup
 * Получить свой зашифрованный бэкап
 */
router.get('/backup', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await executeQuery(
      'SELECT encrypted_private_key, salt, iv, created_at, updated_at FROM key_backups WHERE user_id = ?',
      [userId]
    );

    if (!result.success || result.data.length === 0) {
      return res.status(404).json({ error: 'Бэкап не найден', code: 'BACKUP_NOT_FOUND' });
    }

    const backup = result.data[0];
    res.json({
      encryptedPrivateKey: backup.encrypted_private_key,
      salt: backup.salt,
      iv: backup.iv,
      createdAt: backup.created_at,
      updatedAt: backup.updated_at
    });

  } catch (error) {
    console.error('Ошибка получения бэкапа:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

/**
 * DELETE /api/e2ee/backup
 * Удалить свой бэкап
 */
router.delete('/backup', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await executeQuery(
      'DELETE FROM key_backups WHERE user_id = ?',
      [userId]
    );

    if (!result.success) {
      return res.status(500).json({ error: 'Ошибка удаления бэкапа', code: 'DATABASE_ERROR' });
    }

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Бэкап не найден', code: 'BACKUP_NOT_FOUND' });
    }

    res.json({ message: 'Бэкап удалён' });

  } catch (error) {
    console.error('Ошибка удаления бэкапа:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
  }
});

export default router;
