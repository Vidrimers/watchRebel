import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { addReaction, deletePost } from '../../store/slices/wallSlice';
import ReactionPicker from './ReactionPicker';
import useConfirm from '../../hooks/useConfirm.jsx';
import useAlert from '../../hooks/useAlert.jsx';
import styles from './WallPost.module.css';

/**
 * Компонент отдельной записи на стене
 * Поддерживает разные типы постов: text, media_added, rating, review
 */
const WallPost = ({ post, isOwnProfile }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const currentUser = useAppSelector((state) => state.auth.user);
  const { confirmDialog, showConfirm } = useConfirm();
  const { alertDialog, showAlert } = useAlert();
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Обработка добавления реакции
  const handleAddReaction = async (emoji) => {
    try {
      await dispatch(addReaction({ 
        postId: post.id, 
        emoji 
      })).unwrap();
      setShowReactionPicker(false);
    } catch (err) {
      console.error('Ошибка добавления реакции:', err);
    }
  };

  // Обработка удаления поста
  const handleDeletePost = async () => {
    const confirmed = await showConfirm({
      title: 'Удалить запись?',
      message: 'Вы уверены, что хотите удалить эту запись? Это действие нельзя отменить.',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    try {
      await dispatch(deletePost(post.id)).unwrap();
    } catch (err) {
      console.error('Ошибка удаления поста:', err);
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось удалить запись. Попробуйте еще раз.',
        type: 'error'
      });
      setIsDeleting(false);
    }
  };

  // Форматирование даты
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} д назад`;
    
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  // Переход на страницу медиа
  const handleMediaClick = () => {
    if (post.tmdbId && post.mediaType) {
      navigate(`/media/${post.mediaType}/${post.tmdbId}`);
    }
  };

  // Рендер контента в зависимости от типа поста
  const renderPostContent = () => {
    switch (post.postType) {
      case 'text':
        return (
          <div className={styles.textContent}>
            <p>{post.content}</p>
          </div>
        );

      case 'media_added':
        return (
          <div className={styles.mediaAddedContent}>
            <p className={styles.actionText}>
              📌 Добавил{isOwnProfile ? '' : 'а'} в список
            </p>
            {post.tmdbId && (
              <div 
                className={styles.mediaInfo}
                onClick={handleMediaClick}
              >
                <div className={styles.mediaDetails}>
                  <h4 className={styles.mediaTitle}>
                    {post.mediaType === 'movie' ? 'Фильм' : 'Сериал'} (ID: {post.tmdbId})
                  </h4>
                  <span className={styles.mediaType}>
                    {post.mediaType === 'movie' ? '🎬 Фильм' : '📺 Сериал'}
                  </span>
                </div>
              </div>
            )}
          </div>
        );

      case 'rating':
        return (
          <div className={styles.ratingContent}>
            <p className={styles.actionText}>
              ⭐ Оценил{isOwnProfile ? '' : 'а'}
            </p>
            {post.tmdbId && (
              <div 
                className={styles.mediaInfo}
                onClick={handleMediaClick}
              >
                <div className={styles.mediaDetails}>
                  <h4 className={styles.mediaTitle}>
                    {post.mediaType === 'movie' ? 'Фильм' : 'Сериал'} (ID: {post.tmdbId})
                  </h4>
                  <div className={styles.ratingValue}>
                    <span className={styles.ratingStars}>★</span>
                    <span className={styles.ratingNumber}>{post.rating}/10</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'review':
        return (
          <div className={styles.reviewContent}>
            <p className={styles.actionText}>
              ✍️ Написал{isOwnProfile ? '' : 'а'} отзыв
            </p>
            {post.tmdbId && (
              <div 
                className={styles.mediaInfo}
                onClick={handleMediaClick}
              >
                <div className={styles.mediaDetails}>
                  <h4 className={styles.mediaTitle}>
                    {post.mediaType === 'movie' ? 'Фильм' : 'Сериал'} (ID: {post.tmdbId})
                  </h4>
                </div>
              </div>
            )}
            {post.content && (
              <div className={styles.reviewText}>
                <p>{post.content}</p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // Группировка реакций по эмоджи
  const groupedReactions = post.reactions?.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = {
        emoji: reaction.emoji,
        count: 0,
        users: []
      };
    }
    acc[reaction.emoji].count++;
    acc[reaction.emoji].users.push(reaction.userId);
    return acc;
  }, {}) || {};

  const reactionsList = Object.values(groupedReactions);

  // Проверка, поставил ли текущий пользователь реакцию
  const userReaction = post.reactions?.find(r => r.userId === currentUser?.id);

  return (
    <>
      {confirmDialog}
      {alertDialog}
      <div className={styles.wallPost}>
      {/* Контент поста */}
      <div className={styles.postContent}>
        {renderPostContent()}
      </div>

      {/* Футер с датой и реакциями */}
      <div className={styles.postFooter}>
        <div className={styles.postFooterLeft}>
          <span className={styles.postDate}>{formatDate(post.createdAt)}</span>

          {/* Кнопка удаления (только для своих постов) */}
          {isOwnProfile && currentUser && post.userId === currentUser.id && (
            <button
              className={styles.deleteButton}
              onClick={handleDeletePost}
              disabled={isDeleting}
              title="Удалить запись"
            >
              {isDeleting ? '⏳' : '🗑️'}
            </button>
          )}
        </div>

        {/* Реакции */}
        <div className={styles.reactionsContainer}>
          {/* Отображение существующих реакций */}
          {reactionsList.length > 0 && (
            <div className={styles.reactionsList}>
              {reactionsList.map((reaction) => (
                <span 
                  key={reaction.emoji}
                  className={styles.reactionBadge}
                  title={`${reaction.count} ${reaction.count === 1 ? 'реакция' : 'реакций'}`}
                >
                  {reaction.emoji} {reaction.count}
                </span>
              ))}
            </div>
          )}

          {/* Кнопка добавления реакции (только для чужих постов) */}
          {!isOwnProfile && currentUser && (
            <div className={styles.addReactionContainer}>
              <button
                className={styles.addReactionButton}
                onClick={() => setShowReactionPicker(!showReactionPicker)}
                title={userReaction ? 'Изменить реакцию' : 'Добавить реакцию'}
              >
                {userReaction ? userReaction.emoji : '😊'}
              </button>

              {/* Picker реакций */}
              {showReactionPicker && (
                <ReactionPicker
                  onSelect={handleAddReaction}
                  onClose={() => setShowReactionPicker(false)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default WallPost;
