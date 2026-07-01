import React, { useEffect, useRef } from 'react';
import Icon from '../Common/Icon';
import styles from './AttachmentDropdown.module.css';

const AttachmentDropdown = ({ onSelect, onClose, isGroup }) => {
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div className={styles.dropdown} ref={ref}>
      <button className={styles.item} onClick={() => onSelect('file')}>
        <Icon name="paperclip" size="small" />
        <span>Файл</span>
      </button>
      <button className={styles.item} onClick={() => onSelect('image')}>
        <Icon name="image" size="small" />
        <span>Изображение</span>
      </button>
      <button className={styles.item} onClick={() => onSelect('location')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <span>Геометка</span>
      </button>
      <button className={styles.item} onClick={() => onSelect('suggest_movie')}>
        <Icon name="movies" size="small" />
        <span>Предложить фильм</span>
      </button>
      <button className={styles.item} onClick={() => onSelect('suggest_series')}>
        <Icon name="tv" size="small" />
        <span>Предложить сериал</span>
      </button>
      {isGroup && (
        <button className={styles.item} onClick={() => onSelect('announcement')}>
          <Icon name="announcement" size="small" />
          <span>Объявление</span>
        </button>
      )}
    </div>
  );
};

export default AttachmentDropdown;
