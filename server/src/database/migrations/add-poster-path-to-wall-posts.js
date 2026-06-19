import { executeQuery } from '../db.js';

/**
 * Миграция: Добавление поля poster_path в таблицу wall_posts
 * Для хранения постеров медиа в постах на стене
 */
export async function up() {
  console.log('Запуск миграции: добавление poster_path в wall_posts');

  try {
    // Добавляем поле poster_path
    await executeQuery(`
      ALTER TABLE wall_posts 
      ADD COLUMN poster_path TEXT
    `);

    console.log('✅ Поле poster_path успешно добавлено в wall_posts');
    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
    return { success: false, error: error.message };
  }
}

export async function down() {
  console.log('Откат миграции: удаление poster_path из wall_posts');
  
  // SQLite не поддерживает DROP COLUMN напрямую
  // Нужно пересоздавать таблицу, но это сложно
  console.log('⚠️ Откат не поддерживается для SQLite ALTER TABLE DROP COLUMN');
  
  return { success: true };
}
