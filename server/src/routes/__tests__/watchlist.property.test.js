/**
 * Property-based тесты для управления списком желаемого (Watchlist)
 * Feature: watch-rebel-social-network
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fc from 'fast-check';
import { executeQuery, closeDatabase } from '../../database/db.js';
import { v4 as uuidv4 } from 'uuid';

// Генератор валидных пользователей
const userIdArbitrary = fc.string({ minLength: 1, maxLength: 20 }).map(s => `test_${s}`);

// Генератор валидных названий списков
const listNameArbitrary = fc.string({ minLength: 1, maxLength: 100 });

// Генератор типов медиа
const mediaTypeArbitrary = fc.constantFrom('movie', 'tv');

// Генератор TMDb ID
const tmdbIdArbitrary = fc.integer({ min: 1, max: 999999 });

// Вспомогательная функция для создания тестового пользователя
async function createTestUser(userId) {
  const result = await executeQuery(
    `INSERT OR IGNORE INTO users (id, telegram_username, display_name, avatar_url, is_admin, theme)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, `user_${userId}`, `Test User ${userId}`, null, 0, 'light-cream']
  );
  return result.success;
}

// Вспомогательная функция для добавления элемента в watchlist
async function addToWatchlist(userId, tmdbId, mediaType) {
  // Проверяем, не находится ли элемент уже в watchlist
  const existingCheck = await executeQuery(
    'SELECT * FROM watchlist WHERE user_id = ? AND tmdb_id = ? AND media_type = ?',
    [userId, tmdbId, mediaType]
  );
  
  if (!existingCheck.success) {
    return null;
  }
  
  // Если элемент уже существует, возвращаем null
  if (existingCheck.data.length > 0) {
    return null;
  }
  
  // Добавляем элемент в watchlist
  const itemId = uuidv4();
  const result = await executeQuery(
    'INSERT INTO watchlist (id, user_id, tmdb_id, media_type) VALUES (?, ?, ?, ?)',
    [itemId, userId, tmdbId, mediaType]
  );
  
  if (!result.success) {
    return null;
  }
  
  return { id: itemId, userId, tmdbId, mediaType };
}

// Вспомогательная функция для получения watchlist пользователя
async function getWatchlist(userId, mediaType = null) {
  let query = 'SELECT * FROM watchlist WHERE user_id = ?';
  const params = [userId];
  
  if (mediaType) {
    query += ' AND media_type = ?';
    params.push(mediaType);
  }
  
  const result = await executeQuery(query, params);
  return result.success ? result.data : [];
}

// Вспомогательная функция для удаления элемента из watchlist
async function removeFromWatchlist(itemId) {
  const result = await executeQuery(
    'DELETE FROM watchlist WHERE id = ?',
    [itemId]
  );
  return result.success;
}

// Вспомогательная функция для создания списка
async function createList(userId, name, mediaType) {
  const listId = uuidv4();
  const result = await executeQuery(
    'INSERT INTO custom_lists (id, user_id, name, media_type) VALUES (?, ?, ?, ?)',
    [listId, userId, name, mediaType]
  );
  
  if (!result.success) {
    return null;
  }
  
  return { id: listId, userId, name, mediaType };
}

// Вспомогательная функция для добавления элемента в список
async function addItemToList(listId, tmdbId, mediaType) {
  // Сначала получаем информацию о списке, чтобы узнать user_id
  const listResult = await executeQuery(
    'SELECT user_id FROM custom_lists WHERE id = ?',
    [listId]
  );
  
  if (!listResult.success || listResult.data.length === 0) {
    return null;
  }
  
  const userId = listResult.data[0].user_id;
  
  // Проверяем, не находится ли элемент уже в другом списке этого пользователя
  const existingItemCheck = await executeQuery(
    `SELECT li.* FROM list_items li
     JOIN custom_lists cl ON li.list_id = cl.id
     WHERE cl.user_id = ? AND li.tmdb_id = ? AND li.media_type = ?`,
    [userId, tmdbId, mediaType]
  );
  
  if (!existingItemCheck.success) {
    return null;
  }
  
  // Если элемент уже существует в каком-то списке, возвращаем null
  if (existingItemCheck.data.length > 0) {
    return null;
  }
  
  // Добавляем элемент в список
  const itemId = uuidv4();
  const result = await executeQuery(
    'INSERT INTO list_items (id, list_id, tmdb_id, media_type) VALUES (?, ?, ?, ?)',
    [itemId, listId, tmdbId, mediaType]
  );
  
  if (!result.success) {
    return null;
  }
  
  return { id: itemId, listId, tmdbId, mediaType };
}

// Вспомогательная функция для получения элементов списка
async function getListItems(listId) {
  const result = await executeQuery(
    'SELECT * FROM list_items WHERE list_id = ?',
    [listId]
  );
  return result.success ? result.data : [];
}

// Очистка тестовых данных после каждого теста
async function cleanupTestData(userId) {
  // Удаляем watchlist пользователя
  await executeQuery('DELETE FROM watchlist WHERE user_id = ?', [userId]);
  // Удаляем списки пользователя (элементы удалятся автоматически благодаря CASCADE)
  await executeQuery('DELETE FROM custom_lists WHERE user_id = ?', [userId]);
  // Удаляем пользователя
  await executeQuery('DELETE FROM users WHERE id = ?', [userId]);
}

describe('Watchlist Management Properties', () => {
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

      CREATE TABLE IF NOT EXISTS watchlist (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        tmdb_id INTEGER NOT NULL,
        media_type TEXT NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, tmdb_id)
      );

      CREATE TABLE IF NOT EXISTS custom_lists (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        media_type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS list_items (
        id TEXT PRIMARY KEY,
        list_id TEXT NOT NULL,
        tmdb_id INTEGER NOT NULL,
        media_type TEXT NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (list_id) REFERENCES custom_lists(id) ON DELETE CASCADE,
        UNIQUE(list_id, tmdb_id)
      );
    `;
    
    await executeQuery(createTablesQuery);
  });

  after(async () => {
    // Закрываем соединение с БД после всех тестов
    await closeDatabase();
  });

  /**
   * Property 10: Watchlist Round-Trip
   * Validates: Requirements 4.1
   * 
   * For any media item, adding it to watchlist and then querying the watchlist 
   * must include that item.
   */
  it('Feature: watch-rebel-social-network, Property 10: Watchlist Round-Trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        tmdbIdArbitrary,
        mediaTypeArbitrary,
        async (userId, tmdbId, mediaType) => {
          try {
            // Создаем тестового пользователя
            await createTestUser(userId);
            
            // Добавляем элемент в watchlist
            const item = await addToWatchlist(userId, tmdbId, mediaType);
            assert.ok(item, 'Item should be added to watchlist');
            assert.ok(item.id, 'Item should have an ID');
            
            // Получаем watchlist пользователя
            const watchlist = await getWatchlist(userId, mediaType);
            
            // Проверяем что добавленный элемент присутствует
            const found = watchlist.find(i => i.tmdb_id === tmdbId);
            assert.ok(found, 'Added item should be found in watchlist');
            assert.strictEqual(found.tmdb_id, tmdbId, 'TMDb ID should match');
            assert.strictEqual(found.media_type, mediaType, 'Media type should match');
            assert.strictEqual(found.user_id, userId, 'User ID should match');
            
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
   * Property 11: Watchlist to List Movement
   * Validates: Requirements 4.3
   * 
   * For any media item in watchlist, moving it to a custom list must remove it 
   * from watchlist and add it to the list.
   */
  it('Feature: watch-rebel-social-network, Property 11: Watchlist to List Movement', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        tmdbIdArbitrary,
        mediaTypeArbitrary,
        listNameArbitrary,
        async (userId, tmdbId, mediaType, listName) => {
          try {
            // Создаем тестового пользователя
            await createTestUser(userId);
            
            // Добавляем элемент в watchlist
            const watchlistItem = await addToWatchlist(userId, tmdbId, mediaType);
            assert.ok(watchlistItem, 'Item should be added to watchlist');
            
            // Проверяем что элемент в watchlist
            let watchlist = await getWatchlist(userId, mediaType);
            let inWatchlist = watchlist.some(i => i.tmdb_id === tmdbId);
            assert.ok(inWatchlist, 'Item should be in watchlist initially');
            
            // Создаем список
            const list = await createList(userId, listName, mediaType);
            assert.ok(list, 'List should be created');
            
            // Перемещаем элемент из watchlist в список
            // Сначала удаляем из watchlist
            await removeFromWatchlist(watchlistItem.id);
            
            // Затем добавляем в список
            const listItem = await addItemToList(list.id, tmdbId, mediaType);
            assert.ok(listItem, 'Item should be added to list');
            
            // Проверяем что элемент больше не в watchlist
            watchlist = await getWatchlist(userId, mediaType);
            inWatchlist = watchlist.some(i => i.tmdb_id === tmdbId);
            assert.strictEqual(inWatchlist, false, 
              'Item should not be in watchlist after move');
            
            // Проверяем что элемент в списке
            const listItems = await getListItems(list.id);
            const inList = listItems.some(i => i.tmdb_id === tmdbId);
            assert.ok(inList, 'Item should be in list after move');
            
            // Проверяем что элемент находится только в списке (не в watchlist)
            watchlist = await getWatchlist(userId);
            const stillInWatchlist = watchlist.some(i => i.tmdb_id === tmdbId);
            assert.strictEqual(stillInWatchlist, false,
              'Item should not remain in watchlist after movement to list');
            
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
