import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { createReview, updateReview, deleteReview } from '../../store/slices/reviewsSlice';
import styles from './ReviewEditor.module.css';

/**
 * Компонент для создания и редактирования отзывов на фильмы/сериалы
 * Отзыв можно оставить только если фильм добавлен в список
 */
const ReviewEditor = ({ 
  media, 
  isInList = false, 
  currentRating = null,
  existingReview = null,
  onReviewPublished,
  onReviewDeleted
}) => {
  const dispatch = useDispatch();
  const [isEditing, setIsEditing] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Инициализация текста отзыва если есть существующий
  useEffect(() => {
    if (existingReview && existingReview.content) {
      // Парсим content: первая строка - название фильма, остальное - текст отзыва
      const lines = existingReview.content.split('\n');
      const reviewTextOnly = lines.slice(1).join('\n').trim();
      setReviewText(reviewTextOnly);
    }
  }, [existingReview]);

  // Обработка изменения текста
  const handleTextChange = (e) => {
    const text = e.target.value;
    setReviewText(text);
    setError(null);
  };

  // Валидация отзыва
  const validateReview = () => {
    const trimmed = reviewText.trim();
    
    if (trimmed.length < 10) {
      setError('Отзыв должен содержать минимум 10 символов');
      return false;
    }
    
    if (trimmed.length > 5000) {
      setError('Отзыв не может быть длиннее 5000 символов');
      return false;
    }
    
    return true;
  };

  // Публикация отзыва
  const handlePublish = async () => {
    if (!validateReview()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      if (existingReview) {
        // Обновление существующего отзыва
        await dispatch(updateReview({
          reviewId: existingReview.id,
          tmdbId: media.tmdbId,
          mediaType: media.mediaType,
          reviewText: reviewText.trim(),
          rating: currentRating
        })).unwrap();
      } else {
        // Создание нового отзыва
        await dispatch(createReview({
          tmdbId: media.tmdbId,
          mediaType: media.mediaType,
          reviewText: reviewText.trim(),
          rating: currentRating
        })).unwrap();
      }

      setIsEditing(false);
      
      if (onReviewPublished) {
        onReviewPublished();
      }
    } catch (err) {
      console.error('Ошибка при сохранении отзыва:', err);
      setError(err.message || 'Ошибка при сохранении отзыва');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Удаление отзыва
  const handleDelete = async () => {
    if (!existingReview) return;

    const confirmed = window.confirm('Вы уверены, что хотите удалить отзыв?');
    if (!confirmed) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await dispatch(deleteReview({
        reviewId: existingReview.id
      })).unwrap();

      setReviewText('');
      setIsEditing(false);

      if (onReviewDeleted) {
        onReviewDeleted();
      }
    } catch (err) {
      console.error('Ошибка при удалении отзыва:', err);
      setError(err.message || 'Ошибка при удалении отзыва');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Отмена редактирования
  const handleCancel = () => {
    if (existingReview && existingReview.content) {
      // Парсим content: первая строка - название фильма, остальное - текст отзыва
      const lines = existingReview.content.split('\n');
      const reviewTextOnly = lines.slice(1).join('\n').trim();
      setReviewText(reviewTextOnly);
    } else {
      setReviewText('');
    }
    setIsEditing(false);
    setError(null);
  };

  // Подсчет символов
  const charCount = reviewText.length;
  const minChars = 10;
  const maxChars = 5000;
  const isValidLength = charCount >= minChars && charCount <= maxChars;

  // Если есть существующий отзыв и не редактируем - показываем его
  if (existingReview && !isEditing) {
    // Парсим content: первая строка - название фильма, остальное - текст отзыва
    const lines = existingReview.content ? existingReview.content.split('\n') : [];
    const reviewTextOnly = lines.slice(1).join('\n').trim();
    
    return (
      <div className={styles.reviewDisplay}>
        <div className={styles.reviewHeader}>
          <h3 className={styles.reviewTitle}>Ваш отзыв</h3>
          <div className={styles.reviewActions}>
            <button
              className={styles.editButton}
              onClick={() => setIsEditing(true)}
              disabled={isSubmitting}
            >
              ✏️ Изменить
            </button>
            <button
              className={styles.deleteButton}
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              🗑️ Удалить
            </button>
          </div>
        </div>
        
        <div className={styles.reviewContent}>
          {reviewTextOnly}
        </div>

        {existingReview.editedAt && (
          <div className={styles.editedLabel}>
            Отредактировано {new Date(existingReview.editedAt).toLocaleDateString('ru-RU')}
          </div>
        )}
      </div>
    );
  }

  // Если не в списке - показываем предупреждение
  if (!isInList) {
    return (
      <div className={styles.reviewEditor}>
        <button
          className={`${styles.addReviewButton} ${styles.disabled}`}
          disabled
          title="Добавьте в список, чтобы написать отзыв"
        >
          📝 Добавить отзыв
        </button>
        <div className={styles.warningMessage}>
          Добавьте фильм в список, чтобы написать отзыв
        </div>
      </div>
    );
  }

  // Если не редактируем и нет отзыва - показываем кнопку
  if (!isEditing && !existingReview) {
    return (
      <div className={styles.reviewEditor}>
        <button
          className={styles.addReviewButton}
          onClick={() => setIsEditing(true)}
        >
          📝 Добавить отзыв
        </button>
      </div>
    );
  }

  // Режим редактирования
  return (
    <div className={styles.reviewEditor}>
      <div className={styles.editorHeader}>
        <h3 className={styles.editorTitle}>
          {existingReview ? 'Редактировать отзыв' : 'Написать отзыв'}
        </h3>
      </div>

      <textarea
        className={styles.reviewTextarea}
        value={reviewText}
        onChange={handleTextChange}
        placeholder="Поделитесь своими впечатлениями о фильме/сериале..."
        disabled={isSubmitting}
        maxLength={maxChars}
      />

      <div className={styles.editorFooter}>
        <div className={styles.charCounter}>
          <span className={!isValidLength ? styles.invalid : ''}>
            {charCount} / {maxChars}
          </span>
          {charCount < minChars && (
            <span className={styles.minCharsHint}>
              (минимум {minChars} символов)
            </span>
          )}
        </div>

        <div className={styles.editorActions}>
          <button
            className={styles.cancelButton}
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Отмена
          </button>
          <button
            className={styles.publishButton}
            onClick={handlePublish}
            disabled={isSubmitting || !isValidLength}
          >
            {isSubmitting ? 'Публикация...' : 'Опубликовать'}
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}
    </div>
  );
};

export default ReviewEditor;
