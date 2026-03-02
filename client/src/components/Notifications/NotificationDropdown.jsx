import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { fetchNotifications, markAsRead } from '../../store/slices/notificationsSlice';
import WallPostModal from '../Wall/WallPostModal';
import Icon from '../Common/Icon';
import api from '../../services/api';
import styles from './NotificationDropdown.module.css';

/**
 * Всплывающее окно с уведомлениями (как на YouTube)
 * Открывается при клике на колокольчик
 * Показывает последние 10-15 уведомлений
 */
const NotificationDropdown = ({ isOpen, onClose, buttonRef }) => {
  const dispatch = useAppDispatch();
  const { notifications, loading } = useAppSelector((state) => state.notifications);
  const dropdownRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const [selectedPostId, setSelectedPostId] = useState(null);

  // Вычисляем позицию dropdown относительно кнопки
  useEffect(() => {
    if (isOpen && buttonRef?.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: buttonRect.bottom + 10, // 10px отступ от кнопки
        right: window.innerWidth - buttonRect.right - 10 // Выравниваем по правому краю кнопки
      });
    }
  }, [isOpen, buttonRef]);

  // Загружаем уведомления при открытии
  useEffect(() => {
    if (isOpen) {
      dispatch(fetchNotifications());
    }
  }, [isOpen, dispatch]);

  // Сбрасываем selectedPostId при закрытии dropdown
  useEffect(() => {
    if (!isOpen) {
      setSelectedPostId(null);
    }
  }, [isOpen]);

  // Закрытие при клике вне dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Проверяем, что клик не по кнопке уведомлений, не по dropdown и не по модалке поста
      const notificationButton = event.target.closest('.notificationsButton');
      const isModalClick = event.target.closest('[data-modal="wall-post"]');
      
      if (dropdownRef.current && 
          !dropdownRef.current.contains(event.target) && 
          !notificationButton &&
          !isModalClick) {
        setSelectedPostId(null); // Сбрасываем выбранный пост
        onClose();
      }
    };

    if (isOpen) {
      // Используем небольшую задержку, чтобы избежать немедленного закрытия при открытии
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

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
          onClose();
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
      onClose();
    }
  };

  // Формирование текста уведомления с актуальным именем пользователя
  const formatNotificationText = (notification) => {
    // Если есть связанный пользователь, подставляем его актуальное имя
    if (notification.relatedUser && notification.relatedUser.displayName) {
      return `${notification.relatedUser.displayName} ${notification.content}`;
    }
    // Иначе возвращаем content как есть (для самолайков и системных уведомлений)
    return notification.content;
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
      month: 'short'
    });
  };

  // Иконка в зависимости от типа уведомления
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'reaction':
        return 'heart';
      case 'friend_activity':
        return 'user';
      case 'message':
        return 'message';
      default:
        return 'bell';
    }
  };

  if (!isOpen) return null;

  // Показываем только последние 15 уведомлений
  const displayedNotifications = notifications.slice(0, 15);

  // Рендерим dropdown через портал в body
  return (
    <>
      {createPortal(
        <div 
          className={styles.dropdown} 
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: `${position.top}px`,
            right: `${position.right}px`
          }}
        >
          <div className={styles.header}>
            <h3 className={styles.title}>Уведомления</h3>
          </div>

          <div className={styles.content}>
            {loading && displayedNotifications.length === 0 ? (
              <div className={styles.loading}>Загрузка...</div>
            ) : displayedNotifications.length === 0 ? (
              <div className={styles.empty}>
                <Icon name="bell" size="large" className={styles.emptyIcon} />
                <p>Пока нет уведомлений</p>
              </div>
            ) : (
              <ul className={styles.list}>
                {displayedNotifications.map((notification) => (
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
                      <Icon name={getNotificationIcon(notification.type)} size="medium" />
                    </div>
                    
                    <div className={styles.itemContent}>
                      <p className={styles.text}>{formatNotificationText(notification)}</p>
                      <span className={styles.time}>{formatDate(notification.createdAt)}</span>
                    </div>

                    {!notification.isRead && (
                      <div className={styles.unreadDot} aria-label="Непрочитано" />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {displayedNotifications.length > 0 && (
            <div className={styles.footer}>
              <a href="/notifications" className={styles.showAllButton}>
                Показать все
              </a>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Модальное окно для отображения поста - рендерим отдельно */}
      <WallPostModal 
        postId={selectedPostId}
        isOpen={!!selectedPostId}
        onClose={() => {
          setSelectedPostId(null);
        }}
      />
    </>
  );
};

export default NotificationDropdown;
