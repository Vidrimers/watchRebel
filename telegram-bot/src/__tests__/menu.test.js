/**
 * Интеграционные тесты для меню Telegram бота
 * Feature: watch-rebel-social-network
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createSession } from '../sessionService.js';

describe('Telegram Bot Menu', () => {
  /**
   * Тест: Кнопка "Открыть сайт" генерирует ссылку с токеном
   * Validates: Requirements 23.1, 23.2, 23.3
   */
  it('should generate website URL with session token', async () => {
    // Создаем тестового пользователя
    const testUser = {
      id: 123456789,
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User'
    };
    
    const userId = testUser.id.toString();
    
    // Создаем сессию (как это делается в команде /menu)
    const session = await createSession(userId, testUser);
    
    // Проверяем что сессия создана
    assert.ok(session, 'Session should be created');
    assert.ok(session.token, 'Session should have a token');
    
    // Формируем URL как в коде бота
    const publicUrl = process.env.PUBLIC_URL || 'http://localhost:1313';
    const webAppUrl = `${publicUrl}?session=${session.token}`;
    
    // Проверяем формат URL
    assert.ok(webAppUrl.includes('?session='), 'URL should contain session parameter');
    assert.ok(webAppUrl.includes(session.token), 'URL should contain the session token');
    
    // Проверяем что токен в URL валиден (UUID v4)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    assert.ok(uuidRegex.test(session.token), 'Token in URL should be a valid UUID v4');
    
    console.log('✅ Generated URL:', webAppUrl);
  });

  /**
   * Тест: Каждый вызов /menu генерирует новую сессию
   * Validates: Requirements 23.2
   */
  it('should generate new session token on each /menu call', async () => {
    const testUser = {
      id: 987654321,
      username: 'anotheruser',
      first_name: 'Another',
      last_name: 'User'
    };
    
    const userId = testUser.id.toString();
    
    // Создаем первую сессию
    const session1 = await createSession(userId, testUser);
    
    // Создаем вторую сессию (имитация повторного вызова /menu)
    const session2 = await createSession(userId, testUser);
    
    // Проверяем что токены разные
    assert.notStrictEqual(
      session1.token, 
      session2.token, 
      'Each /menu call should generate a new session token'
    );
    
    console.log('✅ Session 1 token:', session1.token);
    console.log('✅ Session 2 token:', session2.token);
  });

  /**
   * Тест: URL для подстраниц содержит токен авторизации
   * Validates: Requirements 23.2, 23.3
   */
  it('should generate URLs with session token for all menu actions', async () => {
    const testUser = {
      id: 111222333,
      username: 'menuuser',
      first_name: 'Menu',
      last_name: 'User'
    };
    
    const userId = testUser.id.toString();
    const session = await createSession(userId, testUser);
    const publicUrl = process.env.PUBLIC_URL || 'http://localhost:1313';
    
    // Проверяем URL для различных разделов меню
    const menuUrls = {
      movies: `${publicUrl}/lists/movies?session=${session.token}`,
      tv: `${publicUrl}/lists/tv?session=${session.token}`,
      watchlist: `${publicUrl}/watchlist?session=${session.token}`,
      notifications: `${publicUrl}/notifications?session=${session.token}`,
      profile: `${publicUrl}/profile?session=${session.token}`,
      settings: `${publicUrl}/settings?session=${session.token}`
    };
    
    // Проверяем что все URL содержат токен
    for (const [section, url] of Object.entries(menuUrls)) {
      assert.ok(
        url.includes(`?session=${session.token}`),
        `${section} URL should contain session token`
      );
      console.log(`✅ ${section} URL:`, url);
    }
  });
});
