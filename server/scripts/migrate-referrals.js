import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Путь к базе данных
const dbPath = join(__dirname, '..', 'rebel.db');

console.log('🔄 Миграция: Добавление полей реферальной системы');
console.log(`📁 База данных: ${dbPath}`);

const db = new sqlite3.Database(dbPath);

// Проверяем наличие колонок
db.all("PRAGMA table_info(users)", [], async (err, columns) => {
  if (err) {
    console.error('❌ Ошибка получения информации о таблице:', err.message);
    db.close();
    return;
  }

  const columnNames = columns.map(col => col.name);
  console.log('📋 Существующие колонки:', columnNames);

  const migrations = [];

  // Проверяем наличие каждой колонки
  const hasReferralCode = columnNames.includes('referral_code');
  const hasReferredBy = columnNames.includes('referred_by');
  const hasReferralsCount = columnNames.includes('referrals_count');

  if (!hasReferralCode) {
    migrations.push('ALTER TABLE users ADD COLUMN referral_code TEXT');
    migrations.push('CREATE UNIQUE INDEX idx_referral_code ON users(referral_code)');
    console.log('➕ Добавление поля referral_code...');
  } else {
    console.log('✓ Поле referral_code уже существует');
  }

  if (!hasReferredBy) {
    migrations.push('ALTER TABLE users ADD COLUMN referred_by TEXT');
    console.log('➕ Добавление поля referred_by...');
  } else {
    console.log('✓ Поле referred_by уже существует');
  }

  if (!hasReferralsCount) {
    migrations.push('ALTER TABLE users ADD COLUMN referrals_count INTEGER DEFAULT 0');
    console.log('➕ Добавление поля referrals_count...');
  } else {
    console.log('✓ Поле referrals_count уже существует');
  }

  if (migrations.length === 0) {
    console.log('✅ Все поля уже существуют, миграция не требуется');
    db.close();
    return;
  }

  // Выполняем миграции
  console.log(`\n🔧 Выполнение ${migrations.length} миграций...`);

  for (const migration of migrations) {
    await new Promise((resolve, reject) => {
      db.run(migration, (err) => {
        if (err) {
          console.error(`❌ Ошибка выполнения миграции: ${migration}`);
          console.error(err.message);
          reject(err);
        } else {
          console.log(`✓ ${migration}`);
          resolve();
        }
      });
    });
  }

  // Генерируем реферальные коды для существующих пользователей
  console.log('\n🔑 Генерация реферальных кодов для существующих пользователей...');
  
  db.all("SELECT id FROM users WHERE referral_code IS NULL", [], async (err, users) => {
    if (err) {
      console.error('❌ Ошибка получения пользователей:', err.message);
      db.close();
      return;
    }

    console.log(`📊 Найдено пользователей без реферального кода: ${users.length}`);

    for (const user of users) {
      const referralCode = generateReferralCode();
      await new Promise((resolve) => {
        db.run(
          'UPDATE users SET referral_code = ? WHERE id = ?',
          [referralCode, user.id],
          (err) => {
            if (err) {
              console.error(`❌ Ошибка обновления пользователя ${user.id}:`, err.message);
            } else {
              console.log(`✓ Пользователь ${user.id}: ${referralCode}`);
            }
            resolve();
          }
        );
      });
    }

    console.log('\n✅ Миграция успешно завершена!');
    db.close();
  });
});

// Функция генерации реферального кода
function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
