import React from 'react';
import styles from './PostImageGrid.module.css';

/**
 * Компонент для отображения изображений в посте
 * Адаптивная сетка в зависимости от количества изображений
 * 
 * @param {Array} images - Массив изображений [{id, url, order}]
 * @param {Function} onImageClick - Callback при клике на изображение
 */
const PostImageGrid = ({ images, onImageClick }) => {
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

  // Для 5+ изображений показываем только первые 5, остальные скрываем с индикатором
  const displayImages = imageCount > 5 ? images.slice(0, 5) : images;
  const hiddenCount = imageCount > 5 ? imageCount - 5 : 0;

  return (
    <div className={`${styles.imageGrid} ${getGridClass()}`}>
      {displayImages.map((image, index) => (
        <div
          key={image.id}
          className={styles.imageWrapper}
          onClick={() => onImageClick(index)}
        >
          <img
            src={`${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${image.url}`}
            alt={`Изображение ${index + 1}`}
            className={styles.image}
          />
          {/* Показываем индикатор "+N" на последнем изображении если есть скрытые */}
          {index === 4 && hiddenCount > 0 && (
            <div className={styles.moreOverlay}>
              <span className={styles.moreText}>+{hiddenCount}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default PostImageGrid;
