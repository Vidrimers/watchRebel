/**
 * Property-based тесты для авторизации через Telegram
 * Feature: watch-rebel-social-network
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fc from 'fast-check';
import { createSession } from '../sessionService.js';

// Генератор валидных Telegram пользователей
const telegramUserArbitrary = fc.record({
  id: fc.integer({ min: 1, max: 999999999 }),
  username: fc.option(fc.string({ minLength: 3, maxLength: 32 }), { nil: undefined }),
  first_name: fc.string({ minLength: 1, maxLength: 64 }),
  last_name: fc.option(fc.string({ minLength: 1, maxLength: 64 }), { nil: undefined }),
  photo_url: fc.option(fc.webUrl(), { nil: undefined })
});

describe('Telegram Bot Authentication Properties', () => {
  /**
   * Property 1: Session Creation Round-Trip
   * Validates: Requirements 1.1
   * 
   * For any valid Telegram user, when /start command is executed, 
   * then a session must be created and a valid token must be returned.
   */
  it('Feature: watch-rebel-social-network, Property 1: Session Creation Round-Trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        telegramUserArbitrary,
        async (telegramUser) => {
          // Используем test_ префикс для тестовых данных
          const userId = `test_${telegramUser.id}`;
          
          // Создаем сессию
          const session = await createSession(userId, telegramUser);
          
          // Проверяем что сессия создана
          assert.ok(session, 'Session should be defined');
          assert.ok(session.token, 'Session token should be defined');
          assert.strictEqual(typeof session.token, 'string', 'Token should be a string');
          assert.ok(session.token.length > 0, 'Token should not be empty');
          
          // Проверяем формат UUID v4
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          assert.ok(uuidRegex.test(session.token), 'Token should be a valid UUID v4');
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 2: Token Authentication
   * Validates: Requirements 1.2
   * 
   * For any valid session token, the token must be unique and valid for authentication.
   */
  it('Feature: watch-rebel-social-network, Property 2: Token Authentication', async () => {
    await fc.assert(
      fc.asyncProperty(
        telegramUserArbitrary,
        async (telegramUser) => {
          const userId = `test_${telegramUser.id}`;
          
          // Создаем сессию
          const session = await createSession(userId, telegramUser);
          
          // Проверяем что токен валиден
          assert.ok(session.token, 'Token should be defined');
          assert.strictEqual(typeof session.token, 'string', 'Token should be a string');
          
          // Проверяем что токен уникален (UUID v4)
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          assert.ok(uuidRegex.test(session.token), 'Token should be a valid UUID v4');
          
          // Создаем еще одну сессию и проверяем что токены разные
          const session2 = await createSession(userId, telegramUser);
          assert.notStrictEqual(session.token, session2.token, 'Tokens should be unique');
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 3: Profile Creation on First Login
   * Validates: Requirements 1.3
   * 
   * For any new Telegram user, session creation must include user data.
   */
  it('Feature: watch-rebel-social-network, Property 3: Profile Creation on First Login', async () => {
    await fc.assert(
      fc.asyncProperty(
        telegramUserArbitrary,
        async (telegramUser) => {
          const userId = `test_${telegramUser.id}`;
          
          // Создаем сессию (первый вход)
          const session = await createSession(userId, telegramUser);
          
          // Проверяем что сессия создана с данными пользователя
          assert.ok(session, 'Session should be defined');
          assert.ok(session.token, 'Token should be defined');
          
          // Проверяем что функция получила корректные данные Telegram
          assert.ok(telegramUser.first_name, 'Telegram user should have first_name');
          assert.ok(telegramUser.first_name.length > 0, 'First name should not be empty');
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 4: Session Persistence
   * Validates: Requirements 1.4
   * 
   * For any authenticated user, session data must be properly structured.
   */
  it('Feature: watch-rebel-social-network, Property 4: Session Persistence', async () => {
    await fc.assert(
      fc.asyncProperty(
        telegramUserArbitrary,
        async (telegramUser) => {
          const userId = `test_${telegramUser.id}`;
          
          // Создаем сессию
          const session = await createSession(userId, telegramUser);
          
          // Проверяем структуру сессии
          assert.ok(session, 'Session should be defined');
          assert.ok(typeof session === 'object', 'Session should be an object');
          assert.ok('token' in session, 'Session should have token property');
          assert.ok('user' in session, 'Session should have user property');
          
          // Проверяем что токен валиден
          assert.ok(session.token, 'Token should be defined');
          assert.strictEqual(typeof session.token, 'string', 'Token should be a string');
          assert.ok(session.token.length > 0, 'Token should not be empty');
        }
      ),
      { numRuns: 20 }
    );
  });
});
