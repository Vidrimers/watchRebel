/**
 * Property-based тесты для управления пользовательскими списками
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

// Вспомогательная функция для получения списков пользователя
async function getUserLists(userId, mediaType = null) {
  let query = 'SELECT * FROM custom_lists WHERE user_id = ?';
  const params = [userId];
  
  if (mediaType) {
    query += ' AND media_type = ?';
    params.push(mediaType);
  }
  
  const result = await executeQuery(query, params);
  return result.success ? result.data : [];
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

// Вспомогательная функция для получения всех элементов пользователя
async function getUserItems(userId, tmdbId, mediaType) {
  const result = await executeQuery(
    `SELECT li.* FROM list_items li
     JOIN custom_lists cl ON li.list_id = cl.id
     WHERE cl.user_id = ? AND li.tmdb_id = ? AND li.media_type = ?`,
    [userId, tmdbId, mediaType]
  );
  return result.success ? result.data : [];
}

// Вспомогательная функция для удаления элемента из списка
async function removeItemFromList(itemId) {
  const result = await executeQuery(
    'DELETE FROM list_items WHERE id = ?',
    [itemId]
  );
  return result.success;
}

// Очистка тестовых данных после каждого теста
async function cleanupTestData(userId) {
  // Удаляем списки пользователя (элементы удалятся автоматически благодаря CASCADE)
  await executeQuery('DELETE FROM custom_lists WHERE user_id = ?', [userId]);
  // Удаляем пользователя
  await executeQuery('DELETE FROM users WHERE id = ?', [userId]);
}

describe('Lists Management Properties', () => {
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
    
    // Даем время на полное закрытие соединения
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  /**
   * Property 6: Custom List Creation Round-Trip
   * Validates: Requirements 3.1
   * 
   * For any user and list name, creating a custom list and then querying user's lists 
   * must include the created list.
   */
  it('Feature: watch-rebel-social-network, Property 6: Custom List Creation Round-Trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        listNameArbitrary,
        mediaTypeArbitrary,
        async (userId, listName, mediaType) => {
          try {
            // Создаем тестового пользователя
            await createTestUser(userId);
            
            // Создаем список
            const list = await createList(userId, listName, mediaType);
            assert.ok(list, 'List should be created');
            assert.ok(list.id, 'List should have an ID');
            
            // Получаем списки пользователя
            const userLists = await getUserLists(userId, mediaType);
            
            // Проверяем что созданный список присутствует
            const found = userLists.find(l => l.id === list.id);
            assert.ok(found, 'Created list should be found in user lists');
            assert.strictEqual(found.name, listName, 'List name should match');
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
   * Property 7: Media Item List Association
   * Validates: Requirements 3.2
   * 
   * For any media item and custom list, adding the item to the list 
   * must create a database association.
   */
  it('Feature: watch-rebel-social-network, Property 7: Media Item List Association', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        listNameArbitrary,
        mediaTypeArbitrary,
        tmdbIdArbitrary,
        async (userId, listName, mediaType, tmdbId) => {
          try {
            // Создаем тестового пользователя
            await createTestUser(userId);
            
            // Создаем список
            const list = await createList(userId, listName, mediaType);
            assert.ok(list, 'List should be created');
            
            // Добавляем элемент в список
            const item = await addItemToList(list.id, tmdbId, mediaType);
            assert.ok(item, 'Item should be added to list');
            assert.ok(item.id, 'Item should have an ID');
            
            // Получаем элементы списка
            const listItems = await getListItems(list.id);
            
            // Проверяем что элемент присутствует
            const found = listItems.find(i => i.tmdb_id === tmdbId);
            assert.ok(found, 'Added item should be found in list');
            assert.strictEqual(found.tmdb_id, tmdbId, 'TMDb ID should match');
            assert.strictEqual(found.media_type, mediaType, 'Media type should match');
            assert.strictEqual(found.list_id, list.id, 'List ID should match');
            
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
   * Property 8: Single List Constraint
   * Validates: Requirements 3.3
   * 
   * For any media item, it can only exist in one custom list at a time 
   * (not in multiple lists simultaneously).
   */
  it('Feature: watch-rebel-social-network, Property 8: Single List Constraint', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        listNameArbitrary,
        listNameArbitrary,
        mediaTypeArbitrary,
        tmdbIdArbitrary,
        async (userId, listName1, listName2, mediaType, tmdbId) => {
          // Убеждаемся что названия списков разные
          if (listName1 === listName2) {
            listName2 = listName2 + '_2';
          }
          
          try {
            // Создаем тестового пользователя
            await createTestUser(userId);
            
            // Создаем два списка
            const list1 = await createList(userId, listName1, mediaType);
            const list2 = await createList(userId, listName2, mediaType);
            assert.ok(list1, 'First list should be created');
            assert.ok(list2, 'Second list should be created');
            
            // Добавляем элемент в первый список
            const item1 = await addItemToList(list1.id, tmdbId, mediaType);
            assert.ok(item1, 'Item should be added to first list');
            
            // Пытаемся добавить тот же элемент во второй список
            // Это должно вернуть null (ошибка), так как элемент уже в другом списке
            const item2 = await addItemToList(list2.id, tmdbId, mediaType);
            assert.strictEqual(item2, null, 
              'Adding item to second list should fail when it already exists in first list');
            
            // Проверяем что элемент находится только в первом списке
            const userItems = await getUserItems(userId, tmdbId, mediaType);
            
            // Элемент должен быть только в одном списке
            assert.strictEqual(userItems.length, 1, 
              'Media item should exist in only one list at a time');
            
            // Проверяем что элемент именно в первом списке
            assert.strictEqual(userItems[0].list_id, list1.id,
              'Media item should remain in the first list');
            
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
   * Property 9: List Item Movement
   * Validates: Requirements 3.6
   * 
   * For any media item in a list, moving it to another list must remove it 
   * from the original list and add it to the target list.
   */
  it('Feature: watch-rebel-social-network, Property 9: List Item Movement', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        listNameArbitrary,
        listNameArbitrary,
        mediaTypeArbitrary,
        tmdbIdArbitrary,
        async (userId, listName1, listName2, mediaType, tmdbId) => {
          // Убеждаемся что названия списков разные
          if (listName1 === listName2) {
            listName2 = listName2 + '_2';
          }
          
          try {
            // Создаем тестового пользователя
            await createTestUser(userId);
            
            // Создаем два списка
            const list1 = await createList(userId, listName1, mediaType);
            const list2 = await createList(userId, listName2, mediaType);
            assert.ok(list1, 'First list should be created');
            assert.ok(list2, 'Second list should be created');
            
            // Добавляем элемент в первый список
            const item1 = await addItemToList(list1.id, tmdbId, mediaType);
            assert.ok(item1, 'Item should be added to first list');
            
            // Проверяем что элемент в первом списке
            let list1Items = await getListItems(list1.id);
            let inList1 = list1Items.some(i => i.tmdb_id === tmdbId);
            assert.ok(inList1, 'Item should be in first list initially');
            
            // Перемещаем элемент во второй список
            // Сначала удаляем из первого списка
            await removeItemFromList(item1.id);
            
            // Затем добавляем во второй список
            const item2 = await addItemToList(list2.id, tmdbId, mediaType);
            assert.ok(item2, 'Item should be added to second list');
            
            // Проверяем что элемент больше не в первом списке
            list1Items = await getListItems(list1.id);
            inList1 = list1Items.some(i => i.tmdb_id === tmdbId);
            assert.strictEqual(inList1, false, 'Item should not be in first list after move');
            
            // Проверяем что элемент во втором списке
            const list2Items = await getListItems(list2.id);
            const inList2 = list2Items.some(i => i.tmdb_id === tmdbId);
            assert.ok(inList2, 'Item should be in second list after move');
            
            // Проверяем что элемент находится только в одном списке
            const userItems = await getUserItems(userId, tmdbId, mediaType);
            assert.strictEqual(userItems.length, 1, 
              'Media item should exist in only one list after movement');
            
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
