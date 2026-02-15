import fc from 'fast-check';
import { executeQuery, getDatabase, closeDatabase } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к тестовой базе данных
const TEST_DB_PATH = path.join(__dirname, '../../../test-rebel.db');

describe('Database Persistence Tests', () => {
  beforeAll(async () => {
    // Удаляем тестовую базу данных если она существует
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    
    // Создаем таблицу users для тестов
    const createTableQuery = `
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
      )
    `;
    
    await executeQuery(createTableQuery);
  });

  afterAll(async () => {
    await closeDatabase();
    // Удаляем тестовую базу данных после тестов
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  beforeEach(async () => {
    // Очищаем таблицу перед каждым тестом
    await executeQuery('DELETE FROM users');
  });

  /**
   * Property 41: Database Persistence
   * Validates: Requirements 16.2
   * 
   * Feature: watch-rebel-social-network, Property 41: Database Persistence
   * 
   * Для любого пользователя, если мы сохраняем его в базу данных,
   * то при последующем запросе мы должны получить те же данные обратно
   */
  test('Property 41: Database Persistence - round trip for user data', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Генератор данных пользователя
        fc.record({
          id: fc.uuid(),
          telegram_username: fc.option(fc.string({ minLength: 3, maxLength: 32 }), { nil: null }),
          display_name: fc.string({ minLength: 1, maxLength: 100 }),
          avatar_url: fc.option(fc.webUrl(), { nil: null }),
          is_admin: fc.boolean(),
          is_blocked: fc.boolean(),
          theme: fc.constantFrom('light-cream', 'dark')
        }),
        async (userData) => {
          // Вставляем пользователя в базу данных
          const insertQuery = `
            INSERT INTO users (id, telegram_username, display_name, avatar_url, is_admin, is_blocked, theme)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `;
          
          const insertResult = await executeQuery(insertQuery, [
            userData.id,
            userData.telegram_username,
            userData.display_name,
            userData.avatar_url,
            userData.is_admin ? 1 : 0,
            userData.is_blocked ? 1 : 0,
            userData.theme
          ]);
          
          // Проверяем, что вставка прошла успешно
          expect(insertResult.success).toBe(true);
          
          // Читаем пользователя из базы данных
          const selectQuery = 'SELECT * FROM users WHERE id = ?';
          const selectResult = await executeQuery(selectQuery, [userData.id]);
          
          // Проверяем, что чтение прошло успешно
          expect(selectResult.success).toBe(true);
          expect(selectResult.data).toHaveLength(1);
          
          const retrievedUser = selectResult.data[0];
          
          // Проверяем, что все поля совпадают (round-trip property)
          expect(retrievedUser.id).toBe(userData.id);
          expect(retrievedUser.telegram_username).toBe(userData.telegram_username);
          expect(retrievedUser.display_name).toBe(userData.display_name);
          expect(retrievedUser.avatar_url).toBe(userData.avatar_url);
          expect(Boolean(retrievedUser.is_admin)).toBe(userData.is_admin);
          expect(Boolean(retrievedUser.is_blocked)).toBe(userData.is_blocked);
          expect(retrievedUser.theme).toBe(userData.theme);
          
          // Проверяем, что created_at и updated_at установлены
          expect(retrievedUser.created_at).toBeDefined();
          expect(retrievedUser.updated_at).toBeDefined();
        }
      ),
      { numRuns: 100 } // Минимум 100 итераций согласно требованиям
    );
  });

  /**
   * Дополнительный тест: проверка обработки ошибок
   */
  test('executeQuery handles errors gracefully', async () => {
    // Попытка вставить пользователя с дублирующимся ID
    const userId = uuidv4();
    const insertQuery = `
      INSERT INTO users (id, display_name)
      VALUES (?, ?)
    `;
    
    // Первая вставка должна пройти успешно
    const result1 = await executeQuery(insertQuery, [userId, 'Test User 1']);
    expect(result1.success).toBe(true);
    
    // Вторая вставка с тем же ID должна вернуть ошибку
    const result2 = await executeQuery(insertQuery, [userId, 'Test User 2']);
    expect(result2.success).toBe(false);
    expect(result2.error).toBeDefined();
  });

  /**
   * Дополнительный тест: проверка UPDATE операций
   */
  test('executeQuery handles UPDATE operations', async () => {
    const userId = uuidv4();
    
    // Вставляем пользователя
    await executeQuery(
      'INSERT INTO users (id, display_name) VALUES (?, ?)',
      [userId, 'Original Name']
    );
    
    // Обновляем имя
    const updateResult = await executeQuery(
      'UPDATE users SET display_name = ? WHERE id = ?',
      ['Updated Name', userId]
    );
    
    expect(updateResult.success).toBe(true);
    expect(updateResult.changes).toBe(1);
    
    // Проверяем, что имя обновилось
    const selectResult = await executeQuery(
      'SELECT display_name FROM users WHERE id = ?',
      [userId]
    );
    
    expect(selectResult.data[0].display_name).toBe('Updated Name');
  });

  /**
   * Дополнительный тест: проверка DELETE операций
   */
  test('executeQuery handles DELETE operations', async () => {
    const userId = uuidv4();
    
    // Вставляем пользователя
    await executeQuery(
      'INSERT INTO users (id, display_name) VALUES (?, ?)',
      [userId, 'Test User']
    );
    
    // Удаляем пользователя
    const deleteResult = await executeQuery(
      'DELETE FROM users WHERE id = ?',
      [userId]
    );
    
    expect(deleteResult.success).toBe(true);
    expect(deleteResult.changes).toBe(1);
    
    // Проверяем, что пользователь удален
    const selectResult = await executeQuery(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );
    
    expect(selectResult.data).toHaveLength(0);
  });
});
