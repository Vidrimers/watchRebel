import React, { useEffect, useState } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { fetchNotifications, loadMoreNotifications, markAsRead, markAllAsRead } from '../../store/slices/notificationsSlice';
import WallPostModal from '../Wall/WallPostModal';
import Icon from '../Common/Icon';
import api from '../../services/api';
import { resolveDisplayNameWithTooltip } from '../../utils/nicknameResolver';
import styles from './NotificationList.module.css';

/**
 * Список уведомлений
 * Отображает уведомления о реакциях и активности друзей
 */
const NotificationList = () => {
  const dispatch = useAppDispatch();
  const { notifications, loading, loadingMore, hasMore, total, unreadCount } = useAppSelector((state) => state.notifications);
  const [selectedPostId, setSelectedPostId] = useState(null);

  // Загружаем уведомления при монтировании компонента
  useEffect(() => {
    dispatch(fetchNotifications());
  }, [dispatch]);

  // Обработчик наведения на уведомление
  const handleNotificationHover = (notification) => {
    if (!notification.isRead) {
      dispatch(markAsRead(notification.id));
    }
  };

  // Обработчик клика по уведомлению
  const handleNotificationClick = async (e, notification) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Для запросов в друзья переходим на страницу друзей с вкладкой запросов
    if (notification.type === 'friend_request') {
      window.location.href = '/friends?tab=requests';
      return;
    }
    
    // Для принятых запросов переходим на профиль пользователя
    if (notification.type === 'friend_request_accepted' && notification.relatedUserId) {
      window.location.href = `/user/${notification.relatedUserId}`;
      return;
    }

    // Для уведомлений об изменении статуса багрепорта переходим на страницу "Мои багрепорты"
    if (notification.type === 'bug_report_status_changed') {
      window.location.href = '/my-bug-reports';
      return;
    }

    // Для уведомлений о новом багрепорте (для админа) переходим на страницу управления багрепортами
    if (notification.type === 'new_bug_report') {
      window.location.href = '/admin/bug-reports';
      return;
    }
    
    // Проверяем, что relatedPostId это UUID (формат: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    const isValidPostId = notification.relatedPostId && 
                          notification.relatedPostId.includes('-') && 
                          notification.relatedPostId.length > 30;
    
    // Если есть валидный связанный пост - нужно определить куда переходить
    if (isValidPostId) {
      try {
        // Загружаем пост чтобы узнать его тип
        const response = await api.get(`/wall/post/${notification.relatedPostId}`);
        const post = response.data;
        
        // Если это отзыв
        if (post.postType === 'review' && post.tmdbId && post.mediaType) {
          // Если текущий пользователь - автор отзыва, переходим без параметра reviewPost
          const currentUserId = notification.userId; // ID получателя уведомления
          const isAuthor = post.userId === currentUserId;
          
          if (isAuthor) {
            // Автор переходит на страницу редактирования
            window.location.href = `/media/${post.mediaType}/${post.tmdbId}`;
          } else {
            // Другие пользователи переходят на просмотр отзыва
            window.location.href = `/media/${post.mediaType}/${post.tmdbId}?reviewPost=${notification.relatedPostId}`;
          }
          return;
        }
        
        // Если это пост о медиа (добавление, оценка) - переходим на страницу медиа
        if (['media_added', 'rating'].includes(post.postType) && post.tmdbId && post.mediaType) {
          window.location.href = `/media/${post.mediaType}/${post.tmdbId}`;
          return;
        }
        
        // Иначе открываем модалку с постом
        setSelectedPostId(notification.relatedPostId);
        return;
      } catch (err) {
        console.error('Ошибка загрузки поста:', err);
        // Если не удалось загрузить пост, просто открываем модалку
        setSelectedPostId(notification.relatedPostId);
        return;
      }
    } 
    // Если есть связанный пользователь (и нет поста) - переходим на его страницу
    else if (notification.relatedUserId) {
      window.location.href = `/user/${notification.relatedUserId}`;
    }
  };

  // Формирование текста уведомления
  const formatNotificationText = (notification) => {
    if (notification.type === 'mention') {
      if (notification.relatedUser?.displayName) {
        const resolved = resolveDisplayNameWithTooltip(notification.relatedUserId, notification.relatedUser.displayName);
        return `${resolved.text} ${notification.content}`;
      }
      return notification.content;
    }
    if (notification.relatedUser?.displayName) {
      const resolved = resolveDisplayNameWithTooltip(notification.relatedUserId, notification.relatedUser.displayName);
      return `${resolved.text} ${notification.content}`;
    }
    if (notification.relatedUserId) return `Пользователь ${notification.content}`;
    return notification.content;
  };

  // Обработчик пометки всех как прочитанные
  const handleMarkAllAsRead = () => {
    dispatch(markAllAsRead());
  };

  // Обработчик загрузки ещё
  const handleLoadMore = () => {
    dispatch(loadMoreNotifications());
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
    if (diffDays < 7) return `${diffDays} дн назад`;
    
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  // Иконка в зависимости от типа уведомления
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'reaction':
        return <Icon name="heart" size="small" />;
      case 'friend_activity':
        return <Icon name="user" size="small" />;
      case 'friend_request':
        return <Icon name="friends" size="small" />;
      case 'friend_request_accepted':
        return <Icon name="friends" size="small" />;
      case 'bug_report_status_changed':
        return <Icon name="bug" size="small" />;
      case 'new_bug_report':
        return <Icon name="bug" size="small" />;
      default:
        return <Icon name="bell" size="small" />;
    }
  };

  if (loading && notifications.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Загрузка уведомлений...</div>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🔔</span>
          <p>Пока нет уведомлений</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Уведомления</h2>
        {unreadCount > 0 && (
          <button 
            className={styles.markAllButton}
            onClick={handleMarkAllAsRead}
            title="Пометить все как прочитанные"
          >
            Прочитать все
          </button>
        )}
      </div>
      
      <ul className={styles.list}>
        {notifications.map((notification) => (
          <li
            key={notification.id}
            className={`${styles.item} ${!notification.isRead ? styles.unread : ''}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleNotificationClick(e, notification);
            }}
            onMouseEnter={() => handleNotificationHover(notification)}
          >
            <div className={styles.icon}>
              {getNotificationIcon(notification.type)}
            </div>
            
            <div className={styles.content}>
              <p className={styles.text}>{formatNotificationText(notification)}</p>
              <span className={styles.time}>{formatDate(notification.createdAt)}</span>
            </div>

            {!notification.isRead && (
              <div className={styles.unreadDot} aria-label="Непрочитано" />
            )}
          </li>
        ))}
      </ul>

      {hasMore && (
        <div className={styles.loadMore}>
          <button 
            className={styles.loadMoreButton}
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Загрузка...' : `Загрузить ещё (${notifications.length} из ${total})`}
          </button>
        </div>
      )}

      {/* Модальное окно для отображения поста */}
      <WallPostModal 
        postId={selectedPostId}
        isOpen={!!selectedPostId}
        onClose={() => setSelectedPostId(null)}
      />
    </div>
  );
};

export default NotificationList;
