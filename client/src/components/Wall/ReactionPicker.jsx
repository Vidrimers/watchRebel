import React, { useEffect, useRef } from 'react';
import styles from './ReactionPicker.module.css';

/**
 * Компонент для выбора эмоджи-реакции
 * Отображает популярные эмоджи для быстрого выбора
 */
const ReactionPicker = ({ onSelect, onClose }) => {
  const pickerRef = useRef(null);

  // Популярные эмоджи для реакций
  const emojis = [
    '❤️', '👍', '😂', '😮', '😢', '😡',
    '🔥', '👏', '🎉', '💯', '🤔', '😍',
    '🤩', '😎', '🥳', '😱', '🤯', '👀'
  ];

  // Закрытие picker при клике вне его области
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Закрытие по Escape
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleEmojiClick = (emoji) => {
    onSelect(emoji);
  };

  return (
    <div className={styles.reactionPicker} ref={pickerRef}>
      <div className={styles.pickerHeader}>
        <span className={styles.pickerTitle}>Выберите реакцию</span>
        <button 
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>
      
      <div className={styles.emojiGrid}>
        {emojis.map((emoji) => (
          <button
            key={emoji}
            className={styles.emojiButton}
            onClick={() => handleEmojiClick(emoji)}
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ReactionPicker;
