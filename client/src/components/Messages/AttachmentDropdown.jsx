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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <span>Изображение</span>
      </button>
    </div>
  );
};

export default AttachmentDropdown;
