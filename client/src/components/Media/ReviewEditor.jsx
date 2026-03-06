import React, { useState, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../hooks/useAppSelector';
import { createReview, updateReview, deleteReview } from '../../store/slices/reviewsSlice';
import { addReaction } from '../../store/slices/wallSlice';
import ReactionPicker from '../Wall/ReactionPicker';
import ReactionTooltip from '../Wall/ReactionTooltip';
import api from '../../services/api';
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
  const currentUser = useAppSelector((state) => state.auth.user);
  const [isEditing, setIsEditing] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [tooltipData, setTooltipData] = useState(null);
  const tooltipTimeoutRef = useRef(null);
  const [reactions, setReactions] = useState(existingReview?.reactions || []);

  // Инициализация текста отзыва если есть существующий
  useEffect(() => {
    if (existingReview && existingReview.content) {
      // Парсим content: первая строка - название фильма, остальное - текст отзыва
      const lines = existingReview.content.split('\n');
      const reviewTextOnly = lines.slice(1).join('\n').trim();
      setReviewText(reviewTextOnly);
    }
  }, [existingReview]);

  // Обновление реакций при изменении existingReview
  useEffect(() => {
    if (existingReview?.reactions) {
      setReactions(existingReview.reactions);
    }
  }, [existingReview?.reactions]);

  // Подписка на WebSocket обновления реакций
  useEffect(() => {
    if (!existingReview?.id) return;

    const handleWebSocketMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Обновление реакций на пост
        if (data.type === 'reaction_added' && data.postId === existingReview.id) {
          setReactions(prev => [...prev, data.reaction]);
        }
        
        if (data.type === 'reaction_removed' && data.postId === existingReview.id) {
          setReactions(prev => prev.filter(r => r.id !== data.reactionId));
        }
      } catch (error) {
        // Игнорируем ошибки парсинга
      }
    };

    // Подключаемся к WebSocket если есть
    const ws = window.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.addEventListener('message', handleWebSocketMessage);
      
      return () => {
        ws.removeEventListener('message', handleWebSocketMessage);
      };
    }
  }, [existingReview?.id]);

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

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

  // Обработка добавления реакции
  const handleAddReaction = async (emoji) => {
    if (!existingReview) return;
    
    try {
      const result = await dispatch(addReaction({ 
        postId: existingReview.id, 
        emoji 
      })).unwrap();
      setShowReactionPicker(false);
      
      // Обновляем локальные реакции
      // result содержит { postId, reaction: { id, userId, emoji, ... } }
      setReactions(prev => [...prev, {
        id: result.reaction.id,
        userId: currentUser.id,
        emoji: emoji,
        user: {
          displayName: currentUser.displayName,
          avatarUrl: currentUser.avatarUrl
        }
      }]);
    } catch (err) {
      console.error('Ошибка добавления реакции:', err);
    }
  };

  // Обработка удаления реакции
  const handleDeleteReaction = async (reactionId) => {
    if (!existingReview) return;
    
    try {
      await api.delete(`/wall/${existingReview.id}/reactions/${reactionId}`);
      
      // Обновляем локальные реакции
      setReactions(prev => prev.filter(r => r.id !== reactionId));
    } catch (err) {
      console.error('Ошибка удаления реакции:', err);
    }
  };

  // Обработка клика на badge реакции
  const handleReactionBadgeClick = async (reaction) => {
    if (!currentUser || !existingReview) return;

    // Проверяем, есть ли реакция текущего пользователя с таким же эмоджи
    const userReactionWithSameEmoji = reactions.find(
      r => r.userId === currentUser.id && r.emoji === reaction.emoji
    );

    if (userReactionWithSameEmoji) {
      // Удаляем реакцию
      await handleDeleteReaction(userReactionWithSameEmoji.id);
    } else {
      // Добавляем такую же реакцию
      await handleAddReaction(reaction.emoji);
    }
  };

  // Показать tooltip при наведении
  const handleMouseEnter = (e, users) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }

    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipData({
      users,
      position: {
        x: rect.left,
        y: rect.bottom + 5
      }
    });
  };

  // Скрыть tooltip при уходе мыши
  const handleMouseLeave = () => {
    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltipData(null);
    }, 300);
  };

  // Сохранить tooltip при наведении на него
  const handleTooltipMouseEnter = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
  };

  // Скрыть tooltip при уходе с него
  const handleTooltipMouseLeave = () => {
    setTooltipData(null);
  };

  // Группировка реакций по эмоджи
  const groupedReactions = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = {
        emoji: reaction.emoji,
        count: 0,
        users: []
      };
    }
    acc[reaction.emoji].count++;
    acc[reaction.emoji].users.push({
      id: reaction.userId,
      name: reaction.user?.displayName || 'Пользователь',
      avatarUrl: reaction.user?.avatarUrl || null
    });
    return acc;
  }, {});

  const reactionsList = Object.values(groupedReactions);

  // Проверка, поставил ли текущий пользователь реакцию
  const userReaction = reactions.find(r => r.userId === currentUser?.id);

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

        {/* Реакции */}
        {currentUser && (
          <div className={styles.reactionsContainer}>
            {/* Отображение существующих реакций */}
            {reactionsList.length > 0 && (
              <div className={styles.reactionsList}>
                {reactionsList.map((reaction) => {
                  // Проверяем, есть ли реакция текущего пользователя с таким эмоджи
                  const isUserReaction = currentUser && reaction.users.some(u => u.id === currentUser.id);
                  
                  return (
                    <span 
                      key={reaction.emoji}
                      className={`${styles.reactionBadge} ${isUserReaction ? styles.userReaction : ''}`}
                      onClick={() => handleReactionBadgeClick(reaction)}
                      onMouseEnter={(e) => handleMouseEnter(e, reaction.users)}
                      onMouseLeave={handleMouseLeave}
                    >
                      {reaction.emoji} {reaction.count}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Кнопка добавления реакции */}
            <div className={styles.addReactionContainer}>
              <button
                className={styles.addReactionButton}
                onClick={() => setShowReactionPicker(!showReactionPicker)}
                title={userReaction ? 'Изменить реакцию' : 'Добавить реакцию'}
              >
                <svg 
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <circle cx="8" cy="10" r="1.5" fill="currentColor"/>
                  <circle cx="16" cy="10" r="1.5" fill="currentColor"/>
                  <path d="M8 14.5C8.5 15.5 10 17 12 17C14 17 15.5 15.5 16 14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>

              {/* Picker реакций */}
              {showReactionPicker && (
                <ReactionPicker
                  onSelect={handleAddReaction}
                  onClose={() => setShowReactionPicker(false)}
                />
              )}
            </div>
          </div>
        )}

        {/* Tooltip с пользователями */}
        {tooltipData && (
          <ReactionTooltip
            users={tooltipData.users}
            position={tooltipData.position}
            onMouseEnter={handleTooltipMouseEnter}
            onMouseLeave={handleTooltipMouseLeave}
            className={styles.reviewTooltip}
          />
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
