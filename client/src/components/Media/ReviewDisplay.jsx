import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { addReaction } from '../../store/slices/wallSlice';
import ReactionPicker from '../Wall/ReactionPicker';
import ReactionTooltip from '../Wall/ReactionTooltip';
import api from '../../services/api';
import styles from './ReviewDisplay.module.css';

/**
 * Компонент для отображения отзыва другого пользователя
 * Используется на странице фильма с отзывом
 */
const ReviewDisplay = ({ review, media, onGoToMediaPage }) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [tooltipData, setTooltipData] = useState(null);
  const tooltipTimeoutRef = useRef(null);
  const [reactions, setReactions] = useState(review?.reactions || []);

  useEffect(() => {
    if (review?.reactions) {
      setReactions(review.reactions);
    }
  }, [review?.reactions]);

  // Подписка на WebSocket обновления реакций
  useEffect(() => {
    if (!review?.id) return;

    const handleWebSocketMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Обновление реакций на пост
        if (data.type === 'reaction_added' && data.postId === review.id) {
          setReactions(prev => [...prev, data.reaction]);
        }
        
        if (data.type === 'reaction_removed' && data.postId === review.id) {
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
  }, [review?.id]);

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  if (!review) {
    return null;
  }

  // Обработка добавления реакции
  const handleAddReaction = async (emoji) => {
    try {
      const result = await dispatch(addReaction({ 
        postId: review.id, 
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
    try {
      await api.delete(`/wall/${review.id}/reactions/${reactionId}`);
      
      // Обновляем локальные реакции
      setReactions(prev => prev.filter(r => r.id !== reactionId));
    } catch (err) {
      console.error('Ошибка удаления реакции:', err);
    }
  };

  // Обработка клика на badge реакции
  const handleReactionBadgeClick = async (reaction) => {
    if (!currentUser) return;

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
                  : `${import.meta.env.VITE_API_URL || ''}${review.author.avatarUrl}`
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

        <button
          className={styles.goToMediaButton}
          onClick={onGoToMediaPage}
        >
          Оставить свой отзыв
        </button>
      </div>

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
};

export default ReviewDisplay;
