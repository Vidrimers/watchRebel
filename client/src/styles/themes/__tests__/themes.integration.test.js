/**
 * Интеграционный тест для проверки всех тем
 * Проверяет, что все темы правильно определены и могут быть применены
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Список всех тем, которые должны существовать
const expectedThemes = [
  'light-cream',
  'dark',
  'material-light',
  'material-dark',
  'die-my-darling',
  'steam',
  'discord',
  'metal-and-glass',
  'cyberpunk',
  'dark-neon-obsidian'
];

// Обязательные CSS переменные, которые должны быть в каждой теме
const requiredVariables = [
  '--bg-primary',
  '--bg-secondary',
  '--text-primary',
  '--text-secondary',
  '--accent-primary',
  '--border-color',
  '--shadow-sm'
];

describe('Theme Files Integration Tests', () => {
  it('All theme files should exist', () => {
    const themesDir = path.join(__dirname, '..');
    
    for (const theme of expectedThemes) {
      const themeFile = path.join(themesDir, `${theme}.css`);
      const exists = fs.existsSync(themeFile);
      
      assert.ok(
        exists,
        `Theme file ${theme}.css should exist`
      );
    }
  });

  it('All theme files should contain required CSS variables', () => {
    const themesDir = path.join(__dirname, '..');
    
    for (const theme of expectedThemes) {
      const themeFile = path.join(themesDir, `${theme}.css`);
      const content = fs.readFileSync(themeFile, 'utf-8');
      
      for (const variable of requiredVariables) {
        assert.ok(
          content.includes(variable),
          `Theme ${theme} should contain CSS variable ${variable}`
        );
      }
    }
  });

  it('All theme files should have proper data-theme selector', () => {
    const themesDir = path.join(__dirname, '..');
    
    for (const theme of expectedThemes) {
      const themeFile = path.join(themesDir, `${theme}.css`);
      const content = fs.readFileSync(themeFile, 'utf-8');
      
      // Проверяем, что есть селектор [data-theme="theme-name"] или :root для light-cream
      const hasSelector = 
        content.includes(`[data-theme="${theme}"]`) ||
        (theme === 'light-cream' && content.includes(':root'));
      
      assert.ok(
        hasSelector,
        `Theme ${theme} should have proper data-theme selector`
      );
    }
  });

  it('index.css should import all theme files', () => {
    const indexCssPath = path.join(__dirname, '../../..', 'index.css');
    const content = fs.readFileSync(indexCssPath, 'utf-8');
    
    for (const theme of expectedThemes) {
      const importStatement = `@import './styles/themes/${theme}.css'`;
      
      assert.ok(
        content.includes(importStatement),
        `index.css should import ${theme}.css`
      );
    }
  });
});

describe('ThemeSelector Component Integration', () => {
  it('ThemeSelector should include all themes', () => {
    const themeSelectorPath = path.join(
      __dirname,
      '../../../components/Settings/ThemeSelector.jsx'
    );
    const content = fs.readFileSync(themeSelectorPath, 'utf-8');
    
    for (const theme of expectedThemes) {
      assert.ok(
        content.includes(`'${theme}'`) || content.includes(`"${theme}"`),
        `ThemeSelector should include theme ${theme}`
      );
    }
  });
});
