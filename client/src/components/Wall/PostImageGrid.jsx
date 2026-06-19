import React, { useState } from 'react';
import styles from './PostImageGrid.module.css';

/**
 * Компонент для отображения изображений в посте
 * Адаптивная сетка в зависимости от количества изображений
 * 
 * @param {Array} images - Массив изображений [{id, url, order}]
 * @param {Function} onImageClick - Callback при клике на изображение
 */
const PostImageGrid = ({ images, onImageClick }) => {
  const [imageOrientations, setImageOrientations] = useState({});

  if (!images || images.length === 0) {
    return null;
  }

  const imageCount = images.length;

  // Определяем класс сетки в зависимости от количества изображений
  const getGridClass = () => {
    if (imageCount === 1) return styles.grid1;
    if (imageCount === 2) return styles.grid2;
    if (imageCount === 3) return styles.grid3;
    if (imageCount === 4) return styles.grid4;
    return styles.grid5plus;
  };

  // Обработчик загрузки изображения для определения ориентации
  const handleImageLoad = (imageId, event) => {
    const img = event.target;
    const isPortrait = img.naturalHeight > img.naturalWidth;
    setImageOrientations(prev => ({
      ...prev,
      [imageId]: isPortrait ? 'portrait' : 'landscape'
    }));
  };

  // Для 5+ изображений показываем только первые 5, остальные скрываем с индикатором
  const displayImages = imageCount > 5 ? images.slice(0, 5) : images;
  const hiddenCount = imageCount > 5 ? imageCount - 5 : 0;

  return (
    <div className={`${styles.imageGrid} ${getGridClass()}`}>
      {displayImages.map((image, index) => {
        const orientation = imageOrientations[image.id] || 'landscape';
        const orientationClass = imageCount === 1 
          ? styles.single 
          : (orientation === 'portrait' ? styles.portrait : styles.landscape);

        return (
          <div
            key={image.id}
            className={`${styles.imageWrapper} ${orientationClass}`}
            onClick={() => onImageClick(index)}
          >
            <img
              src={`${import.meta.env.VITE_API_URL || ''}${image.url}`}
              alt={`Изображение ${index + 1}`}
              className={styles.image}
              onLoad={(e) => handleImageLoad(image.id, e)}
            />
            {/* Показываем индикатор "+N" на последнем изображении если есть скрытые */}
            {index === 4 && hiddenCount > 0 && (
              <div className={styles.moreOverlay}>
                <span className={styles.moreText}>+{hiddenCount}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PostImageGrid;
