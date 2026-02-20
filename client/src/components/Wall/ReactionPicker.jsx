import React, { useEffect, useRef, useState } from 'react';
import styles from './ReactionPicker.module.css';

/**
 * Компонент для выбора эмоджи-реакции
 * Отображает популярные эмоджи для быстрого выбора
 * Сортирует эмоджи по частоте использования
 */
const ReactionPicker = ({ onSelect, onClose }) => {
  const pickerRef = useRef(null);
  const [sortedEmojis, setSortedEmojis] = useState([]);

  // Все доступные эмоджи для реакций
  const allEmojis = [
    '❤️', '👍', '😂', '😊', '😮', '😢', '😡',
    '🔥', '👏', '🎉', '💯', '🤔', '😍',
    '🤩', '😎', '🥳', '😱', '🤯', '👀',
    '💩', '🤡', '🤮', '😤', '🙄', '😒',
    '👎', '💀', '🤬', '😈'
  ];

  // Загрузка и сортировка эмоджи при монтировании
  useEffect(() => {
    const emojiUsage = JSON.parse(localStorage.getItem('emojiUsage') || '{}');
    
    // Сортируем эмоджи по частоте использования
    const sorted = [...allEmojis].sort((a, b) => {
      const usageA = emojiUsage[a] || 0;
      const usageB = emojiUsage[b] || 0;
      return usageB - usageA; // От большего к меньшему
    });
    
    setSortedEmojis(sorted);
  }, []);

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
    // Обновляем статистику использования
    const emojiUsage = JSON.parse(localStorage.getItem('emojiUsage') || '{}');
    emojiUsage[emoji] = (emojiUsage[emoji] || 0) + 1;
    localStorage.setItem('emojiUsage', JSON.stringify(emojiUsage));
    
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
        {sortedEmojis.map((emoji) => (
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
