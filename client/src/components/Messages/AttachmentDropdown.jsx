import React, { useEffect, useRef } from 'react';
import Icon from '../Common/Icon';
import styles from './AttachmentDropdown.module.css';

const AttachmentDropdown = ({ onSelect, onClose }) => {
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
        <Icon name="media" size="small" />
        <span>Изображение</span>
      </button>
      <button className={styles.item} onClick={() => onSelect('location')}>
        <Icon name="search" size="small" />
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
    </div>
  );
};

export default AttachmentDropdown;
