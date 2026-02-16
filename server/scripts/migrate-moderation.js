import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'rebel.db');

/**
 * Миграция для добавления полей модерации
 */
async function migrateModeration() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Ошибка подключения к БД:', err);
        reject(err);
        return;
      }
      
      console.log('Подключено к базе данных');
      
      // Проверяем, существуют ли уже поля
      db.all("PRAGMA table_info(users)", (err, columns) => {
        if (err) {
          console.error('Ошибка получения информации о таблице:', err);
          db.close();
          reject(err);
          return;
        }
        
        const hasBanReason = columns.some(col => col.name === 'ban_reason');
        const hasPostBanUntil = columns.some(col => col.name === 'post_ban_until');
        
        const migrations = [];
        
        // Добавляем поля, если их нет
        if (!hasBanReason) {
          migrations.push('ALTER TABLE users ADD COLUMN ban_reason TEXT');
          console.log('Добавление поля ban_reason...');
        } else {
          console.log('Поле ban_reason уже существует');
        }
        
        if (!hasPostBanUntil) {
          migrations.push('ALTER TABLE users ADD COLUMN post_ban_until DATETIME');
          console.log('Добавление поля post_ban_until...');
        } else {
          console.log('Поле post_ban_until уже существует');
        }
        
        // Создаем таблицу moderation_actions
        migrations.push(`
          CREATE TABLE IF NOT EXISTS moderation_actions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            admin_id TEXT NOT NULL,
            action_type TEXT NOT NULL,
            reason TEXT,
            duration_minutes INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            is_active BOOLEAN DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (admin_id) REFERENCES users(id)
          )
        `);
        console.log('Создание таблицы moderation_actions...');
        
        if (migrations.length === 0) {
          console.log('Все миграции уже применены');
          db.close();
          resolve();
          return;
        }
        
        // Выполняем миграции последовательно
        let completed = 0;
        
        migrations.forEach((migration, index) => {
          db.run(migration, (err) => {
            if (err) {
              console.error(`Ошибка выполнения миграции ${index + 1}:`, err);
              db.close();
              reject(err);
              return;
            }
            
            completed++;
            console.log(`✓ Миграция ${completed}/${migrations.length} выполнена`);
            
            if (completed === migrations.length) {
              console.log('✓ Все миграции успешно применены!');
              db.close();
              resolve();
            }
          });
        });
      });
    });
  });
}

// Запуск миграции
migrateModeration()
  .then(() => {
    console.log('Миграция завершена успешно');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Ошибка миграции:', err);
    process.exit(1);
  });
