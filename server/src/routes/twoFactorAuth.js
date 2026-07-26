import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { generateSecret } from '@otplib/core';
import { generate, verify } from '@otplib/totp';
import { NobleCryptoPlugin } from '@otplib/plugin-crypto-noble';
import { ScureBase32Plugin } from '@otplib/plugin-base32-scure';
import QRCode from 'qrcode';
import { generatePreAuthToken, verifyPreAuthToken, hashTrustedDeviceToken } from '../utils/twoFactorUtils.js';

const router = express.Router();

const otplibCrypto = new NobleCryptoPlugin();
const otplibBase32 = new ScureBase32Plugin();
const otplibOpts = { crypto: otplibCrypto, base32: otplibBase32 };

/**
 * POST /api/2fa/setup
 * Генерация secret для 2FA и возврат otpauth:// URI
 * Требует аутентификации
 */
router.post('/setup', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Проверяем, не включена ли уже 2FA
    const userResult = await executeQuery(
      'SELECT two_factor_enabled FROM users WHERE id = ?',
      [userId]
    );

    if (!userResult.success || userResult.data.length === 0) {
      return res.status(404).json({
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND'
      });
    }

    if (userResult.data[0].two_factor_enabled) {
      return res.status(400).json({
        error: '2FA уже включена. Сначала отключите её.',
        code: '2FA_ALREADY_ENABLED'
      });
    }

    // Генерируем секрет
    const secret = generateSecret(otplibOpts);

    // Генерируем otpauth:// URI
    const otpauthUrl = `otpauth://totp/WatchRebel:${encodeURIComponent(userId)}?secret=${secret}&issuer=WatchRebel`;

    // Генерируем QR-код как data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Временно сохраняем секрет (не активируем пока)
    await executeQuery(
      'UPDATE users SET two_factor_secret = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [secret, userId]
    );

    console.log(`✅ 2FA setup initiated for user ${userId}`);

    res.json({
      secret,
      otpauthUrl,
      qrCode: qrCodeDataUrl
    });

  } catch (error) {
    console.error('Ошибка setup 2FA:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/2fa/confirm
 * Подтверждение 2FA первым введённым кодом
 * Только после этого two_factor_enabled = true
 * Требует аутентификации
 */
router.post('/confirm', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        error: 'Код подтверждения обязателен',
        code: 'CODE_REQUIRED'
      });
    }

    // Получаем секрет пользователя
    const userResult = await executeQuery(
      'SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = ?',
      [userId]
    );

    if (!userResult.success || userResult.data.length === 0) {
      return res.status(404).json({
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = userResult.data[0];

    if (user.two_factor_enabled) {
      return res.status(400).json({
        error: '2FA уже включена',
        code: '2FA_ALREADY_ENABLED'
      });
    }

    if (!user.two_factor_secret) {
      return res.status(400).json({
        error: 'Сначала выполните setup 2FA',
        code: '2FA_NOT_SETUP'
      });
    }

    // Проверяем код
    const result = await verify({ token: code, secret: user.two_factor_secret, ...otplibOpts });
    const isValid = result.valid;

    if (!isValid) {
      return res.status(400).json({
        error: 'Неверный код. Проверьте время на устройстве и попробуйте снова.',
        code: 'INVALID_CODE'
      });
    }

    // Генерируем backup-коды (10 одноразовых кодов)
    const backupCodes = [];
    const backupCodesHashed = [];

    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 символов
      backupCodes.push(code);
      const hash = await bcrypt.hash(code, 10);
      backupCodesHashed.push(hash);
    }

    // Включаем 2FA и сохраняем backup-коды
    await executeQuery(
      'UPDATE users SET two_factor_enabled = 1, two_factor_backup_codes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(backupCodesHashed), userId]
    );

    // Инвалидируем все текущие сессии (кроме текущей) — пользователь должен перелогиниться с 2FA
    await executeQuery(
      'DELETE FROM sessions WHERE user_id = ? AND id != ?',
      [userId, req.sessionId]
    );

    console.log(`✅ 2FA enabled for user ${userId}`);

    res.json({
      message: '2FA успешно включена. Необходимо войти заново.',
      backupCodes,
      requireRelogin: true
    });

  } catch (error) {
    console.error('Ошибка confirm 2FA:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/2fa/verify
 * Верификация 2FA-кода при входе (с pre-auth токеном)
 * Или верификация backup-кода
 */
router.post('/verify', async (req, res) => {
  try {
    const { preAuthToken, code, backupCode } = req.body;

    if (!preAuthToken) {
      return res.status(400).json({
        error: 'Pre-auth токен обязателен',
        code: 'PRE_AUTH_REQUIRED'
      });
    }

    // Верифицируем pre-auth токен
    const tokenPayload = verifyPreAuthToken(preAuthToken);
    if (!tokenPayload) {
      return res.status(401).json({
        error: 'Pre-auth токен истёк или недействителен. Пожалуйста, войдите заново.',
        code: 'PRE_AUTH_EXPIRED'
      });
    }

    const userId = tokenPayload.userId;

    // Получаем данные пользователя
    const userResult = await executeQuery(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    if (!userResult.success || userResult.data.length === 0) {
      return res.status(404).json({
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = userResult.data[0];

    if (!user.two_factor_enabled) {
      return res.status(400).json({
        error: '2FA не включена',
        code: '2FA_NOT_ENABLED'
      });
    }

    let verified = false;

    // Проверяем TOTP-код
    if (code) {
      const verifyResult = await verify({ token: code, secret: user.two_factor_secret, ...otplibOpts });
      verified = verifyResult.valid;
    }
    // Проверяем backup-код
    else if (backupCode) {
      const backupCodesHashed = JSON.parse(user.two_factor_backup_codes || '[]');

      for (let i = 0; i < backupCodesHashed.length; i++) {
        const match = await bcrypt.compare(backupCode.toUpperCase(), backupCodesHashed[i]);
        if (match) {
          verified = true;
          // Удаляем использованный backup-код (одноразовый)
          backupCodesHashed.splice(i, 1);
          await executeQuery(
            'UPDATE users SET two_factor_backup_codes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [JSON.stringify(backupCodesHashed), userId]
          );
          break;
        }
      }
    }

    if (!verified) {
      return res.status(401).json({
        error: code ? 'Неверный код' : 'Неверный backup-код',
        code: 'INVALID_2FA_CODE'
      });
    }

    // Создаем полноценную сессию
    const sessionId = uuidv4();
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const sessionResult = await executeQuery(
      `INSERT INTO sessions (id, user_id, token, expires_at)
       VALUES (?, ?, ?, ?)`,
      [sessionId, userId, token, expiresAt.toISOString()]
    );

    if (!sessionResult.success) {
      return res.status(500).json({
        error: 'Ошибка создания сессии',
        code: 'DATABASE_ERROR'
      });
    }

    // Ставим trusted device cookie
    const trustedToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashTrustedDeviceToken(trustedToken);

    const trustedDeviceId = uuidv4();
    const deviceName = req.headers['user-agent']?.substring(0, 100) || 'Unknown';
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.connection.remoteAddress;

    await executeQuery(
      `INSERT INTO trusted_devices (id, user_id, token_hash, device_name, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [trustedDeviceId, userId, tokenHash, deviceName, ipAddress, req.headers['user-agent']]
    );

    // Устанавливаем cookie (30 дней)
    res.cookie('trusted_device', trustedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 дней
    });

    console.log(`✅ 2FA verified for user ${userId}, session created`);

    // Получаем информацию о пользователе
    const fullUserResult = await executeQuery(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );
    const fullUser = fullUserResult.data[0];

    res.json({
      token,
      user: {
        id: fullUser.id,
        telegramUsername: fullUser.telegram_username,
        email: fullUser.email,
        displayName: fullUser.display_name,
        avatarUrl: fullUser.avatar_url,
        isAdmin: Boolean(fullUser.is_admin),
        theme: fullUser.theme,
        authMethod: fullUser.auth_method || 'telegram',
        hasPassword: Boolean(fullUser.password_hash),
        twoFactorEnabled: Boolean(fullUser.two_factor_enabled),
        createdAt: fullUser.created_at
      }
    });

  } catch (error) {
    console.error('Ошибка verify 2FA:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/2fa/disable
 * Отключение 2FA
 * Требует подтверждения паролем (для email) или повторного TOTP-кода
 * Требует аутентификации
 */
router.post('/disable', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { password, totpCode } = req.body;

    // Получаем данные пользователя
    const userResult = await executeQuery(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    if (!userResult.success || userResult.data.length === 0) {
      return res.status(404).json({
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = userResult.data[0];

    if (!user.two_factor_enabled) {
      return res.status(400).json({
        error: '2FA не включена',
        code: '2FA_NOT_ENABLED'
      });
    }

    // Проверяем подтверждение
    let confirmed = false;

    // Если есть пароль — проверяем пароль
    if (password && user.password_hash) {
      confirmed = await bcrypt.compare(password, user.password_hash);
    }
    // Если есть TOTP-код — проверяем его
    else if (totpCode) {
      confirmed = (await verify({ token: totpCode, secret: user.two_factor_secret, ...otplibOpts })).valid;
    }

    if (!confirmed) {
      return res.status(401).json({
        error: 'Неверный пароль или код',
        code: 'INVALID_CONFIRMATION'
      });
    }

    // Отключаем 2FA
    await executeQuery(
      'UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL, two_factor_backup_codes = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [userId]
    );

    // Удаляем все доверенные устройства
    await executeQuery(
      'DELETE FROM trusted_devices WHERE user_id = ?',
      [userId]
    );

    console.log(`✅ 2FA disabled for user ${userId}`);

    res.json({
      message: '2FA успешно отключена'
    });

  } catch (error) {
    console.error('Ошибка disable 2FA:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/2fa/check-trusted-device
 * Проверка trusted device cookie
 * Возвращает pre-auth токен если устройство доверенное
 */
router.post('/check-trusted-device', async (req, res) => {
  try {
    const trustedToken = req.cookies?.trusted_device;

    if (!trustedToken) {
      return res.json({ trusted: false });
    }

    const tokenHash = hashTrustedDeviceToken(trustedToken);

    // Ищем устройство в БД
    const deviceResult = await executeQuery(
      `SELECT td.*, u.two_factor_enabled
       FROM trusted_devices td
       JOIN users u ON td.user_id = u.id
       WHERE td.token_hash = ?`,
      [tokenHash]
    );

    if (!deviceResult.success || deviceResult.data.length === 0) {
      return res.json({ trusted: false });
    }

    const device = deviceResult.data[0];

    // Проверяем, не истек лиtrusted device (30 дней)
    const createdAt = new Date(device.created_at);
    const now = new Date();
    const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24);

    if (daysSinceCreation > 30) {
      // Удаляем истекшее устройство
      await executeQuery(
        'DELETE FROM trusted_devices WHERE id = ?',
        [device.id]
      );
      return res.json({ trusted: false });
    }

    // Если 2FA не включена —trusted device не нужен
    if (!device.two_factor_enabled) {
      return res.json({ trusted: false });
    }

    // Обновляем last_used_at
    await executeQuery(
      'UPDATE trusted_devices SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?',
      [device.id]
    );

    // Генерируем pre-auth токен
    const preAuthToken = generatePreAuthToken(device.user_id);

    res.json({
      trusted: true,
      preAuthToken,
      userId: device.user_id
    });

  } catch (error) {
    console.error('Ошибка проверки trusted device:', error);
    res.json({ trusted: false });
  }
});

/**
 * GET /api/2fa/trusted-devices
 * Получение списка доверенных устройств пользователя
 * Требует аутентификации
 */
router.get('/trusted-devices', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const devicesResult = await executeQuery(
      `SELECT id, device_name, ip_address, last_used_at, created_at
       FROM trusted_devices
       WHERE user_id = ?
       ORDER BY last_used_at DESC`,
      [userId]
    );

    if (!devicesResult.success) {
      return res.status(500).json({
        error: 'Ошибка получения устройств',
        code: 'DATABASE_ERROR'
      });
    }

    res.json(devicesResult.data);

  } catch (error) {
    console.error('Ошибка получения trusted devices:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * DELETE /api/2fa/trusted-devices/:id
 * Отзыв конкретного доверенного устройства
 * Требует аутентификации
 */
router.delete('/trusted-devices/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const deleteResult = await executeQuery(
      'DELETE FROM trusted_devices WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!deleteResult.success) {
      return res.status(500).json({
        error: 'Ошибка удаления устройства',
        code: 'DATABASE_ERROR'
      });
    }

    if (deleteResult.changes === 0) {
      return res.status(404).json({
        error: 'Устройство не найдено',
        code: 'DEVICE_NOT_FOUND'
      });
    }

    res.json({ message: 'Устройство отозвано' });

  } catch (error) {
    console.error('Ошибка удаления trusted device:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * DELETE /api/2fa/trusted-devices
 * Отзыв всех доверенных устройств (кроме текущего)
 * Требует аутентификации
 */
router.delete('/trusted-devices', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const currentDeviceToken = req.cookies?.trusted_device;

    if (currentDeviceToken) {
      const currentHash = hashTrustedDeviceToken(currentDeviceToken);
      // Удаляем все кроме текущего
      await executeQuery(
        'DELETE FROM trusted_devices WHERE user_id = ? AND token_hash != ?',
        [userId, currentHash]
      );
    } else {
      await executeQuery(
        'DELETE FROM trusted_devices WHERE user_id = ?',
        [userId]
      );
    }

    res.json({ message: 'Все устройства отозваны' });

  } catch (error) {
    console.error('Ошибка удаления всех trusted devices:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/2fa/regenerate-backup-codes
 * Регенерация backup-кодов (старые инвалидируются)
 * Требует аутентификации + подтверждение паролем/TOTP
 */
router.post('/regenerate-backup-codes', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { password, totpCode } = req.body;

    // Получаем данные пользователя
    const userResult = await executeQuery(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    if (!userResult.success || userResult.data.length === 0) {
      return res.status(404).json({
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = userResult.data[0];

    if (!user.two_factor_enabled) {
      return res.status(400).json({
        error: '2FA не включена',
        code: '2FA_NOT_ENABLED'
      });
    }

    // Проверяем подтверждение
    let confirmed = false;

    if (password && user.password_hash) {
      confirmed = await bcrypt.compare(password, user.password_hash);
    } else if (totpCode) {
      confirmed = (await verify({ token: totpCode, secret: user.two_factor_secret, ...otplibOpts })).valid;
    }

    if (!confirmed) {
      return res.status(401).json({
        error: 'Неверный пароль или код',
        code: 'INVALID_CONFIRMATION'
      });
    }

    // Генерируем новые backup-коды
    const backupCodes = [];
    const backupCodesHashed = [];

    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      backupCodes.push(code);
      const hash = await bcrypt.hash(code, 10);
      backupCodesHashed.push(hash);
    }

    // Сохраняем
    await executeQuery(
      'UPDATE users SET two_factor_backup_codes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(backupCodesHashed), userId]
    );

    console.log(`✅ Backup codes regenerated for user ${userId}`);

    res.json({
      message: 'Backup-коды успешно регенерированы. Старые коды больше не действуют.',
      backupCodes
    });

  } catch (error) {
    console.error('Ошибка регенерации backup codes:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/2fa/status
 * Получение статуса 2FA текущего пользователя
 * Требует аутентификации
 */
router.post('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const userResult = await executeQuery(
      'SELECT two_factor_enabled FROM users WHERE id = ?',
      [userId]
    );

    if (!userResult.success || userResult.data.length === 0) {
      return res.status(404).json({
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      enabled: Boolean(userResult.data[0].two_factor_enabled)
    });

  } catch (error) {
    console.error('Ошибка получения статуса 2FA:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;
