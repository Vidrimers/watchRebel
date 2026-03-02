import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import useConfirm from '../hooks/useConfirm';
import UserPageLayout from '../components/Layout/UserPageLayout';
import UserAvatar from '../components/User/UserAvatar';
import Icon from '../components/Common/Icon';
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
  const navigate = useNavigate();
  const { confirmDialog, showConfirm } = useConfirm();
  
  const { user: currentUser, isAuthenticated } = useAppSelector((state) => state.auth);
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFriend, setIsFriend] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

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
        setIsBlocked(response.data.isBlockedByMe || false);
        
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
   * Закрытие dropdown меню при клике вне его
   */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMoreMenu && !event.target.closest(`.${styles.moreMenuContainer}`)) {
        setShowMoreMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMoreMenu]);

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

  /**
   * Добавить пользователя в друзья
   */
  const handleAddFriend = async () => {
    if (actionLoading) return;
    
    try {
      setActionLoading(true);
      await api.post(`/users/${userId}/friends`);
      setIsFriend(true);
      console.log('Пользователь добавлен в друзья');
    } catch (error) {
      console.error('Ошибка добавления в друзья:', error);
      alert(error.response?.data?.error || 'Ошибка добавления в друзья');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Удалить пользователя из друзей
   */
  const handleRemoveFriend = async () => {
    if (actionLoading) return;
    
    const confirmed = await showConfirm({
      title: 'Удалить из друзей?',
      message: `Вы уверены, что хотите удалить ${profileUser?.displayName} из друзей?`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });

    if (!confirmed) return;

    try {
      setActionLoading(true);
      await api.delete(`/users/${currentUser.id}/friends/${userId}`);
      setIsFriend(false);
      console.log('Пользователь удален из друзей');
    } catch (error) {
      console.error('Ошибка удаления из друзей:', error);
      alert(error.response?.data?.error || 'Ошибка удаления из друзей');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Отправить сообщение пользователю
   */
  const handleSendMessage = () => {
    navigate(`/messages/${userId}`);
  };

  /**
   * Заблокировать пользователя
   */
  const handleBlockUser = async () => {
    if (actionLoading) return;
    
    const confirmed = await showConfirm({
      title: 'Заблокировать пользователя?',
      message: `Вы уверены, что хотите заблокировать ${profileUser?.displayName}? Вы не будете видеть его посты и сообщения.`,
      confirmText: 'Заблокировать',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });

    if (!confirmed) return;

    try {
      setActionLoading(true);
      await api.post(`/users/${userId}/block`);
      setIsBlocked(true);
      setIsFriend(false); // Автоматически удаляется из друзей
      setShowMoreMenu(false);
      console.log('Пользователь заблокирован');
    } catch (error) {
      console.error('Ошибка блокировки пользователя:', error);
      alert(error.response?.data?.error || 'Ошибка блокировки пользователя');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Разблокировать пользователя
   */
  const handleUnblockUser = async () => {
    if (actionLoading) return;
    
    const confirmed = await showConfirm({
      title: 'Разблокировать пользователя?',
      message: `Вы уверены, что хотите разблокировать ${profileUser?.displayName}?`,
      confirmText: 'Разблокировать',
      cancelText: 'Отмена',
      confirmButtonStyle: 'primary'
    });

    if (!confirmed) return;

    try {
      setActionLoading(true);
      await api.delete(`/users/${userId}/unblock`);
      setIsBlocked(false);
      setShowMoreMenu(false);
      console.log('Пользователь разблокирован');
    } catch (error) {
      console.error('Ошибка разблокировки пользователя:', error);
      alert(error.response?.data?.error || 'Ошибка разблокировки пользователя');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Показать сообщение "Скоро будет доступно"
   */
  const handleComingSoon = async () => {
    await showConfirm({
      title: 'Скоро будет доступно',
      message: 'Эта функция находится в разработке и скоро будет доступна.',
      confirmText: 'Понятно',
      cancelText: null,
      confirmButtonStyle: 'primary'
    });
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
      {confirmDialog}
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
              
              {/* Кнопка отправить сообщение */}
              {!isBlocked && (
                <div className={styles.profileActions}>
                  <button 
                    className={`${styles.actionButton} ${styles.messageButton}`}
                    onClick={handleSendMessage}
                    aria-label="Отправить сообщение"
                    title="Отправить сообщение"
                  >
                    <Icon name="message" size={18} />
                  </button>
                  
                  <button 
                    className={`${styles.actionButton} ${styles.iconButton}`}
                    onClick={handleComingSoon}
                    aria-label="Фильмы"
                    title="Фильмы"
                  >
                    <Icon name="movies" size={18} />
                  </button>
                  
                  <button 
                    className={`${styles.actionButton} ${styles.iconButton}`}
                    onClick={handleComingSoon}
                    aria-label="Сериалы"
                    title="Сериалы"
                  >
                    <Icon name="tv" size={18} />
                  </button>
                  
                  <button 
                    className={`${styles.actionButton} ${styles.iconButton}`}
                    onClick={handleComingSoon}
                    aria-label="Хочу посмотреть"
                    title="Хочу посмотреть"
                  >
                    <Icon name="watchlist" size={18} />
                  </button>
                </div>
              )}
            </div>
            
            {/* Кнопка "Еще" в правом верхнем углу */}
            <div className={styles.moreMenuContainer}>
              <button 
                className={styles.moreButton}
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                aria-label="Дополнительные действия"
              >
                ⋮
              </button>
              
              {showMoreMenu && (
                <div className={styles.moreMenu}>
                  {/* Добавить/удалить из друзей */}
                  {!isBlocked && (
                    isFriend ? (
                      <button 
                        className={`${styles.menuItem} ${styles.removeFriendItem}`}
                        onClick={handleRemoveFriend}
                        disabled={actionLoading}
                      >
                        ➖ Удалить из друзей
                      </button>
                    ) : (
                      <button 
                        className={styles.menuItem}
                        onClick={handleAddFriend}
                        disabled={actionLoading}
                      >
                        ➕ Добавить в друзья
                      </button>
                    )
                  )}
                  
                  {/* Блокировка/разблокировка */}
                  {isBlocked ? (
                    <button 
                      className={styles.menuItem}
                      onClick={handleUnblockUser}
                      disabled={actionLoading}
                    >
                      ✅ Разблокировать
                    </button>
                  ) : (
                    <button 
                      className={`${styles.menuItem} ${styles.dangerItem}`}
                      onClick={handleBlockUser}
                      disabled={actionLoading}
                    >
                      🚫 Заблокировать
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Wall - стена пользователя */}
        <div className={styles.wallSection}>
          <h2 className={styles.sectionTitle}>Стена</h2>
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
