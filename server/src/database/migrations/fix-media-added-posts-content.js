import { executeQuery } from '../db.js';

/**
 * Миграция для исправления content в постах типа media_added
 * Получает названия фильмов/сериалов из TMDb и обновляет content
 */
export async function up() {
  console.log('🔄 Начало миграции: исправление content в постах media_added');

  try {
    // Получаем все посты типа media_added
    const postsResult = await executeQuery(
      `SELECT id, content, tmdb_id, media_type, poster_path 
       FROM wall_posts 
       WHERE post_type = 'media_added'`,
      []
    );

    if (!postsResult.success) {
      throw new Error('Ошибка получения постов: ' + postsResult.error);
    }

    const posts = postsResult.data;
    console.log(`📊 Найдено постов для обновления: ${posts.length}`);

    if (posts.length === 0) {
      console.log('✅ Нет постов для обновления');
      return;
    }

    // Импортируем TMDb сервис
    const tmdbService = (await import('../../services/tmdbService.js')).default;

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const post of posts) {
      try {
        // Проверяем, нужно ли обновлять пост
        // Если content уже содержит перенос строки, значит формат правильный
        if (post.content && post.content.includes('\n')) {
          const lines = post.content.split('\n');
          // Если первая строка не "контент #..." и не пустая, значит название уже есть
          if (lines[0] && !lines[0].startsWith('контент #') && lines[0].trim() !== '') {
            console.log(`⏭️  Пост ${post.id} уже имеет правильный формат, пропускаем`);
            skipped++;
            continue;
          }
        }

        // Получаем название из TMDb
        let mediaTitle;
        let posterPath = post.poster_path;

        if (post.media_type === 'movie') {
          const details = await tmdbService.getMovieDetails(post.tmdb_id);
          mediaTitle = details.title;
          if (!posterPath) posterPath = details.poster_path;
        } else {
          const details = await tmdbService.getTVDetails(post.tmdb_id);
          mediaTitle = details.name;
          if (!posterPath) posterPath = details.poster_path;
        }

        // Извлекаем название списка из старого content
        let listName = 'список';
        if (post.content) {
          const match = post.content.match(/Добавил в список:\s*(.+)/);
          if (match) {
            listName = match[1].trim();
          }
        }

        // Формируем новый content
        const newContent = `${mediaTitle}\nДобавил в список: ${listName}`;

        // Обновляем пост
        const updateResult = await executeQuery(
          `UPDATE wall_posts 
           SET content = ?, poster_path = ?
           WHERE id = ?`,
          [newContent, posterPath, post.id]
        );

        if (updateResult.success) {
          console.log(`✅ Обновлен пост ${post.id}: "${mediaTitle}"`);
          updated++;
        } else {
          console.error(`❌ Ошибка обновления поста ${post.id}:`, updateResult.error);
          errors++;
        }

      } catch (err) {
        console.error(`❌ Ошибка обработки поста ${post.id}:`, err.message);
        errors++;
      }
    }

    console.log('\n📊 Результаты миграции:');
    console.log(`  ✅ Обновлено: ${updated}`);
    console.log(`  ⏭️  Пропущено: ${skipped}`);
    console.log(`  ❌ Ошибок: ${errors}`);
    console.log('✅ Миграция завершена');

  } catch (error) {
    console.error('❌ Критическая ошибка миграции:', error);
    throw error;
  }
}

export async function down() {
  console.log('⚠️  Откат этой миграции не поддерживается');
  console.log('   Старые значения content не сохранялись');
}
