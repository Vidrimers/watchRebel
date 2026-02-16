import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { logout } from '../store/slices/authSlice';
import UserPageLayout from '../components/Layout/UserPageLayout';
import ThemeSelector from '../components/Settings/ThemeSelector';
import AdminPanel from '../components/Settings/AdminPanel';
import styles from './SettingsPage.module.css';

/**
 * Страница настроек пользователя
 * Отображает настройки в виде отдельных карточек
 */
const SettingsPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);

  // Проверяем, является ли пользователь админом
  const isAdmin = user?.isAdmin || user?.id === '137981675';

  const handleLogout = async () => {
    if (confirm('Вы уверены, что хотите выйти?')) {
      await dispatch(logout());
      navigate('/login');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className={styles.errorContainer}>
        <p>Необходимо авторизоваться</p>
      </div>
    );
  }

  return (
    <UserPageLayout user={user}>
      <div className={styles.settingsContainer}>
        <h1 className={styles.pageTitle}>⚙️ Настройки</h1>

        {/* Карточка с темой */}
        <ThemeSelector />

        {/* Карточка с информацией о профиле */}
        <div className={styles.settingsCard}>
          <h3 className={styles.cardTitle}>Профиль</h3>
          <div className={styles.profileInfo}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Имя:</span>
              <span className={styles.infoValue}>{user.displayName}</span>
            </div>
            {user.telegramUsername && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Telegram:</span>
                <span className={styles.infoValue}>@{user.telegramUsername}</span>
              </div>
            )}
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>ID:</span>
              <span className={styles.infoValue}>{user.id}</span>
            </div>
          </div>
        </div>

        {/* Карточка с выходом */}
        <div className={styles.settingsCard}>
          <h3 className={styles.cardTitle}>Сессия</h3>
          <button onClick={handleLogout} className={styles.logoutButton}>
            Выйти из аккаунта
          </button>
        </div>

        {/* Карточка с контактами админа */}
        <div className={styles.settingsCard}>
          <h3 className={styles.cardTitle}>Контакты для рекламы</h3>
          <div className={styles.contactInfo}>
            <p className={styles.contactItem}>
              <span className={styles.contactIcon}>📧</span>
              Email: <a href="mailto:admin@watchrebel.com" className={styles.contactLink}>admin@watchrebel.com</a>
            </p>
            <p className={styles.contactItem}>
              <span className={styles.contactIcon}>💬</span>
              Telegram: <a href="https://t.me/watchrebel_admin" className={styles.contactLink} target="_blank" rel="noopener noreferrer">@watchrebel_admin</a>
            </p>
          </div>
        </div>

        {/* Админ-панель (только для админа) */}
        {isAdmin && <AdminPanel />}
      </div>
    </UserPageLayout>
  );
};

export default SettingsPage;
