import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { addRating } from '../../store/slices/listsSlice';
import styles from './RatingSelector.module.css';

/**
 * Компонент для выбора рейтинга от 1 до 10
 * При выставлении оценки автоматически создается запись на стене
 */
const RatingSelector = ({ media, currentRating = null, onRatingSet }) => {
  const dispatch = useDispatch();
  const [hoveredRating, setHoveredRating] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Обработка выбора рейтинга
  const handleRatingClick = async (rating) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    
    try {
      // Отправляем рейтинг на сервер
      await dispatch(addRating({
        tmdbId: media.tmdbId,
        mediaType: media.mediaType,
        rating
      })).unwrap();

      // Вызываем callback если передан
      if (onRatingSet) {
        onRatingSet(rating);
      }
    } catch (error) {
      console.error('Ошибка при сохранении рейтинга:', error);
      // Можно добавить отображение ошибки пользователю
    } finally {
      setIsSubmitting(false);
    }
  };

  // Определяем какой рейтинг показывать (текущий, наведенный или null)
  const displayRating = hoveredRating || currentRating;

  return (
    <div className={styles.ratingSelector}>
      <div className={styles.ratingLabel}>
        Ваша оценка: {displayRating ? `${displayRating}/10` : 'не оценено'}
      </div>
      
      <div className={styles.ratingButtons}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
          <button
            key={rating}
            className={`${styles.ratingButton} ${
              displayRating && rating <= displayRating ? styles.active : ''
            } ${currentRating === rating ? styles.selected : ''}`}
            onClick={() => handleRatingClick(rating)}
            onMouseEnter={() => setHoveredRating(rating)}
            onMouseLeave={() => setHoveredRating(null)}
            disabled={isSubmitting}
            title={`Оценить на ${rating}`}
          >
            {rating}
          </button>
        ))}
      </div>

      {isSubmitting && (
        <div className={styles.loadingIndicator}>
          Сохранение...
        </div>
      )}
    </div>
  );
};

export default RatingSelector;
