import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';
const envFile = isProd ? '.env.production' : '.env';
dotenv.config({ path: path.join(__dirname, '../../', envFile) });

import { getMediaDatabase, executeMediaQuery } from '../src/database/mediaDb.js';
import { executeQuery } from '../src/database/db.js';
import tmdbService from '../src/services/tmdbService.js';
import mediaCacheService from '../src/services/mediaCacheService.js';

async function migrate() {
  console.log('🎬 Начинаю миграцию фильмов в media.db...\n');

  // Собираем все tmdb_id
  const listItems = await executeQuery('SELECT DISTINCT tmdb_id, media_type FROM list_items');
  const wallPosts = await executeQuery('SELECT DISTINCT tmdb_id, media_type FROM wall_posts WHERE tmdb_id IS NOT NULL');
  const watchlistItems = await executeQuery('SELECT DISTINCT tmdb_id, media_type FROM watchlist');

  const allItems = new Map();
  const addItems = (result, source) => {
    if (result.success) {
      result.data.forEach(item => {
        if (item.tmdb_id && !allItems.has(`${item.tmdb_id}_${item.media_type}`)) {
          allItems.set(`${item.tmdb_id}_${item.media_type}`, {
            tmdbId: item.tmdb_id,
            mediaType: item.media_type,
            source
          });
        }
      });
    }
  };

  addItems(listItems, 'list_items');
  addItems(wallPosts, 'wall_posts');
  addItems(watchlistItems, 'watchlist');

  console.log(`📊 Найдено ${allItems.size} уникальных фильмов/сериалов\n`);

  let cached = 0, skipped = 0, errors = 0;

  for (const [key, item] of allItems) {
    const existing = await mediaCacheService.getCachedMedia(item.tmdbId, item.mediaType);
    if (existing) {
      skipped++;
      continue;
    }

    try {
      const data = await mediaCacheService.getOrFetch(item.tmdbId, item.mediaType);
      if (data) {
        cached++;
        process.stdout.write(`\r  ✅ Закэшировано: ${cached} | ⏭️ Пропущено: ${skipped} | ❌ Ошибки: ${errors}`);
      } else {
        errors++;
      }
      // Задержка для rate limit TMDb (40 req/sec)
      await new Promise(r => setTimeout(r, 30));
    } catch (error) {
      errors++;
      console.error(`\n  ❌ Ошибка ${item.mediaType}/${item.tmdbId}: ${error.message}`);
    }
  }

  console.log(`\n\n🏁 Миграция завершена:`);
  console.log(`   Всего: ${allItems.size}`);
  console.log(`   Закэшировано: ${cached}`);
  console.log(`   Уже в кэше: ${skipped}`);
  console.log(`   Ошибки: ${errors}`);

  process.exit(0);
}

migrate().catch(err => {
  console.error('Ошибка миграции:', err);
  process.exit(1);
});
