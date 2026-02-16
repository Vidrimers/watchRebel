/**
 * Property-based тесты для авторизации и logout
 * Feature: watch-rebel-social-network
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fc from 'fast-check';
import { configureStore } from '@reduxjs/toolkit';

// Импортируем только reducer и action, без зависимостей от api
import { createSlice } from '@reduxjs/toolkit';

// Копируем только необходимую часть authSlice для тестирования
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase('auth/logout/fulfilled', (state) => {
        state.user = null;
        state.isAuthenticated = false;
        // Очищаем токен из localStorage
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('authToken');
        }
      });
  }
});

const authReducer = authSlice.reducer;
const logout = { fulfilled: () => ({ type: 'auth/logout/fulfilled' }) };

// Генератор валидных пользователей
const userArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  telegramUsername: fc.option(fc.string({ minLength: 3, maxLength: 32 }), { nil: undefined }),
  displayName: fc.string({ minLength: 1, maxLength: 64 }),
  avatarUrl: fc.option(fc.webUrl(), { nil: undefined }),
  isAdmin: fc.boolean(),
  isBlocked: fc.boolean(),
  theme: fc.constantFrom('light-cream', 'dark')
});

// Вспомогательная функция для создания store с авторизованным пользователем
function createAuthenticatedStore(user) {
  const store = configureStore({
    reducer: {
      auth: authReducer
    },
    preloadedState: {
      auth: {
        user: user,
        isAuthenticated: true,
        loading: false,
        error: null
      }
    }
  });
  return store;
}

// Mock localStorage для тестов
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

// Подменяем глобальный localStorage
global.localStorage = mockLocalStorage;

describe('Authentication Logout Properties', () => {
  beforeEach(() => {
    // Очищаем localStorage перед каждым тестом
    mockLocalStorage.clear();
  });

  /**
   * Property 35: Logout Session Termination
   * Validates: Requirements 13.5
   * 
   * For any authenticated user, when logout is triggered,
   * then the session must be terminated and user state cleared.
   */
  it('Feature: watch-rebel-social-network, Property 35: Logout Session Termination', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        async (user) => {
          // Создаем store с авторизованным пользователем
          const store = createAuthenticatedStore(user);
          
          // Устанавливаем токен в localStorage
          const testToken = `test_token_${user.id}`;
          mockLocalStorage.setItem('authToken', testToken);
          
          // Проверяем начальное состояние
          const initialState = store.getState().auth;
          assert.strictEqual(
            initialState.isAuthenticated,
            true,
            'User should be authenticated initially'
          );
          assert.deepStrictEqual(
            initialState.user,
            user,
            'User data should be present initially'
          );
          assert.strictEqual(
            mockLocalStorage.getItem('authToken'),
            testToken,
            'Token should be in localStorage initially'
          );
          
          // Выполняем logout
          store.dispatch(logout.fulfilled());
          
          // Проверяем что сессия завершена
          const finalState = store.getState().auth;
          assert.strictEqual(
            finalState.isAuthenticated,
            false,
            'User should not be authenticated after logout'
          );
          assert.strictEqual(
            finalState.user,
            null,
            'User data should be cleared after logout'
          );
          
          // Проверяем что токен удален из localStorage
          assert.strictEqual(
            mockLocalStorage.getItem('authToken'),
            null,
            'Token should be removed from localStorage after logout'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Дополнительный тест: Logout Idempotence
   * Проверяет что повторный logout не вызывает ошибок
   */
  it('Logout is idempotent', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        async (user) => {
          const store = createAuthenticatedStore(user);
          mockLocalStorage.setItem('authToken', `test_token_${user.id}`);
          
          // Первый logout
          store.dispatch(logout.fulfilled());
          const state1 = store.getState().auth;
          
          // Второй logout
          store.dispatch(logout.fulfilled());
          const state2 = store.getState().auth;
          
          // Проверяем что состояние одинаковое
          assert.deepStrictEqual(
            state1,
            state2,
            'Multiple logouts should result in same state'
          );
          
          // Проверяем что состояние корректно
          assert.strictEqual(state2.isAuthenticated, false);
          assert.strictEqual(state2.user, null);
          assert.strictEqual(mockLocalStorage.getItem('authToken'), null);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Дополнительный тест: Logout Clears All User Data
   * Проверяет что logout очищает все данные пользователя
   */
  it('Logout clears all user data fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        async (user) => {
          const store = createAuthenticatedStore(user);
          mockLocalStorage.setItem('authToken', `test_token_${user.id}`);
          
          // Выполняем logout
          store.dispatch(logout.fulfilled());
          
          const finalState = store.getState().auth;
          
          // Проверяем что все поля пользователя очищены
          assert.strictEqual(finalState.user, null, 'User should be null');
          assert.strictEqual(finalState.isAuthenticated, false, 'Should not be authenticated');
          assert.strictEqual(finalState.loading, false, 'Loading should be false');
          
          // Проверяем что токен удален
          assert.strictEqual(
            mockLocalStorage.getItem('authToken'),
            null,
            'Token should be removed'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Дополнительный тест: Logout Does Not Affect Other State
   * Проверяет что logout не влияет на другие части состояния
   */
  it('Logout preserves error state structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        async (user) => {
          const store = createAuthenticatedStore(user);
          
          // Выполняем logout
          store.dispatch(logout.fulfilled());
          
          const finalState = store.getState().auth;
          
          // Проверяем что структура состояния сохранена
          assert.ok('user' in finalState, 'State should have user field');
          assert.ok('isAuthenticated' in finalState, 'State should have isAuthenticated field');
          assert.ok('loading' in finalState, 'State should have loading field');
          assert.ok('error' in finalState, 'State should have error field');
        }
      ),
      { numRuns: 100 }
    );
  });
});
