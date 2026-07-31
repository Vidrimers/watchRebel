import React, { useState, useEffect } from 'react';
import styles from './QuickReactionsBar.module.css';

const DEFAULT_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🔥', '🎉'];

const QuickReactionsBar = ({ onSelect, onOpenFullPicker, onClose }) => {
  const [emojis, setEmojis] = useState(DEFAULT_EMOJIS);

  useEffect(() => {
    // Загружаем топ-8 из localStorage по частоте использования
    try {
      const usage = JSON.parse(localStorage.getItem('emojiUsage') || '{}');
      const sorted = Object.entries(usage)
        .sort((a, b) => b[1] - a[1])
        .map(([emoji]) => emoji)
        .slice(0, 8);
      if (sorted.length >= 4) {
        setEmojis(sorted);
      }
    } catch {}
  }, []);

  return (
    <div className={styles.bar}>
      {emojis.map((emoji) => (
        <button
          key={emoji}
          className={styles.emojiBtn}
          onClick={() => onSelect(emoji)}
        >
          {emoji}
        </button>
      ))}
      <button
        className={styles.arrowBtn}
        onClick={onOpenFullPicker}
        title="Все реакции"
      >
        →
      </button>
    </div>
  );
};

export default QuickReactionsBar;
