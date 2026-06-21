import React, { useState, useRef, useEffect } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { setTheme } from '../../store/slices/themeSlice';
import styles from './ThemeDropdown.module.css';

/**
 * Компонент выпадающего меню для выбора темы оформления
 * Заменяет список радио-кнопок на компактный dropdown
 */
const ThemeDropdown = ({ embedded = false }) => {
  const dispatch = useAppDispatch();
  const { theme } = useAppSelector((state) => state.theme);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

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
      value: 'material-light',
      label: 'Material Light',
      icon: '🎨',
      colors: ['#ffffff', '#1976d2', '#d32f2f']
    },
    {
      value: 'material-dark',
      label: 'Material Dark',
      icon: '🌐',
      colors: ['#121212', '#90caf9', '#ef5350']
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

  // Находим текущую выбранную тему
  const currentTheme = themes.find(t => t.value === theme) || themes[0];

  // Обработчик выбора темы
  const handleThemeSelect = (themeValue) => {
    dispatch(setTheme(themeValue));
    setIsOpen(false);
  };

  // Закрытие dropdown при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={embedded ? '' : styles.themeSelectorCard}>
      {!embedded && <h3 className={styles.cardTitle}>Тема оформления</h3>}
      
      <div className={styles.dropdownContainer} ref={dropdownRef}>
        {/* Кнопка для открытия dropdown */}
        <button
          className={styles.dropdownButton}
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span className={styles.selectedTheme}>
            <span className={styles.themeIcon}>{currentTheme.icon}</span>
            <span className={styles.themeName}>{currentTheme.label}</span>
            <span className={styles.themePreview}>
              {currentTheme.colors.map((color, index) => (
                <span
                  key={index}
                  className={styles.colorDot}
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>
          </span>
          <span className={`${styles.arrow} ${isOpen ? styles.arrowUp : ''}`}>
            ▼
          </span>
        </button>

        {/* Выпадающий список тем */}
        {isOpen && (
          <div className={styles.dropdownMenu} role="listbox">
            {themes.map((themeOption) => (
              <button
                key={themeOption.value}
                className={`${styles.dropdownItem} ${
                  theme === themeOption.value ? styles.active : ''
                }`}
                onClick={() => handleThemeSelect(themeOption.value)}
                role="option"
                aria-selected={theme === themeOption.value}
              >
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
                {theme === themeOption.value && (
                  <span className={styles.checkmark}>✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ThemeDropdown;
