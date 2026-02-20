import React, { useEffect } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { fetchNotifications, markAsRead, markAllAsRead } from '../../store/slices/notificationsSlice';
import styles from './NotificationList.module.css';

/**
 * Список уведомлений
 * Отображает уведомления о реакциях и активности друзей
 */
const NotificationList = () => {
  const dispatch = useAppDispatch();
  const { notifications, loading, unreadCount } = useAppSelector((state) => state.notifications);

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
  const handleNotificationClick = (notification) => {
    // Переход к связанному контенту
    if (notification.relatedPostId) {
      // Переход к посту на стене
      window.location.href = `/profile/${notification.userId}#post-${notification.relatedPostId}`;
    } else if (notification.relatedUserId) {
      // Переход к профилю пользователя
      window.location.href = `/profile/${notification.relatedUserId}`;
    }
  };

  // Обработчик пометки всех как прочитанные
  const handleMarkAllAsRead = () => {
    dispatch(markAllAsRead());
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
        return '❤️';
      case 'friend_activity':
        return '👤';
      default:
        return '🔔';
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
            onClick={() => handleNotificationClick(notification)}
            onMouseEnter={() => handleNotificationHover(notification)}
          >
            <div className={styles.icon}>
              {getNotificationIcon(notification.type)}
            </div>
            
            <div className={styles.content}>
              <p className={styles.text}>{notification.content}</p>
              <span className={styles.time}>{formatDate(notification.createdAt)}</span>
            </div>

            {!notification.isRead && (
              <div className={styles.unreadDot} aria-label="Непрочитано" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default NotificationList;
