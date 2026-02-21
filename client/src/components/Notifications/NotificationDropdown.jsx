import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { fetchNotifications, markAsRead } from '../../store/slices/notificationsSlice';
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

  // Закрытие при клике вне dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Проверяем, что клик не по кнопке уведомлений и не по dropdown
      const notificationButton = event.target.closest('.notificationsButton');
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && !notificationButton) {
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
  const handleNotificationClick = (notification) => {
    // Переход к связанному контенту
    if (notification.relatedPostId) {
      window.location.href = `/user/${notification.userId}#post-${notification.relatedPostId}`;
    } else if (notification.relatedUserId) {
      window.location.href = `/user/${notification.relatedUserId}`;
    }
    onClose();
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
        return '❤️';
      case 'friend_activity':
        return '👤';
      case 'message':
        return '💬';
      default:
        return '🔔';
    }
  };

  if (!isOpen) return null;

  // Показываем только последние 15 уведомлений
  const displayedNotifications = notifications.slice(0, 15);

  // Рендерим dropdown через портал в body
  return createPortal(
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
            <span className={styles.emptyIcon}>🔔</span>
            <p>Пока нет уведомлений</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {displayedNotifications.map((notification) => (
              <li
                key={notification.id}
                className={`${styles.item} ${!notification.isRead ? styles.unread : ''}`}
                onClick={() => handleNotificationClick(notification)}
                onMouseEnter={() => handleNotificationHover(notification)}
              >
                <div className={styles.icon}>
                  {getNotificationIcon(notification.type)}
                </div>
                
                <div className={styles.itemContent}>
                  <p className={styles.text}>{notification.content}</p>
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
  );
};

export default NotificationDropdown;
