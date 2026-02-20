import React from 'react';
import { useAppSelector } from '../hooks/useAppSelector';
import UserPageLayout from '../components/Layout/UserPageLayout';
import { NotificationList } from '../components/Notifications';
import styles from './NotificationsPage.module.css';

/**
 * Страница уведомлений
 * Отображает список всех уведомлений пользователя
 */
const NotificationsPage = () => {
  const { user } = useAppSelector((state) => state.auth);

  return (
    <UserPageLayout user={user} narrowSidebar={true}>
      <div className={styles.page}>
        <NotificationList />
      </div>
    </UserPageLayout>
  );
};

export default NotificationsPage;
