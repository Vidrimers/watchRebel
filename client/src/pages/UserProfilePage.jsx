import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import useConfirm from '../hooks/useConfirm';
import useAlert from '../hooks/useAlert';
import UserPageLayout from '../components/Layout/UserPageLayout';
import UserAvatar from '../components/User/UserAvatar';
import Icon from '../components/Common/Icon';
import ReportModal from '../components/Common/ReportModal';
import { resolveDisplayNameWithTooltip } from '../utils/nicknameResolver';
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
  const { alertDialog, showAlert } = useAlert();
  
  const { user: currentUser, isAuthenticated } = useAppSelector((state) => state.auth);
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFriend, setIsFriend] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [currentNickname, setCurrentNickname] = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameLoading, setNicknameLoading] = useState(false);

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
        
        // Проверяем, являемся ли мы друзьями или есть ли отправленный запрос
        if (currentUser?.id) {
          try {
            // Проверяем дружбу
            const friendsResponse = await api.get(`/users/${currentUser.id}/friends`);
            const friends = friendsResponse.data || [];
            const areFriends = friends.some(friend => friend.id === userId);
            
            if (areFriends) {
              setIsFriend(true);
            } else {
              // Проверяем, есть ли отправленный запрос
              try {
                const requestsResponse = await api.get('/friend-requests/sent');
                const sentRequests = requestsResponse.data || [];
                const hasPendingRequest = sentRequests.some(req => req.to_user_id === userId);
                setIsFriend(hasPendingRequest ? 'pending' : false);
              } catch (err) {
                console.error('Ошибка проверки запросов:', err);
                setIsFriend(false);
              }
            }
          } catch (err) {
            console.error('Ошибка проверки дружбы:', err);
            setIsFriend(false);
          }
        }
      } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        
        // Проверяем, заблокировал ли пользователь меня
        if (error.response?.status === 403 && error.response?.data?.code === 'ACCESS_DENIED') {
          setAccessDenied(true);
        }
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && userId) {
      fetchProfile();
    }
  }, [userId, isAuthenticated, isOwnProfile, currentUser]);

  // Загрузка ника для чужого профиля
  useEffect(() => {
    if (!isOwnProfile && userId && isAuthenticated) {
      api.get(`/users/${userId}/nickname`)
        .then(res => {
          setCurrentNickname(res.data.nickname || '');
          setNicknameInput(res.data.nickname || '');
        })
        .catch(() => {});
    }
  }, [userId, isOwnProfile, isAuthenticated]);

  const handleSaveNickname = async () => {
    if (!nicknameInput.trim()) {
      try {
        await api.delete(`/users/${userId}/nickname`);
        setCurrentNickname('');
      } catch (err) {
        console.error(err);
      }
    } else {
      setNicknameLoading(true);
      try {
        const res = await api.put(`/users/${userId}/nickname`, { nickname: nicknameInput.trim() });
        setCurrentNickname(res.data.nickname);
      } catch (err) {
        console.error(err);
      }
      setNicknameLoading(false);
    }
    setShowNicknameModal(false);
  };

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
   * Добавить пользователя в друзья (отправить запрос)
   */
  const handleAddFriend = async () => {
    if (actionLoading) return;
    
    try {
      setActionLoading(true);
      await api.post('/friend-requests', { toUserId: userId });
      
      // Показываем уведомление
      await showAlert({
        title: 'Запрос отправлен',
        message: 'Запрос в друзья успешно отправлен',
        type: 'success'
      });
      
      // Обновляем состояние - теперь показываем "Запрос отправлен"
      setIsFriend('pending'); // Используем 'pending' для обозначения отправленного запроса
      console.log('Запрос в друзья отправлен');
    } catch (error) {
      console.error('Ошибка отправки запроса в друзья:', error);
      await showAlert({
        title: 'Ошибка',
        message: error.response?.data?.error || 'Ошибка отправки запроса в друзья',
        type: 'error'
      });
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
      
      await showAlert({
        title: 'Пользователь заблокирован',
        message: `${profileUser?.displayName} заблокирован`,
        type: 'success'
      });
      
      console.log('Пользователь заблокирован');
    } catch (error) {
      console.error('Ошибка блокировки пользователя:', error);
      await showAlert({
        title: 'Ошибка',
        message: error.response?.data?.error || 'Ошибка блокировки пользователя',
        type: 'error'
      });
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
      
      await showAlert({
        title: 'Пользователь разблокирован',
        message: `${profileUser?.displayName} разблокирован`,
        type: 'success'
      });
      
      console.log('Пользователь разблокирован');
    } catch (error) {
      console.error('Ошибка разблокировки пользователя:', error);
      await showAlert({
        title: 'Ошибка',
        message: error.response?.data?.error || 'Ошибка разблокировки пользователя',
        type: 'error'
      });
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

  // Если пользователь заблокировал меня
  if (accessDenied) {
    return (
      <UserPageLayout user={currentUser}>
        <div className={styles.errorContainer}>
          <div className={styles.accessDenied}>
            <Icon name="block" size={64} />
            <h2>Доступ ограничен</h2>
            <p>Этот пользователь ограничил доступ к своему профилю</p>
          </div>
        </div>
      </UserPageLayout>
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
      {alertDialog}
      {showReportModal && (
        <ReportModal
          reportedUserId={userId}
          reportedUserName={profileUser.displayName || profileUser.username}
          onClose={() => setShowReportModal(false)}
        />
      )}
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
                {resolveDisplayNameWithTooltip(userId, profileUser.displayName).text}
              </h1>
              {profileUser.userStatus && (
                <p className={styles.userStatus}>{profileUser.userStatus}</p>
              )}
              
              {profileUser.postsCount > 0 && (
                <p className={styles.postsCount}>Постов: {profileUser.postsCount}</p>
              )}

              {profileUser.friendsCount > 0 && (
                <button 
                  className={styles.friendsLink}
                  onClick={() => navigate(`/user/${userId}/friends`)}
                >
                  Друзей: {profileUser.friendsCount}
                </button>
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
                    onClick={() => navigate(`/user/${userId}/lists/movies`)}
                    aria-label="Фильмы"
                    title="Фильмы"
                  >
                    <Icon name="movies" size={18} />
                  </button>
                  
                  <button 
                    className={`${styles.actionButton} ${styles.iconButton}`}
                    onClick={() => navigate(`/user/${userId}/lists/tv`)}
                    aria-label="Сериалы"
                    title="Сериалы"
                  >
                    <Icon name="tv" size={18} />
                  </button>
                  
                  <button 
                    className={`${styles.actionButton} ${styles.iconButton}`}
                    onClick={() => navigate(`/user/${userId}/watchlist`)}
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
                    isFriend === true ? (
                      <button 
                        className={`${styles.menuItem} ${styles.removeFriendItem}`}
                        onClick={handleRemoveFriend}
                        disabled={actionLoading}
                      >
                        <Icon name="remove" size="small" /> Удалить из друзей
                      </button>
                    ) : isFriend === 'pending' ? (
                      <button 
                        className={styles.menuItem}
                        disabled={true}
                      >
                        <Icon name="clock" size="small" /> Запрос отправлен
                      </button>
                    ) : (
                      <button 
                        className={styles.menuItem}
                        onClick={handleAddFriend}
                        disabled={actionLoading}
                      >
                        <Icon name="add" size="small" /> Добавить в друзья
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
                      <Icon name="check" size="small" /> Разблокировать
                    </button>
                  ) : (
                    <button 
                      className={`${styles.menuItem} ${styles.dangerItem}`}
                      onClick={handleBlockUser}
                      disabled={actionLoading}
                    >
                      <Icon name="ban" size="small" /> Заблокировать
                    </button>
                  )}
                  <button 
                    className={styles.menuItem}
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowReportModal(true);
                    }}
                  >
                    <Icon name="report" size="small" /> Пожаловаться
                  </button>
                  {!isOwnProfile && (
                    <button 
                      className={styles.menuItem}
                      onClick={() => {
                        setShowMoreMenu(false);
                        setShowNicknameModal(true);
                      }}
                    >
                      <Icon name="edit" size="small" /> {currentNickname ? 'Изменить ник' : 'Задать ник'}
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

      {/* Модальное окно задания ника */}
      {showNicknameModal && (
        <div className={styles.modalOverlay} onClick={() => setShowNicknameModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              {currentNickname ? 'Изменить ник' : 'Задать ник'}
            </h3>
            <p className={styles.modalDescription}>
              Этот ник будет отображаться только вам вместо имени пользователя.
            </p>
            <input
              type="text"
              className={styles.nicknameInput}
              value={nicknameInput}
              onChange={e => setNicknameInput(e.target.value)}
              placeholder="Введите ник (макс. 30 символов)"
              maxLength={30}
              autoFocus
            />
            <div className={styles.modalActions}>
              <button
                className={styles.modalSaveButton}
                onClick={handleSaveNickname}
                disabled={nicknameLoading}
              >
                {nicknameLoading ? 'Сохранение...' : 'Сохранить'}
              </button>
              {currentNickname && (
                <button
                  className={styles.modalDeleteButton}
                  onClick={async () => {
                    try {
                      await api.delete(`/users/${userId}/nickname`);
                      setCurrentNickname('');
                      setNicknameInput('');
                      setShowNicknameModal(false);
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                >
                  <Icon name="delete" size="small" /> Удалить
                </button>
              )}
              <button
                className={styles.modalCancelButton}
                onClick={() => {
                  setNicknameInput(currentNickname);
                  setShowNicknameModal(false);
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </UserPageLayout>
  );
};

export default UserProfilePage;
