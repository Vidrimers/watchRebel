import React from 'react';
import { NotificationList } from '../components/Notifications';
import styles from './NotificationsPage.module.css';

/**
 * Страница уведомлений
 * Отображает список всех уведомлений пользователя
 */
const NotificationsPage = () => {
  return (
    <div className={styles.page}>
      <NotificationList />
    </div>
  );
};

export default NotificationsPage;
