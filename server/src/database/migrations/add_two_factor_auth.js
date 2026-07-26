import { getDatabase } from '../db.js';

/**
 * Миграция для добавления двухфакторной аутентификации (2FA)
 * Добавляет поля: two_factor_enabled, two_factor_secret, two_factor_backup_codes
 * Создает таблицу trusted_devices для хранения доверенных устройств
 */
export async function addTwoFactorAuthMigration() {
  const db = getDatabase();
  
  console.log('Запуск миграции: добавление двухфакторной аутентификации (2FA)...');
  
  return new Promise((resolve) => {
    const migration = `
      -- Добавляем поля для 2FA в таблицу users
      ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT 0;
      ALTER TABLE users ADD COLUMN two_factor_secret TEXT;
      ALTER TABLE users ADD COLUMN two_factor_backup_codes TEXT;

      -- Создаем таблицу для доверенных устройств
      CREATE TABLE IF NOT EXISTS trusted_devices (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        device_name TEXT,
        ip_address TEXT,
        user_agent TEXT,
        last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Индексы дляtrusted_devices
      CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id ON trusted_devices(user_id);
      CREATE INDEX IF NOT EXISTS idx_trusted_devices_token_hash ON trusted_devices(token_hash);
    `;

    db.exec(migration, (err) => {
      if (err) {
        // Проверяем, не является ли ошибка "duplicate column name" (поля уже существуют)
        if (err.message.includes('duplicate column name')) {
          console.log('⚠ Поля уже существуют, пропускаем миграцию');
          resolve({ success: true });
        } else {
          console.error('Ошибка при выполнении миграции:', err.message);
          resolve({ success: false, error: err.message });
        }
      } else {
        console.log('✓ Миграция успешно выполнена: добавлены поля для 2FA');
        resolve({ success: true });
      }
    });
  });
}

export default { addTwoFactorAuthMigration };
