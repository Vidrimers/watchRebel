import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { addReaction, deletePost, fetchWall } from '../../store/slices/wallSlice';
import ReactionPicker from './ReactionPicker';
import ReactionTooltip from './ReactionTooltip';
import AddToListModal from './AddToListModal';
import useConfirm from '../../hooks/useConfirm.jsx';
import useAlert from '../../hooks/useAlert.jsx';
import Icon from '../Common/Icon';
import api from '../../services/api';
import styles from './WallPost.module.css';

/**
 * Компонент отдельной записи на стене
 * Поддерживает разные типы постов: text, media_added, rating, review
 * 
 * @param {Object} post - Данные поста
 * @param {boolean} isOwnProfile - Просмотр своего профиля
 * @param {Function} onReactionChange - Callback при изменении реакций
 * @param {boolean} isFeedView - Отображение в общей ленте (для показа "Автор → Владелец")
 * @param {boolean} isModal - Отображение в модальном окне (отключает навигацию)
 */
const WallPost = ({ post, isOwnProfile, onReactionChange, isFeedView = false, isModal = false }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const currentUser = useAppSelector((state) => state.auth.user);
  const { confirmDialog, showConfirm } = useConfirm();
  const { alertDialog, showAlert } = useAlert();
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [tooltipData, setTooltipData] = useState(null);
  const tooltipTimeoutRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(post.content || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showAddToListModal, setShowAddToListModal] = useState(false);

  // Обработка добавления реакции
  const handleAddReaction = async (emoji) => {
    try {
      await dispatch(addReaction({ 
        postId: post.id, 
        emoji 
      })).unwrap();
      setShowReactionPicker(false);
      
      // Вызываем callback если он передан (для FeedPage)
      if (onReactionChange) {
        onReactionChange();
      }
    } catch (err) {
      console.error('Ошибка добавления реакции:', err);
    }
  };

  // Обработка удаления реакции
  const handleDeleteReaction = async (reactionId) => {
    try {
      await api.delete(`/wall/${post.id}/reactions/${reactionId}`);
      // Перезагружаем посты
      dispatch(fetchWall(post.userId));
      
      // Вызываем callback если он передан (для FeedPage)
      if (onReactionChange) {
        onReactionChange();
      }
    } catch (err) {
      console.error('Ошибка удаления реакции:', err);
    }
  };

  // Обработка клика на badge реакции
  const handleReactionBadgeClick = async (reaction) => {
    if (!currentUser) return;

    // Проверяем, есть ли реакция текущего пользователя с таким же эмоджи
    const userReactionWithSameEmoji = post.reactions?.find(
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

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

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

  // Обработка редактирования поста
  const handleEditPost = () => {
    setIsEditing(true);
    setEditedContent(post.content || '');
  };

  // Сохранение отредактированного поста
  const handleSaveEdit = async () => {
    if (!editedContent.trim()) {
      await showAlert({
        title: 'Ошибка',
        message: 'Контент не может быть пустым',
        type: 'error'
      });
      return;
    }

    setIsSaving(true);
    try {
      await api.put(`/wall/${post.id}`, { content: editedContent.trim() });
      // Перезагружаем посты
      dispatch(fetchWall(post.userId));
      setIsEditing(false);
    } catch (err) {
      console.error('Ошибка редактирования поста:', err);
      await showAlert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось отредактировать запись',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Отмена редактирования
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContent(post.content || '');
  };

  // Проверка, можно ли редактировать пост (в течение часа)
  const canEdit = () => {
    const createdAt = new Date(post.createdAt);
    const now = new Date();
    const hourInMs = 60 * 60 * 1000;
    return (now - createdAt) < hourInMs;
  };

  // Проверка, является ли пост объявлением администратора
  const isAnnouncement = post.content?.startsWith('📢 Объявление администратора:');

  // Функция для очистки контента от служебных маркеров
  const cleanContent = (content) => {
    if (!content) return content;
    // Убираем маркер announcement_id и лишние переносы строк
    let cleaned = content
      .replace(/\[announcement_id:[^\]]+\]/g, '')
      .replace(/\n{3,}/g, '\n\n') // Заменяем 3+ переноса на 2
      .trim();
    
    // Убираем эмодзи объявления из текста (будем показывать иконкой)
    cleaned = cleaned.replace('📢 Объявление администратора:', 'Объявление администратора:');
    
    return cleaned;
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
    if (!isModal && post.tmdbId && post.mediaType) {
      navigate(`/media/${post.mediaType}/${post.tmdbId}`);
    }
  };

  // Рендер контента в зависимости от типа поста
  const renderPostContent = () => {
    switch (post.postType) {
      case 'status_update':
        return (
          <div className={styles.statusUpdateContent}>
            <p className={styles.actionText}>
              <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '6px', verticalAlign: 'middle' }}>
                <Icon name="announcement" size="medium" color="var(--accent-color)" />
              </span>
              Статус обновлен:
            </p>
            <div className={styles.statusText}>
              <p>{cleanContent(post.content)}</p>
            </div>
          </div>
        );

      case 'text':
        return (
          <div className={styles.textContent}>
            {isEditing ? (
              <div className={styles.editMode}>
                <textarea
                  className={styles.editTextarea}
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  rows={4}
                  disabled={isSaving}
                />
                <div className={styles.editButtons}>
                  <button 
                    className={styles.saveButton}
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Сохранение...' : 'Сохранить'}
                  </button>
                  <button 
                    className={styles.cancelButton}
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <p>
                {isAnnouncement && (
                  <span style={{ color: '#ff4444', display: 'inline-flex', alignItems: 'center', marginRight: '6px', verticalAlign: 'middle' }}>
                    <Icon name="announcement" size="medium" color="#ff4444" />
                  </span>
                )}
                {cleanContent(post.content)}
              </p>
            )}
          </div>
        );

      case 'media_added':
        // Разбиваем content на название фильма и текст о списке
        const contentLines = post.content ? post.content.split('\n') : [];
        const movieTitle = contentLines[0] || '';
        const listText = contentLines[1] || 'Добавил в список';
        
        // Извлекаем название списка из текста
        const listNameMatch = listText.match(/Добавил в список:\s*(.+)/);
        const listName = listNameMatch ? listNameMatch[1] : '';
        
        return (
          <div 
            className={styles.mediaAddedContent}
            onClick={handleMediaClick}
          >
            {post.posterPath && (
              <div className={styles.mediaPoster}>
                <img 
                  src={
                    post.posterPath.startsWith('/uploads/') 
                      ? `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${post.posterPath}`
                      : `https://image.tmdb.org/t/p/w185${post.posterPath}`
                  }
                  alt="Постер"
                  className={styles.posterImage}
                />
              </div>
            )}
            <div className={styles.mediaTextContent}>
              <h4 className={styles.movieTitle}>
                {movieTitle}
              </h4>
              <p className={styles.mediaAddedText}>
                Добавил в список: <span 
                  className={post.listId ? styles.listLink : styles.listLinkDisabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isModal && post.listId) {
                      navigate(`/lists/${post.listId}`);
                    }
                  }}
                  style={{ cursor: post.listId ? 'pointer' : 'default' }}
                  title={post.listId ? 'Перейти к списку' : 'Список недоступен (старый пост)'}
                >
                  {listName}
                </span>
              </p>
              <div className={styles.mediaBottomRow}>
                {post.tmdbId && (
                  <div className={styles.mediaTypeLabel}>
                    {post.mediaType === 'movie' ? (
                      <>
                        <Icon name="movies" size="small" /> Фильм
                      </>
                    ) : (
                      <>
                        <Icon name="tv" size="small" /> Сериал
                      </>
                    )}
                  </div>
                )}
                {/* Кнопка "В свой список" для других пользователей */}
                {currentUser && post.author?.id !== currentUser.id && post.tmdbId && (
                  <button
                    className={styles.addToMyListButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAddToListModal(true);
                    }}
                    title="Добавить в свой список"
                  >
                    <Icon name="add" size="small" />
                    В свой список
                  </button>
                )}
              </div>
            </div>
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
                <p>{cleanContent(post.content)}</p>
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
    acc[reaction.emoji].users.push({
      id: reaction.userId,
      name: reaction.user?.displayName || 'Пользователь',
      avatarUrl: reaction.user?.avatarUrl || null
    });
    return acc;
  }, {}) || {};

  const reactionsList = Object.values(groupedReactions);

  // Проверка, поставил ли текущий пользователь реакцию
  const userReaction = post.reactions?.find(r => r.userId === currentUser?.id);

  return (
    <>
      {confirmDialog}
      {alertDialog}
      <div className={`${styles.wallPost} ${isAnnouncement ? styles.announcementPost : ''}`}>
      {/* Заголовок поста с именем автора */}
      {!isAnnouncement && !isFeedView && (
        <div className={styles.postHeader}>
          {/* Логика отображения имени автора */}
          {(() => {
            // На своей стене свои посты: БЕЗ имени автора (только дата будет в футере)
            if (isOwnProfile && currentUser && post.author?.id === currentUser.id) {
              return null;
            }

            // На стене пользователя: показываем аватарку и имя автора (без стрелки)
            if (post.author?.id) {
              return (
                <div className={styles.authorInfo}>
                  {/* Аватарка автора */}
                  {post.author.avatarUrl && (
                    <img 
                      src={post.author.avatarUrl.startsWith('http') 
                        ? post.author.avatarUrl 
                        : `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${post.author.avatarUrl}`
                      }
                      alt={post.author.displayName}
                      className={styles.authorAvatar}
                      onClick={isModal ? undefined : () => navigate(`/user/${post.author.id}`)}
                      style={isModal ? { cursor: 'default' } : {}}
                    />
                  )}
                  <span 
                    className={styles.authorName}
                    onClick={isModal ? undefined : () => navigate(`/user/${post.author.id}`)}
                    style={isModal ? { cursor: 'default' } : {}}
                  >
                    {post.author.displayName}
                  </span>
                </div>
              );
            }

            return null;
          })()}
        </div>
      )}

      {/* Контент поста */}
      <div className={styles.postContent}>
        {renderPostContent()}
      </div>

      {/* Футер с датой и реакциями */}
      <div className={styles.postFooter}>
        <div className={styles.postFooterLeft}>
          <span className={styles.postDate}>
            {formatDate(post.createdAt)}
            {post.editedAt && <span className={styles.editedLabel}> (изменено)</span>}
          </span>

          {/* Кнопки управления (для автора поста или владельца стены, но не для объявлений) */}
          {!isAnnouncement && currentUser && (
            post.author?.id === currentUser.id || 
            post.wallOwner?.id === currentUser.id
          ) && (
            <div className={styles.postActions}>
              {/* Редактировать может только автор */}
              {post.author?.id === currentUser.id && canEdit() && (post.postType === 'text' || post.postType === 'review') && !isEditing && (
                <button
                  className={styles.editButton}
                  onClick={handleEditPost}
                  title="Редактировать"
                >
                  <Icon name="edit" size="small" />
                </button>
              )}
              {/* Удалить может автор или владелец стены */}
              <button
                className={styles.deleteButton}
                onClick={handleDeletePost}
                disabled={isDeleting}
                title="Удалить запись"
              >
                {isDeleting ? '⏳' : <Icon name="delete" size="small" />}
              </button>
            </div>
          )}
        </div>

        {/* Реакции */}
        {!isAnnouncement && (
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
            {currentUser && (
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
            )}
          </div>
        )}

        {/* Tooltip с пользователями */}
        {tooltipData && (
          <ReactionTooltip
            users={tooltipData.users}
            position={tooltipData.position}
            onMouseEnter={handleTooltipMouseEnter}
            onMouseLeave={handleTooltipMouseLeave}
          />
        )}
      </div>

      {/* Модалка добавления в список */}
      {showAddToListModal && (
        <AddToListModal
          tmdbId={post.tmdbId}
          mediaType={post.mediaType}
          mediaTitle={post.content?.split('\n')[0]}
          onClose={() => setShowAddToListModal(false)}
        />
      )}
    </div>
    </>
  );
};

export default WallPost;
