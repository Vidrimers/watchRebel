/**
 * Миграция: Добавление таблицы friend_requests для системы запросов в друзья
 * Дата: 2026-03-04
 */

import { executeQuery } from '../db.js';

export async function up() {
  console.log('Запуск миграции: add_friend_requests_table');

  try {
    // Создаем таблицу friend_requests
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS friend_requests (
        id TEXT PRIMARY KEY,
        from_user_id TEXT NOT NULL,
        to_user_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(from_user_id, to_user_id)
      )
    `);

    console.log('✅ Таблица friend_requests создана');

    // Создаем индексы для быстрого поиска
    await executeQuery(`
      CREATE INDEX IF NOT EXISTS idx_friend_requests_from_user_id 
      ON friend_requests(from_user_id)
    `);

    await executeQuery(`
      CREATE INDEX IF NOT EXISTS idx_friend_requests_to_user_id 
      ON friend_requests(to_user_id)
    `);

    await executeQuery(`
      CREATE INDEX IF NOT EXISTS idx_friend_requests_status 
      ON friend_requests(status)
    `);

    console.log('✅ Индексы для friend_requests созданы');

  } catch (error) {
    console.error('❌ Ошибка миграции add_friend_requests_table:', error);
    throw error;
  }
}

export async function down() {
  console.log('Откат миграции: add_friend_requests_table');

  try {
    await executeQuery('DROP TABLE IF EXISTS friend_requests');
    console.log('✅ Таблица friend_requests удалена');
  } catch (error) {
    console.error('❌ Ошибка отката миграции add_friend_requests_table:', error);
    throw error;
  }
}
