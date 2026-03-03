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
  const [imageMetadata, setImageMetadata] = useState(null);

  // Обновляем индекс при изменении startIndex
  useEffect(() => {
    setCurrentIndex(startIndex);
  }, [startIndex]);

  // Загружаем метаданные изображения
  useEffect(() => {
    if (!isOpen || !images || images.length === 0) return;

    const currentImage = images[currentIndex];
    const img = new Image();
    
    img.onload = () => {
      setImageMetadata({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    
    img.src = `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${currentImage.url}`;

    // Получаем размер файла
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${currentImage.url}`)
      .then(response => {
        const size = response.headers.get('content-length');
        if (size) {
          setImageMetadata(prev => ({
            ...prev,
            size: parseInt(size)
          }));
        }
      })
      .catch(err => console.error('Ошибка получения размера файла:', err));
  }, [currentIndex, isOpen, images]);

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

  // Обработка скролла мышкой для переключения изображений
  useEffect(() => {
    if (!isOpen) return;

    const handleWheel = (e) => {
      e.preventDefault();
      
      if (e.deltaY > 0) {
        // Скролл вниз - следующее изображение
        handleNext();
      } else if (e.deltaY < 0) {
        // Скролл вверх - предыдущее изображение
        handlePrevious();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
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

  // Форматирование размера файла
  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
  };

  // Форматирование разрешения
  const formatResolution = () => {
    if (!imageMetadata?.width || !imageMetadata?.height) return '';
    return `${imageMetadata.width}×${imageMetadata.height}`;
  };

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
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Кнопка закрытия */}
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>

        {/* Основная область с изображением */}
        <div className={styles.imageArea} onClick={onClose}>
          {/* Стрелки и изображение - останавливаем всплытие */}
          <div onClick={(e) => e.stopPropagation()}>
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
              <div className={styles.imageInfo}>
                <div className={styles.imageCounter}>
                  {currentIndex + 1} / {images.length}
                </div>
                {imageMetadata && (
                  <div className={styles.imageMetadata}>
                    {formatResolution() && <span>{formatResolution()}</span>}
                    {formatResolution() && imageMetadata.size && <span className={styles.separator}>•</span>}
                    {imageMetadata.size && <span>{formatFileSize(imageMetadata.size)}</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Стрелка вправо */}
            {currentIndex < images.length - 1 && (
              <button className={`${styles.navButton} ${styles.navButtonRight}`} onClick={handleNext}>
                ›
              </button>
            )}
          </div>
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
