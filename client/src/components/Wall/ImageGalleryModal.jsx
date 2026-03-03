import React, { useState, useEffect } from 'react';
import styles from './ImageGalleryModal.module.css';

/**
 * Модальная галерея для просмотра изображений
 * Fullscreen с навигацией и панелью комментариев справа
 * 
 * @param {Array} images - Массив изображений [{id, url, order}]
 * @param {number} startIndex - Индекс изображения для начального отображения
 * @param {boolean} isOpen - Открыта ли галерея
 * @param {Function} onClose - Callback для закрытия галереи
 */
const ImageGalleryModal = ({ images, startIndex = 0, isOpen, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);

  // Обновляем индекс при изменении startIndex
  useEffect(() => {
    setCurrentIndex(startIndex);
  }, [startIndex]);

  // Обработка клавиш клавиатуры
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex]);

  // Блокировка скролла body при открытой галерее
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

  if (!isOpen || !images || images.length === 0) {
    return null;
  }

  const currentImage = images[currentIndex];

  // Переход к предыдущему изображению
  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  // Переход к следующему изображению
  const handleNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : prev));
  };

  // Обработка клика на backdrop
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={handleBackdropClick}>
      <div className={styles.modalContent}>
        {/* Кнопка закрытия */}
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>

        {/* Основная область с изображением */}
        <div className={styles.imageArea}>
          {/* Стрелка влево */}
          {currentIndex > 0 && (
            <button className={styles.navButton} onClick={handlePrevious}>
              ‹
            </button>
          )}

          {/* Изображение */}
          <div className={styles.imageContainer}>
            <img
              src={`${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${currentImage.url}`}
              alt={`Изображение ${currentIndex + 1}`}
              className={styles.image}
            />
            {/* Индикатор текущего изображения */}
            <div className={styles.imageCounter}>
              {currentIndex + 1} / {images.length}
            </div>
          </div>

          {/* Стрелка вправо */}
          {currentIndex < images.length - 1 && (
            <button className={`${styles.navButton} ${styles.navButtonRight}`} onClick={handleNext}>
              ›
            </button>
          )}
        </div>

        {/* Панель комментариев справа */}
        <div className={styles.commentsPanel}>
          <div className={styles.commentsPanelHeader}>
            <h3>Комментарии к фото</h3>
          </div>
          <div className={styles.commentsPanelContent}>
            <p className={styles.commentsPlaceholder}>
              Комментарии к изображениям будут доступны в следующей версии
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageGalleryModal;
