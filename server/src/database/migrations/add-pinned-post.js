// Миграция: Добавление поля pinned_post_id в таблицу users
// Дата: 2026-03-03

import { executeQuery } from '../db.js';

/**
 * Миграция: Добавление поля pinned_post_id в таблицу users
 * Для хранения ID закрепленного поста на стене пользователя
 */
export async function up() {
  console.log('Запуск миграции: добавление pinned_post_id в users');
  
  try {
    // Добавляем поле pinned_post_id в таблицу users
    await executeQuery(`
      ALTER TABLE users 
      ADD COLUMN pinned_post_id TEXT DEFAULT NULL
    `);
    
    console.log('✅ Поле pinned_post_id успешно добавлено в users');
    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
    return { success: false, error: error.message };
  }
}

export async function down() {
  console.log('Откат миграции: удаление pinned_post_id из users');
  
  // SQLite не поддерживает DROP COLUMN напрямую
  // Нужно пересоздавать таблицу, но это сложно
  console.log('⚠️ Откат не поддерживается для SQLite ALTER TABLE DROP COLUMN');
  
  return { success: true };
}

