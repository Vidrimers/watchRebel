import React from 'react';
import styles from './MediaTypeToggle.module.css';

/**
 * Компонент переключателя типа медиа (Фильмы/Сериалы)
 * 
 * @param {Object} props
 * @param {string} props.mediaType - Текущий выбранный тип ('movie' или 'tv')
 * @param {Function} props.onChange - Callback при изменении типа
 */
const MediaTypeToggle = ({ mediaType, onChange }) => {
  return (
    <div className={styles.toggleContainer}>
      <button
        className={`${styles.toggleButton} ${mediaType === 'movie' ? styles.active : ''}`}
        onClick={() => onChange('movie')}
        aria-label="Фильмы"
      >
        Фильмы
      </button>
      <button
        className={`${styles.toggleButton} ${mediaType === 'tv' ? styles.active : ''}`}
        onClick={() => onChange('tv')}
        aria-label="Сериалы"
      >
        Сериалы
      </button>
    </div>
  );
};

export default MediaTypeToggle;
