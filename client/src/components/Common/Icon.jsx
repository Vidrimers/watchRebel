import React from 'react';
import PropTypes from 'prop-types';
import styles from './Icon.module.css';

/**
 * Компонент для отображения SVG иконок из sprite файла
 * 
 * @param {string} name - Название иконки (без префикса icon-)
 * @param {string} size - Размер: 'small' (16px), 'medium' (24px), 'large' (32px)
 * @param {string} color - Цвет иконки (CSS color)
 * @param {string} className - Дополнительный CSS класс
 * @param {object} props - Остальные props для svg элемента
 */
const Icon = ({ name, size = 'medium', color, className = '', ...props }) => {
  // Маппинг размеров
  const sizeMap = {
    small: 16,
    medium: 24,
    large: 32
  };

  const iconSize = typeof size === 'number' ? size : sizeMap[size] || 24;

  // Fallback эмодзи если иконка не найдена
  const emojiMap = {
    feed: '📰',
    friends: '👥',
    messages: '💬',
    catalog: '📚',
    movies: '🎬',
    tv: '📺',
    watchlist: '⭐',
    settings: '⚙️',
    notifications: '🔔',
    heart: '❤️',
    user: '👤',
    message: '💬',
    bell: '🔔',
    telegram: '✈️',
    email: '📧',
    google: '🔍',
    discord: '💬',
    search: '🔍',
    star: '⭐',
    paperclip: '📎',
    add: '➕',
    remove: '➖',
    edit: '✏️',
    delete: '🗑️',
    close: '✕',
    announcement: '📢',
    pin: '📍',
    pinned: '📌'
  };

  const iconId = `icon-${name}`;

  // Автоматически добавляем брендовые классы для соцсетей
  const brandClasses = {
    telegram: styles.telegram,
    discord: styles.discord,
    google: styles.google
  };

  const brandClass = brandClasses[name] || '';

  const svgStyle = {
    ...(color && { color }),
    width: iconSize,
    height: iconSize
  };

  return (
    <svg
      className={`${styles.icon} ${styles[size]} ${brandClass} ${className}`}
      style={svgStyle}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <use href={`#${iconId}`} xlinkHref={`#${iconId}`} />
    </svg>
  );
};

Icon.propTypes = {
  name: PropTypes.string.isRequired,
  size: PropTypes.oneOfType([
    PropTypes.oneOf(['small', 'medium', 'large']),
    PropTypes.number
  ]),
  color: PropTypes.string,
  className: PropTypes.string
};

export default Icon;
