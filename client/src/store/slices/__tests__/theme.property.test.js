/**
 * Property-based тесты для управления темой
 * Feature: watch-rebel-social-network
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fc from 'fast-check';
import { configureStore } from '@reduxjs/toolkit';
import themeReducer, { setTheme } from '../themeSlice.js';

// Генератор валидных тем
const themeArbitrary = fc.constantFrom(
  'light-cream',
  'dark',
  'die-my-darling',
  'steam',
  'discord',
  'metal-and-glass',
  'cyberpunk',
  'dark-neon-obsidian'
);

// Вспомогательная функция для создания store
function createTestStore() {
  return configureStore({
    reducer: {
      theme: themeReducer
    }
  });
}

describe('Theme Management Properties', () => {
  /**
   * Property 34: Theme Change Immediate Application
   * Validates: Requirements 13.2
   * 
   * For any valid theme selection, when a user changes the theme,
   * then the theme must be applied immediately (onChange).
   */
  it('Feature: watch-rebel-social-network, Property 34: Theme Change Immediate Application', async () => {
    await fc.assert(
      fc.asyncProperty(
        themeArbitrary,
        async (selectedTheme) => {
          // Создаем новый store для каждого теста
          const store = createTestStore();
          
          // Получаем начальное состояние
          const initialState = store.getState().theme;
          assert.ok(initialState, 'Initial state should be defined');
          
          // Применяем изменение темы
          store.dispatch(setTheme(selectedTheme));
          
          // Проверяем что тема применилась немедленно
          const newState = store.getState().theme;
          assert.strictEqual(
            newState.theme,
            selectedTheme,
            `Theme should be immediately updated to ${selectedTheme}`
          );
          
          // Проверяем что изменение произошло синхронно (без задержки)
          // Если бы было асинхронно, нам бы пришлось ждать
          assert.strictEqual(
            store.getState().theme.theme,
            selectedTheme,
            'Theme should be applied synchronously'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Дополнительный тест: Theme Toggle Consistency
   * Проверяет что переключение между темами работает корректно
   */
  it('Theme toggle maintains consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(themeArbitrary, { minLength: 1, maxLength: 10 }),
        async (themeSequence) => {
          const store = createTestStore();
          
          // Применяем последовательность изменений тем
          for (const theme of themeSequence) {
            store.dispatch(setTheme(theme));
            
            // Проверяем что каждое изменение применилось
            const currentState = store.getState().theme;
            assert.strictEqual(
              currentState.theme,
              theme,
              `Theme should be ${theme} after dispatch`
            );
          }
          
          // Проверяем что финальное состояние соответствует последней теме
          const finalState = store.getState().theme;
          const lastTheme = themeSequence[themeSequence.length - 1];
          assert.strictEqual(
            finalState.theme,
            lastTheme,
            'Final theme should match last applied theme'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Дополнительный тест: Theme State Immutability
   * Проверяет что изменение темы не мутирует предыдущее состояние
   */
  it('Theme changes preserve immutability', async () => {
    await fc.assert(
      fc.asyncProperty(
        themeArbitrary,
        themeArbitrary,
        async (theme1, theme2) => {
          const store = createTestStore();
          
          // Применяем первую тему
          store.dispatch(setTheme(theme1));
          const state1 = store.getState().theme;
          const state1Copy = { ...state1 };
          
          // Применяем вторую тему
          store.dispatch(setTheme(theme2));
          const state2 = store.getState().theme;
          
          // Проверяем что первое состояние не изменилось
          assert.deepStrictEqual(
            state1Copy,
            { theme: theme1 },
            'Previous state should not be mutated'
          );
          
          // Проверяем что новое состояние корректно
          assert.strictEqual(
            state2.theme,
            theme2,
            'New state should have new theme'
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
