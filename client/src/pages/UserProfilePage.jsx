import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import UserPageLayout from '../components/Layout/UserPageLayout';
import UserAvatar from '../components/User/UserAvatar';
import { AdminModerationPanel } from '../components/Settings';
import { Wall } from '../components/Wall';
import api from '../services/api';
import styles from './UserProfilePage.module.css';

/**
 * Страница профиля пользователя
 * Отображает Wall пользователя и его информацию
 */
const UserProfilePage = () => {
  const { userId } = useParams();
  
  const { user: currentUser, isAuthenticated } = useAppSelector((state) => state.auth);
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFriend, setIsFriend] = useState(false);

  // Определяем, это свой профиль или чужой
  const isOwnProfile = currentUser?.id === userId;
  
  // Проверяем, является ли текущий пользователь администратором
  const isAdmin = currentUser?.isAdmin || false;

  /**
   * Загрузка данных профиля пользователя
   */
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        
        // Если это свой профиль, используем данные из Redux
        if (isOwnProfile) {
          setProfileUser(currentUser);
          setLoading(false);
          return;
        }

        // Загружаем профиль другого пользователя
        const response = await api.get(`/users/${userId}`);
        setProfileUser(response.data);
        
        // Проверяем, являемся ли мы друзьями
        if (currentUser?.id) {
          try {
            const friendsResponse = await api.get(`/users/${currentUser.id}/friends`);
            const friends = friendsResponse.data || [];
            setIsFriend(friends.some(friend => friend.id === userId));
          } catch (err) {
            console.error('Ошибка проверки дружбы:', err);
            setIsFriend(false);
          }
        }
      } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && userId) {
      fetchProfile();
    }
  }, [userId, isAuthenticated, isOwnProfile, currentUser]);

  /**
   * Обработчик действия модерации
   * Перезагружает данные профиля после действия модерации
   */
  const handleModerationAction = async (actionType) => {
    console.log('Действие модерации:', actionType);
    
    // Перезагружаем профиль пользователя
    try {
      const response = await api.get(`/users/${userId}`);
      setProfileUser(response.data);
    } catch (error) {
      console.error('Ошибка перезагрузки профиля:', error);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className={styles.errorContainer}>
        <p>Необходимо авторизоваться</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.errorContainer}>
        <p>Загрузка профиля...</p>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className={styles.errorContainer}>
        <p>Пользователь не найден</p>
      </div>
    );
  }

  return (
    <UserPageLayout user={currentUser}>
      <div className={styles.profileContainer}>
        {/* Заголовок профиля (только для чужих профилей) */}
        {!isOwnProfile && (
          <div className={styles.profileHeader}>
            <div className={styles.avatarSection}>
              <UserAvatar 
                user={profileUser} 
                size="large" 
                showBanIndicator={true}
              />
              
              {/* Панель модерации под аватаркой (только для админа) */}
              {isAdmin && (
                <AdminModerationPanel 
                  userId={userId}
                  isAdmin={isAdmin}
                  onModerationAction={handleModerationAction}
                />
              )}
            </div>
            
            <div className={styles.profileInfo}>
              <h1 className={styles.profileName}>
                {profileUser.displayName}
              </h1>
              {profileUser.userStatus && (
                <p className={styles.userStatus}>{profileUser.userStatus}</p>
              )}
              {/* Telegram username скрыт у других пользователей */}
            </div>
          </div>
        )}

        {/* Wall - лента активности */}
        <div className={styles.wallSection}>
          <h2 className={styles.sectionTitle}>Лента активности</h2>
          <Wall 
            userId={userId} 
            isOwnProfile={isOwnProfile}
            wallPrivacy={profileUser.wallPrivacy || 'all'}
            isFriend={isFriend}
          />
        </div>
      </div>
    </UserPageLayout>
  );
};

export default UserProfilePage;
