import React from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { setTheme } from '../../store/slices/themeSlice';
import styles from './ThemeSelector.module.css';

/**
 * Компонент выбора темы оформления
 * Позволяет переключаться между различными темами
 */
const ThemeSelector = () => {
  const dispatch = useAppDispatch();
  const { theme } = useAppSelector((state) => state.theme);

  const handleThemeChange = (e) => {
    const newTheme = e.target.value;
    // Тема применяется автоматически в themeSlice через setTheme
    dispatch(setTheme(newTheme));
  };

  // Список доступных тем с превью цветов
  const themes = [
    {
      value: 'light-cream',
      label: 'Светлая (кремовая)',
      icon: '☀️',
      colors: ['#f5f5f0', '#6366f1', '#ec4899']
    },
    {
      value: 'dark',
      label: 'Темная',
      icon: '🌙',
      colors: ['#0f0f0f', '#818cf8', '#f472b6']
    },
    {
      value: 'die-my-darling',
      label: 'Die my Darling',
      icon: '🩸',
      colors: ['#0a0000', '#cc0000', '#ff4444']
    },
    {
      value: 'steam',
      label: 'Steam',
      icon: '🎮',
      colors: ['#1b2838', '#66c0f4', '#5c7e10']
    },
    {
      value: 'discord',
      label: 'Discord',
      icon: '💬',
      colors: ['#36393f', '#5865f2', '#3ba55d']
    },
    {
      value: 'metal-and-glass',
      label: 'Metal and Glass',
      icon: '✨',
      colors: ['#1a1d23', '#60a5fa', '#94a3b8']
    },
    {
      value: 'cyberpunk',
      label: 'Cyberpunk',
      icon: '🌃',
      colors: ['#0a0e27', '#f0f', '#0ff']
    },
    {
      value: 'dark-neon-obsidian',
      label: 'Dark Neon Obsidian',
      icon: '💎',
      colors: ['#05060a', '#3cffc4', '#2dd4a8']
    }
  ];

  return (
    <div className={styles.themeSelectorCard}>
      <h3 className={styles.cardTitle}>Тема оформления</h3>
      <div className={styles.themeOptions}>
        {themes.map((themeOption) => (
          <label key={themeOption.value} className={styles.themeOption}>
            <input
              type="radio"
              name="theme"
              value={themeOption.value}
              checked={theme === themeOption.value}
              onChange={handleThemeChange}
            />
            <span className={styles.themeLabel}>
              <span className={styles.themeIcon}>{themeOption.icon}</span>
              <span className={styles.themeName}>{themeOption.label}</span>
              <span className={styles.themePreview}>
                {themeOption.colors.map((color, index) => (
                  <span
                    key={index}
                    className={styles.colorDot}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default ThemeSelector;
