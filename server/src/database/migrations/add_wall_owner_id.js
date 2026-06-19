/**
 * Миграция: Добавление поля wall_owner_id в таблицу wall_posts
 * 
 * Это поле хранит ID владельца стены, на которой опубликован пост.
 * user_id - автор поста (кто написал)
 * wall_owner_id - владелец стены (на чьей стене опубликовано)
 * 
 * Для старых постов wall_owner_id = user_id (посты на своей стене)
 */

import { executeQuery } from '../db.js';

export async function up() {
  console.log('Добавление поля wall_owner_id в таблицу wall_posts...');
  
  // Добавляем поле wall_owner_id
  await executeQuery(`
    ALTER TABLE wall_posts 
    ADD COLUMN wall_owner_id TEXT
  `);
  
  // Заполняем wall_owner_id для существующих постов (wall_owner_id = user_id)
  await executeQuery(`
    UPDATE wall_posts 
    SET wall_owner_id = user_id 
    WHERE wall_owner_id IS NULL
  `);
  
  console.log('Поле wall_owner_id успешно добавлено!');
}

export async function down() {
  console.log('Удаление поля wall_owner_id из таблицы wall_posts...');
  
  // SQLite не поддерживает DROP COLUMN напрямую
  // Нужно пересоздать таблицу без этого поля
  console.log('Откат миграции wall_owner_id не поддерживается в SQLite');
  console.log('Для отката необходимо восстановить базу данных из бэкапа');
}
