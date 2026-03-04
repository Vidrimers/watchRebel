import React, { useEffect, useState } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { fetchNotifications, markAsRead, markAllAsRead } from '../../store/slices/notificationsSlice';
import WallPostModal from '../Wall/WallPostModal';
import Icon from '../Common/Icon';
import api from '../../services/api';
import styles from './NotificationList.module.css';

/**
 * Список уведомлений
 * Отображает уведомления о реакциях и активности друзей
 */
const NotificationList = () => {
  const dispatch = useAppDispatch();
  const { notifications, loading, unreadCount } = useAppSelector((state) => state.notifications);
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
        
        // Если это пост о медиа (добавление, оценка, отзыв) - переходим на страницу медиа
        if (['media_added', 'rating', 'review'].includes(post.postType) && post.tmdbId && post.mediaType) {
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

  // Формирование текста уведомления с актуальным именем пользователя
  const formatNotificationText = (notification) => {
    // Если есть связанный пользователь
    if (notification.relatedUser && notification.relatedUser.displayName) {
      const userName = notification.relatedUser.displayName;
      const content = notification.content;
      
      // Проверяем, начинается ли content с какого-то имени (старый формат)
      // Если да - заменяем старое имя на актуальное
      // Если нет - добавляем имя в начало (новый формат)
      
      // Ищем первое слово в content (это может быть старое имя)
      const firstWord = content.split(' ')[0];
      
      // Если первое слово начинается с заглавной буквы и не является служебным словом
      // то это скорее всего старое имя пользователя
      const serviceWords = ['хочет', 'принял', 'лайкнул', 'добавил', 'оценил', 'написал', 'отреагировал', 'зарегистрировался'];
      
      if (firstWord && firstWord[0] === firstWord[0].toUpperCase() && !serviceWords.includes(firstWord.toLowerCase())) {
        // Это старый формат с именем - заменяем первое слово на актуальное имя
        const contentWithoutOldName = content.split(' ').slice(1).join(' ');
        return `${userName} ${contentWithoutOldName}`;
      } else {
        // Это новый формат без имени - добавляем имя
        return `${userName} ${content}`;
      }
    }
    
    // Иначе возвращаем content как есть (для системных уведомлений без relatedUser)
    return notification.content;
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
        return <Icon name="heart" size="small" />;
      case 'friend_activity':
        return <Icon name="user" size="small" />;
      case 'friend_request':
        return <Icon name="friends" size="small" />;
      case 'friend_request_accepted':
        return <Icon name="friends" size="small" />;
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
