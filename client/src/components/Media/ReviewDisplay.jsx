import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ReviewDisplay.module.css';

/**
 * Компонент для отображения отзыва другого пользователя
 * Используется на странице фильма с отзывом
 */
const ReviewDisplay = ({ review, media, onGoToMediaPage }) => {
  const navigate = useNavigate();

  if (!review) {
    return null;
  }

  // Форматирование даты
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className={styles.reviewDisplay}>
      <div className={styles.header}>
        <h3 className={styles.title}>Отзыв пользователя</h3>
      </div>

      <div className={styles.authorInfoWrapper}>
        <div className={styles.authorInfo}>
          {review.author?.avatarUrl && (
            <img 
              src={
                review.author.avatarUrl.startsWith('http') 
                  ? review.author.avatarUrl 
                  : `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${review.author.avatarUrl}`
              }
              alt={review.author.displayName}
              className={styles.authorAvatar}
              onClick={() => navigate(`/user/${review.author.userId}`)}
            />
          )}
          <div className={styles.authorDetails}>
            <span 
              className={styles.authorName}
              onClick={() => navigate(`/user/${review.author.userId}`)}
            >
              {review.author?.displayName || 'Пользователь'}
            </span>
            <span className={styles.reviewDate}>
              {formatDate(review.createdAt)}
              {review.editedAt && <span className={styles.edited}> (изменено)</span>}
            </span>
          </div>
        </div>

        {review.rating && (
          <div className={styles.rating}>
            <span className={styles.ratingStars}>★</span>
            <span className={styles.ratingNumber}>{review.rating}/10</span>
          </div>
        )}
      </div>

      <div className={styles.reviewText}>
        {review.reviewText}
      </div>

      <div className={styles.actions}>
        <button
          className={styles.goToMediaButton}
          onClick={onGoToMediaPage}
        >
          Оставить свой отзыв
        </button>
      </div>
    </div>
  );
};

export default ReviewDisplay;
