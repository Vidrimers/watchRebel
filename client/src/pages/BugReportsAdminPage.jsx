import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import UserPageLayout from '../components/Layout/UserPageLayout';
import BugReportsManager from '../components/Admin/BugReportsManager';
import styles from './BugReportsAdminPage.module.css';

/**
 * Страница управления багрепортами для администратора
 */
const BugReportsAdminPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);

  // Проверка прав администратора
  if (!isAuthenticated || !user?.isAdmin) {
    return (
      <div className={styles.errorContainer}>
        <p>Доступ запрещён. Только для администраторов.</p>
        <button onClick={() => navigate('/')} className={styles.backButton}>
          На главную
        </button>
      </div>
    );
  }

  return (
    <UserPageLayout user={user}>
      <div className={styles.bugReportsAdminPage}>
        <div className={styles.pageHeader}>
          <button onClick={() => navigate('/settings')} className={styles.backButton}>
            ← Назад к настройкам
          </button>
          <h1 className={styles.pageTitle}>Управление багрепортами</h1>
        </div>

        <BugReportsManager />
      </div>
    </UserPageLayout>
  );
};

export default BugReportsAdminPage;
