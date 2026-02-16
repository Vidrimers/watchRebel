import React from 'react';
import { useParams } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import UserPageLayout from '../components/Layout/UserPageLayout';
import UserAvatar from '../components/User/UserAvatar';
import ReferralStats from '../components/User/ReferralStats';
import { Wall } from '../components/Wall';
import styles from './UserProfilePage.module.css';

/**
 * Страница профиля пользователя
 * Отображает Wall пользователя и его информацию
 */
const UserProfilePage = () => {
  const { userId } = useParams();
  
  const { user: currentUser, isAuthenticated } = useAppSelector((state) => state.auth);

  // Определяем, это свой профиль или чужой
  const isOwnProfile = currentUser?.id === userId;
  
  // Для отображения используем текущего пользователя если это свой профиль
  // В будущем здесь будет загрузка профиля другого пользователя
  const profileUser = isOwnProfile ? currentUser : null;

  if (!isAuthenticated) {
    return (
      <div className={styles.errorContainer}>
        <p>Необходимо авторизоваться</p>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className={styles.errorContainer}>
        <p>Загрузка профиля...</p>
      </div>
    );
  }

  return (
    <UserPageLayout user={currentUser}>
      <div className={styles.profileContainer}>
        {/* Заголовок профиля */}
        <div className={styles.profileHeader}>
          <UserAvatar user={profileUser} size="large" />
          <div className={styles.profileInfo}>
            <h1 className={styles.profileName}>{profileUser.displayName}</h1>
            {profileUser.telegramUsername && (
              <p className={styles.profileUsername}>@{profileUser.telegramUsername}</p>
            )}
          </div>
        </div>

        {/* Статистика рефералов (только для своего профиля) */}
        {isOwnProfile && <ReferralStats userId={userId} />}

        {/* Wall - лента активности */}
        <div className={styles.wallSection}>
          <h2 className={styles.sectionTitle}>Лента активности</h2>
          <Wall userId={userId} isOwnProfile={isOwnProfile} />
        </div>
      </div>
    </UserPageLayout>
  );
};

export default UserProfilePage;
