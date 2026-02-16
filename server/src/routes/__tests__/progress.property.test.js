/**
 * Property-based тесты для отслеживания прогресса просмотра сериалов
 * Feature: watch-rebel-social-network
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fc from 'fast-check';
import { executeQuery, closeDatabase } from '../../database/db.js';
import { v4 as uuidv4 } from 'uuid';

// Генератор валидных пользователей
const userIdArbitrary = fc.string({ minLength: 1, maxLength: 20 }).map(s => `test_${s}`);

// Генератор TMDb ID для сериалов
const tmdbIdArbitrary = fc.integer({ min: 1, max: 999999 });

// Генератор номеров сезонов (обычно от 0 до 20)
const seasonNumberArbitrary = fc.integer({ min: 0, max: 20 });

// Генератор номеров серий (обычно от 1 до 50)
const episodeNumberArbitrary = fc.integer({ min: 1, max: 50 });

// Вспомогательная функция для создания тестового пользователя
async function createTestUser(userId) {
  const result = await executeQuery(
    `INSERT OR IGNORE INTO users (id, telegram_username, display_name, avatar_url, is_admin, theme)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, `user_${userId}`, `Test User ${userId}`, null, 0, 'light-cream']
  );
  return result.success;
}

// Вспомогательная функция для отметки серии как просмотренной
async function markEpisodeWatched(userId, tmdbId, seasonNumber, episodeNumber) {
  // Проверяем, не отмечена ли уже эта серия
  const existingCheck = await executeQuery(
    `SELECT * FROM episode_progress 
     WHERE user_id = ? AND tmdb_id = ? AND season_number = ? AND episode_number = ?`,
    [userId, tmdbId, seasonNumber, episodeNumber]
  );
  
  if (!existingCheck.success) {
    return null;
  }
  
  // Если серия уже отмечена, возвращаем существующую запись
  if (existingCheck.data.length > 0) {
    return existingCheck.data[0];
  }
  
  // Создаем новую запись о прогрессе
  const progressId = uuidv4();
  const result = await executeQuery(
    `INSERT INTO episode_progress (id, user_id, tmdb_id, season_number, episode_number)
     VALUES (?, ?, ?, ?, ?)`,
    [progressId, userId, tmdbId, seasonNumber, episodeNumber]
  );
  
  if (!result.success) {
    return null;
  }
  
  // Получаем созданную запись
  const progressResult = await executeQuery(
    'SELECT * FROM episode_progress WHERE id = ?',
    [progressId]
  );
  
  return progressResult.success && progressResult.data.length > 0 
    ? progressResult.data[0] 
    : null;
}

// Вспомогательная функция для получения прогресса сериала
async function getSeriesProgress(userId, tmdbId) {
  const result = await executeQuery(
    `SELECT * FROM episode_progress 
     WHERE user_id = ? AND tmdb_id = ? 
     ORDER BY season_number, episode_number`,
    [userId, tmdbId]
  );
  return result.success ? result.data : [];
}

// Вспомогательная функция для обновления прогресса
async function updateProgress(progressId, seasonNumber, episodeNumber) {
  const updates = [];
  const params = [];
  
  if (seasonNumber !== undefined) {
    updates.push('season_number = ?');
    params.push(seasonNumber);
  }
  
  if (episodeNumber !== undefined) {
    updates.push('episode_number = ?');
    params.push(episodeNumber);
  }
  
  if (updates.length === 0) {
    return null;
  }
  
  updates.push('watched_at = CURRENT_TIMESTAMP');
  params.push(progressId);
  
  const updateQuery = `UPDATE episode_progress SET ${updates.join(', ')} WHERE id = ?`;
  const result = await executeQuery(updateQuery, params);
  
  if (!result.success) {
    return null;
  }
  
  // Получаем обновленную запись
  const progressResult = await executeQuery(
    'SELECT * FROM episode_progress WHERE id = ?',
    [progressId]
  );
  
  return progressResult.success && progressResult.data.length > 0 
    ? progressResult.data[0] 
    : null;
}

// Очистка тестовых данных после каждого теста
async function cleanupTestData(userId) {
  // Удаляем прогресс пользователя
  await executeQuery('DELETE FROM episode_progress WHERE user_id = ?', [userId]);
  // Удаляем пользователя
  await executeQuery('DELETE FROM users WHERE id = ?', [userId]);
}

describe('Episode Progress Management Properties', () => {
  before(async () => {
    // Создаем необходимые таблицы для тестов
    const createTablesQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        telegram_username TEXT,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        is_admin BOOLEAN DEFAULT 0,
        is_blocked BOOLEAN DEFAULT 0,
        theme TEXT DEFAULT 'light-cream',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS episode_progress (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        tmdb_id INTEGER NOT NULL,
        season_number INTEGER NOT NULL,
        episode_number INTEGER NOT NULL,
        watched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, tmdb_id, season_number, episode_number)
      );
    `;
    
    await executeQuery(createTablesQuery);
  });

  after(async () => {
    // Закрываем соединение с БД после всех тестов
    await closeDatabase();
    
    // Даем время на полное закрытие соединения
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  /**
   * Property 21: Episode Progress Round-Trip
   * Validates: Requirements 8.2
   * 
   * For any series, season, and episode, when a user marks an episode as watched,
   * the system must save the season number and episode number, and querying the 
   * progress must return the same values.
   */
  it('Feature: watch-rebel-social-network, Property 21: Episode Progress Round-Trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        tmdbIdArbitrary,
        seasonNumberArbitrary,
        episodeNumberArbitrary,
        async (userId, tmdbId, seasonNumber, episodeNumber) => {
          try {
            // Создаем тестового пользователя
            await createTestUser(userId);
            
            // Отмечаем серию как просмотренную
            const progress = await markEpisodeWatched(userId, tmdbId, seasonNumber, episodeNumber);
            assert.ok(progress, 'Progress should be created');
            assert.ok(progress.id, 'Progress should have an ID');
            
            // Получаем прогресс сериала
            const seriesProgress = await getSeriesProgress(userId, tmdbId);
            
            // Проверяем что отмеченная серия присутствует в прогрессе
            const found = seriesProgress.find(
              p => p.season_number === seasonNumber && p.episode_number === episodeNumber
            );
            assert.ok(found, 'Marked episode should be found in progress');
            assert.strictEqual(found.tmdb_id, tmdbId, 'TMDb ID should match');
            assert.strictEqual(found.season_number, seasonNumber, 'Season number should match');
            assert.strictEqual(found.episode_number, episodeNumber, 'Episode number should match');
            assert.strictEqual(found.user_id, userId, 'User ID should match');
            assert.ok(found.watched_at, 'Watched timestamp should be set');
            
            // Проверяем что можем получить прогресс напрямую по ID
            const directProgress = await executeQuery(
              'SELECT * FROM episode_progress WHERE id = ?',
              [progress.id]
            );
            assert.ok(directProgress.success, 'Direct query should succeed');
            assert.strictEqual(directProgress.data.length, 1, 'Should find exactly one record');
            assert.strictEqual(directProgress.data[0].season_number, seasonNumber, 
              'Direct query season number should match');
            assert.strictEqual(directProgress.data[0].episode_number, episodeNumber,
              'Direct query episode number should match');
            
          } finally {
            // Очищаем тестовые данные
            await cleanupTestData(userId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Дополнительный тест: Проверка уникальности записей о прогрессе
   * 
   * Для любой серии, попытка отметить её дважды должна возвращать 
   * существующую запись, а не создавать дубликат.
   */
  it('should not create duplicate progress entries for the same episode', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        tmdbIdArbitrary,
        seasonNumberArbitrary,
        episodeNumberArbitrary,
        async (userId, tmdbId, seasonNumber, episodeNumber) => {
          try {
            // Создаем тестового пользователя
            await createTestUser(userId);
            
            // Отмечаем серию первый раз
            const progress1 = await markEpisodeWatched(userId, tmdbId, seasonNumber, episodeNumber);
            assert.ok(progress1, 'First progress should be created');
            
            // Отмечаем ту же серию второй раз
            const progress2 = await markEpisodeWatched(userId, tmdbId, seasonNumber, episodeNumber);
            assert.ok(progress2, 'Second call should return existing progress');
            
            // Проверяем что ID одинаковые (та же запись)
            assert.strictEqual(progress1.id, progress2.id, 
              'Should return the same progress record');
            
            // Проверяем что в базе только одна запись
            const allProgress = await getSeriesProgress(userId, tmdbId);
            const matchingRecords = allProgress.filter(
              p => p.season_number === seasonNumber && p.episode_number === episodeNumber
            );
            assert.strictEqual(matchingRecords.length, 1, 
              'Should have exactly one record for this episode');
            
          } finally {
            // Очищаем тестовые данные
            await cleanupTestData(userId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Дополнительный тест: Проверка обновления прогресса
   * 
   * Для любой записи о прогрессе, обновление номера сезона или серии 
   * должно корректно сохраняться.
   */
  it('should correctly update episode progress', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        tmdbIdArbitrary,
        seasonNumberArbitrary,
        episodeNumberArbitrary,
        seasonNumberArbitrary,
        episodeNumberArbitrary,
        async (userId, tmdbId, initialSeason, initialEpisode, newSeason, newEpisode) => {
          try {
            // Создаем тестового пользователя
            await createTestUser(userId);
            
            // Создаем начальную запись о прогрессе
            const initialProgress = await markEpisodeWatched(
              userId, tmdbId, initialSeason, initialEpisode
            );
            assert.ok(initialProgress, 'Initial progress should be created');
            
            // Обновляем прогресс
            const updatedProgress = await updateProgress(
              initialProgress.id, newSeason, newEpisode
            );
            assert.ok(updatedProgress, 'Progress should be updated');
            
            // Проверяем что значения обновились
            assert.strictEqual(updatedProgress.season_number, newSeason, 
              'Season number should be updated');
            assert.strictEqual(updatedProgress.episode_number, newEpisode,
              'Episode number should be updated');
            assert.strictEqual(updatedProgress.id, initialProgress.id,
              'ID should remain the same');
            
            // Проверяем что обновление сохранилось в базе
            const verifyResult = await executeQuery(
              'SELECT * FROM episode_progress WHERE id = ?',
              [initialProgress.id]
            );
            assert.ok(verifyResult.success, 'Verification query should succeed');
            assert.strictEqual(verifyResult.data[0].season_number, newSeason,
              'Updated season should be in database');
            assert.strictEqual(verifyResult.data[0].episode_number, newEpisode,
              'Updated episode should be in database');
            
          } finally {
            // Очищаем тестовые данные
            await cleanupTestData(userId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Дополнительный тест: Проверка множественных серий одного сериала
   * 
   * Для любого сериала, пользователь должен иметь возможность отметить 
   * несколько разных серий, и все они должны корректно сохраняться.
   */
  it('should handle multiple episodes of the same series', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        tmdbIdArbitrary,
        fc.array(
          fc.record({
            season: seasonNumberArbitrary,
            episode: episodeNumberArbitrary
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (userId, tmdbId, episodes) => {
          try {
            // Создаем тестового пользователя
            await createTestUser(userId);
            
            // Отмечаем все серии
            const progressRecords = [];
            for (const ep of episodes) {
              const progress = await markEpisodeWatched(
                userId, tmdbId, ep.season, ep.episode
              );
              if (progress) {
                progressRecords.push(progress);
              }
            }
            
            // Получаем весь прогресс сериала
            const seriesProgress = await getSeriesProgress(userId, tmdbId);
            
            // Проверяем что все уникальные серии сохранились
            // (дубликаты не должны создавать новые записи)
            const uniqueEpisodes = new Set(
              episodes.map(ep => `${ep.season}-${ep.episode}`)
            );
            
            assert.ok(seriesProgress.length <= uniqueEpisodes.size,
              'Number of progress records should not exceed unique episodes');
            
            // Проверяем что каждая уникальная серия присутствует в прогрессе
            for (const ep of episodes) {
              const found = seriesProgress.find(
                p => p.season_number === ep.season && p.episode_number === ep.episode
              );
              assert.ok(found, 
                `Episode S${ep.season}E${ep.episode} should be in progress`);
            }
            
          } finally {
            // Очищаем тестовые данные
            await cleanupTestData(userId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Дополнительный тест: Проверка сортировки прогресса
   * 
   * Прогресс должен возвращаться отсортированным по сезону и серии.
   */
  it('should return progress sorted by season and episode', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        tmdbIdArbitrary,
        fc.array(
          fc.record({
            season: seasonNumberArbitrary,
            episode: episodeNumberArbitrary
          }),
          { minLength: 2, maxLength: 10 }
        ),
        async (userId, tmdbId, episodes) => {
          try {
            // Создаем тестового пользователя
            await createTestUser(userId);
            
            // Отмечаем все серии в случайном порядке
            for (const ep of episodes) {
              await markEpisodeWatched(userId, tmdbId, ep.season, ep.episode);
            }
            
            // Получаем прогресс
            const seriesProgress = await getSeriesProgress(userId, tmdbId);
            
            // Проверяем что прогресс отсортирован
            for (let i = 1; i < seriesProgress.length; i++) {
              const prev = seriesProgress[i - 1];
              const curr = seriesProgress[i];
              
              // Проверяем сортировку: сначала по сезону, потом по серии
              const prevKey = prev.season_number * 1000 + prev.episode_number;
              const currKey = curr.season_number * 1000 + curr.episode_number;
              
              assert.ok(prevKey <= currKey,
                `Progress should be sorted: S${prev.season_number}E${prev.episode_number} ` +
                `should come before S${curr.season_number}E${curr.episode_number}`);
            }
            
          } finally {
            // Очищаем тестовые данные
            await cleanupTestData(userId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
