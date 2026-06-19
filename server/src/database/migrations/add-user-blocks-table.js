/**
 * Миграция: Добавление таблицы user_blocks для блокировки пользователей
 * Дата: 2026-03-02
 */

import { executeQuery } from '../db.js';

export async function up() {
  console.log('Запуск миграции: add-user-blocks-table');

  try {
    // Создаем таблицу user_blocks
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS user_blocks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        blocked_user_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (blocked_user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, blocked_user_id)
      )
    `);

    console.log('✅ Таблица user_blocks создана');

    // Создаем индексы для быстрого поиска
    await executeQuery(`
      CREATE INDEX IF NOT EXISTS idx_user_blocks_user_id 
      ON user_blocks(user_id)
    `);

    await executeQuery(`
      CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_user_id 
      ON user_blocks(blocked_user_id)
    `);

    console.log('✅ Индексы для user_blocks созданы');

  } catch (error) {
    console.error('❌ Ошибка миграции add-user-blocks-table:', error);
    throw error;
  }
}

export async function down() {
  console.log('Откат миграции: add-user-blocks-table');

  try {
    await executeQuery('DROP TABLE IF EXISTS user_blocks');
    console.log('✅ Таблица user_blocks удалена');
  } catch (error) {
    console.error('❌ Ошибка отката миграции add-user-blocks-table:', error);
    throw error;
  }
}
