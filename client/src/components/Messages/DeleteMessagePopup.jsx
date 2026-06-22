import React, { useEffect, useRef } from 'react';
import styles from './DeleteMessagePopup.module.css';

const DeleteMessagePopup = ({ 
  isOpen, 
  onClose, 
  onDeleteForMe, 
  onDeleteForEveryone,
  isOwnMessage,
  position 
}) => {
  const popupRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      ref={popupRef}
      className={styles.popup}
      style={position ? { top: position.top, left: position.left } : undefined}
    >
      <button 
        className={styles.option}
        onClick={() => { onDeleteForMe(); onClose(); }}
      >
        Удалить у себя
      </button>
      {isOwnMessage && (
        <button 
          className={`${styles.option} ${styles.danger}`}
          onClick={() => { onDeleteForEveryone(); onClose(); }}
        >
          Удалить у всех
        </button>
      )}
      <button 
        className={styles.cancel}
        onClick={onClose}
      >
        Отмена
      </button>
    </div>
  );
};

export default DeleteMessagePopup;
