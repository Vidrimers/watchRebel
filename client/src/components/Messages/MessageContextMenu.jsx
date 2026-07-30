import React, { useEffect, useRef } from 'react';
import styles from './MessageContextMenu.module.css';

const MessageContextMenu = ({ position, onClose, onReply, onForward, onPin, onDelete, isPinned, isOwnMessage, canDelete }) => {
  const menuRef = useRef(null);

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

  // Корректируем позицию чтобы меню не выходило за экран
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

  return (
    <div
      ref={menuRef}
      className={styles.menu}
      style={{ top: position.y, left: position.x }}
    >
      <button className={styles.menuItem} onClick={onReply}>
        <span className={styles.menuIcon}>↩</span>
        <span>Ответить</span>
      </button>
      <button className={styles.menuItem} onClick={onForward}>
        <span className={styles.menuIcon}>↪</span>
        <span>Переслать</span>
      </button>
      <button className={styles.menuItem} onClick={onPin}>
        <span className={styles.menuIcon}>{isPinned ? '📌' : '📌'}</span>
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
