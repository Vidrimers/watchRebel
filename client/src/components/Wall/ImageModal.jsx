import React, { useEffect } from 'react';
import styles from './ImageModal.module.css';

/**
 * Простая модалка для просмотра изображения на весь экран
 * 
 * @param {string} imageUrl - URL изображения
 * @param {string} alt - Альтернативный текст
 * @param {boolean} isOpen - Открыта ли модалка
 * @param {Function} onClose - Callback для закрытия
 */
const ImageModal = ({ imageUrl, alt = 'Изображение', isOpen, onClose }) => {
  // Обработка клавиши Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Блокировка скролла body при открытой модалке
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Кнопка закрытия */}
        <button className={styles.closeButton} onClick={onClose} title="Закрыть (Esc)">
          ×
        </button>

        {/* Изображение */}
        <img
          src={imageUrl}
          alt={alt}
          className={styles.image}
          onClick={onClose}
        />
      </div>
    </div>
  );
};

export default ImageModal;
