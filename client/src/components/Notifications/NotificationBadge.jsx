import React, { useEffect } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { fetchNotifications } from '../../store/slices/notificationsSlice';
import styles from './NotificationBadge.module.css';

/**
 * Значок уведомлений с количеством непрочитанных
 * Отображается в правом блоке (Sidebar)
 * Автоматически обновляется каждые 30 секунд
 */
const NotificationBadge = () => {
  const dispatch = useAppDispatch();
  const { unreadCount, loading } = useAppSelector((state) => state.notifications);

  // Загружаем уведомления при монтировании компонента
  useEffect(() => {
    dispatch(fetchNotifications());

    // Устанавливаем интервал для периодического обновления
    const interval = setInterval(() => {
      dispatch(fetchNotifications());
    }, 30000); // 30 секунд

    // Очищаем интервал при размонтировании
    return () => clearInterval(interval);
  }, [dispatch]);

  // Если нет непрочитанных уведомлений, не показываем значок
  if (unreadCount === 0) {
    return null;
  }

  return (
    <span className={styles.badge} aria-label={`${unreadCount} непрочитанных уведомлений`}>
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  );
};

export default NotificationBadge;
