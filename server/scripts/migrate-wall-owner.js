/**
 * Скрипт миграции: Добавление поля wall_owner_id в таблицу wall_posts
 * 
 * Запуск: node server/scripts/migrate-wall-owner.js
 */

import { getDatabase } from '../src/database/db.js';

async function migrateWallOwner() {
  const db = getDatabase();
  
  console.log('🔄 Начало миграции wall_owner_id...');
  
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Проверяем, существует ли уже поле wall_owner_id
      db.all("PRAGMA table_info(wall_posts)", (err, columns) => {
        if (err) {
          console.error('❌ Ошибка проверки структуры таблицы:', err);
          reject(err);
          return;
        }
        
        const hasWallOwnerId = columns.some(col => col.name === 'wall_owner_id');
        
        if (hasWallOwnerId) {
          console.log('✓ Поле wall_owner_id уже существует');
          resolve();
          return;
        }
        
        console.log('📝 Добавление поля wall_owner_id...');
        
        // Добавляем поле wall_owner_id
        db.run(`ALTER TABLE wall_posts ADD COLUMN wall_owner_id TEXT`, (err) => {
          if (err) {
            console.error('❌ Ошибка добавления поля:', err);
            reject(err);
            return;
          }
          
          console.log('✓ Поле wall_owner_id добавлено');
          console.log('📝 Заполнение wall_owner_id для существующих постов...');
          
          // Заполняем wall_owner_id для существующих постов
          // Для старых постов: wall_owner_id = user_id (посты на своей стене)
          db.run(`UPDATE wall_posts SET wall_owner_id = user_id WHERE wall_owner_id IS NULL`, (err) => {
            if (err) {
              console.error('❌ Ошибка обновления данных:', err);
              reject(err);
              return;
            }
            
            console.log('✓ Данные успешно обновлены');
            console.log('✅ Миграция завершена успешно!');
            resolve();
          });
        });
      });
    });
  });
}

// Запускаем миграцию
migrateWallOwner()
  .then(() => {
    console.log('\n✅ Миграция wall_owner_id выполнена успешно!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Ошибка миграции:', err);
    process.exit(1);
  });
