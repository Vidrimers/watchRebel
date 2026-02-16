import React from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { setTheme } from '../../store/slices/themeSlice';
import styles from './ThemeSelector.module.css';

/**
 * Компонент выбора темы оформления
 * Позволяет переключаться между светлой и темной темой
 */
const ThemeSelector = () => {
  const dispatch = useAppDispatch();
  const { theme } = useAppSelector((state) => state.theme);

  const handleThemeChange = (e) => {
    const newTheme = e.target.value;
    dispatch(setTheme(newTheme));
    
    // Применяем тему к document.body
    document.body.className = newTheme;
  };

  return (
    <div className={styles.themeSelectorCard}>
      <h3 className={styles.cardTitle}>Тема оформления</h3>
      <div className={styles.themeOptions}>
        <label className={styles.themeOption}>
          <input
            type="radio"
            name="theme"
            value="light-cream"
            checked={theme === 'light-cream'}
            onChange={handleThemeChange}
          />
          <span className={styles.themeLabel}>
            <span className={styles.themeIcon}>☀️</span>
            Светлая (кремовая)
          </span>
        </label>
        
        <label className={styles.themeOption}>
          <input
            type="radio"
            name="theme"
            value="dark"
            checked={theme === 'dark'}
            onChange={handleThemeChange}
          />
          <span className={styles.themeLabel}>
            <span className={styles.themeIcon}>🌙</span>
            Темная
          </span>
        </label>
      </div>
    </div>
  );
};

export default ThemeSelector;
