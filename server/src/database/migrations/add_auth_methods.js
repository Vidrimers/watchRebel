import { getDatabase } from '../db.js';

/**
 * Миграция для добавления поддержки множественных способов авторизации
 * Добавляет поля: auth_method, email, password_hash, google_id, discord_id, email_verified
 * Создает таблицу email_verification_tokens
 */
export async function addAuthMethodsMigration() {
  const db = getDatabase();
  
  console.log('Запуск миграции: добавление полей для множественных способов авторизации...');
  
  return new Promise((resolve) => {
    const migration = `
      -- Добавляем новые поля в таблицу users
      ALTER TABLE users ADD COLUMN auth_method TEXT DEFAULT 'telegram';
      ALTER TABLE users ADD COLUMN email TEXT;
      ALTER TABLE users ADD COLUMN password_hash TEXT;
      ALTER TABLE users ADD COLUMN google_id TEXT;
      ALTER TABLE users ADD COLUMN discord_id TEXT;
      ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0;

      -- Создаем таблицу для токенов подтверждения email
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Создаем индекс для быстрого поиска по email
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      
      -- Создаем индекс для быстрого поиска по google_id
      CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
      
      -- Создаем индекс для быстрого поиска по discord_id
      CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);
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
        console.log('✓ Миграция успешно выполнена: добавлены поля для множественных способов авторизации');
        resolve({ success: true });
      }
    });
  });
}

export default { addAuthMethodsMigration };
