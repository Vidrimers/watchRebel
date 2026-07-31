import React, { useEffect, useRef, useState } from 'react';
import styles from './MessageContextMenu.module.css';

const DEFAULT_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🔥', '🎉'];

const MessageContextMenu = ({ position, onClose, onReply, onForward, onPin, onDelete, onReaction, onOpenFullPicker, isPinned, isOwnMessage, canDelete }) => {
  const menuRef = useRef(null);
  const [emojis, setEmojis] = useState(DEFAULT_EMOJIS);

  useEffect(() => {
    try {
      const usage = JSON.parse(localStorage.getItem('emojiUsage') || '{}');
      const sorted = Object.entries(usage)
        .sort((a, b) => b[1] - a[1])
        .map(([emoji]) => emoji)
        .slice(0, 8);
      if (sorted.length >= 4) setEmojis(sorted);
    } catch {}
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleScroll = () => onClose();

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;

      if (rect.right > viewportW) {
        menuRef.current.style.left = `${position.x - rect.width}px`;
      }
      if (rect.bottom > viewportH) {
        menuRef.current.style.top = `${position.y - rect.height}px`;
      }
    }
  }, [position]);

  const handleEmojiClick = (emoji) => {
    // Сохраняем частоту использования
    try {
      const usage = JSON.parse(localStorage.getItem('emojiUsage') || '{}');
      usage[emoji] = (usage[emoji] || 0) + 1;
      localStorage.setItem('emojiUsage', JSON.stringify(usage));
    } catch {}
    onReaction(emoji);
    onClose();
  };

  const handleArrowClick = () => {
    onClose();
    setTimeout(() => onOpenFullPicker(), 50);
  };

  return (
    <div
      ref={menuRef}
      className={styles.menu}
      style={{ top: position.y, left: position.x }}
    >
      {/* Блок быстрых реакций */}
      <div className={styles.reactionsBlock}>
        {emojis.map((emoji) => (
          <button
            key={emoji}
            className={styles.reactionBtn}
            onClick={() => handleEmojiClick(emoji)}
          >
            {emoji}
          </button>
        ))}
        <button
          className={styles.reactionArrow}
          onClick={handleArrowClick}
          title="Все реакции"
        >
          →
        </button>
      </div>
      <div className={styles.divider} />

      <button className={styles.menuItem} onClick={onReply}>
        <span className={styles.menuIcon}>↩</span>
        <span>Ответить</span>
      </button>
      <button className={styles.menuItem} onClick={onForward}>
        <span className={styles.menuIcon}>↪</span>
        <span>Переслать</span>
      </button>
      <button className={styles.menuItem} onClick={onPin}>
        <span className={styles.menuIcon}>📌</span>
        <span>{isPinned ? 'Открепить' : 'Закрепить'}</span>
      </button>
      {(isOwnMessage || canDelete) && (
        <>
          <div className={styles.divider} />
          <button className={`${styles.menuItem} ${styles.danger}`} onClick={onDelete}>
            <span className={styles.menuIcon}>🗑</span>
            <span>Удалить</span>
          </button>
        </>
      )}
    </div>
  );
};

export default MessageContextMenu;
