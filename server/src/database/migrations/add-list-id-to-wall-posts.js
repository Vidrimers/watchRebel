import { executeQuery } from '../db.js';

/**
 * Миграция для добавления поля list_id в таблицу wall_posts
 * Это позволит делать название списка кликабельным в постах media_added
 */
export async function up() {
  console.log('🔄 Начало миграции: добавление list_id в wall_posts');

  try {
    // Проверяем, существует ли уже колонка
    const checkResult = await executeQuery(
      `SELECT COUNT(*) as count FROM pragma_table_info('wall_posts') WHERE name='list_id'`,
      []
    );

    if (checkResult.success && checkResult.data[0].count > 0) {
      console.log('⏭️  Колонка list_id уже существует, пропускаем');
      return;
    }

    // Добавляем колонку list_id
    await executeQuery(
      `ALTER TABLE wall_posts ADD COLUMN list_id TEXT`,
      []
    );

    console.log('✅ Колонка list_id добавлена в таблицу wall_posts');

  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
    throw error;
  }
}

export async function down() {
  console.log('⚠️  Откат миграции: удаление list_id из wall_posts');
  
  // SQLite не поддерживает DROP COLUMN напрямую
  // Нужно пересоздавать таблицу, но это опасно
  console.log('⚠️  Откат не реализован (SQLite ограничение)');
}
