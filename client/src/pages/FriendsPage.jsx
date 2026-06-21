import React, { useEffect, useState } from 'react';
import { useAppSelector } from '../hooks/useAppSelector';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import UserPageLayout from '../components/Layout/UserPageLayout';
import UserAvatar from '../components/User/UserAvatar';
import ReferralStats from '../components/User/ReferralStats';
import Icon from '../components/Common/Icon';
import { resolveDisplayNameWithTooltip } from '../utils/nicknameResolver';
import useConfirm from '../hooks/useConfirm';
import useAlert from '../hooks/useAlert';
import api from '../services/api';
import styles from './FriendsPage.module.css';

/**
 * Страница друзей
 * Отображает список друзей пользователя
 */
const FriendsPage = () => {
  const { user } = useAppSelector((state) => state.auth);
  const { userId: routeUserId } = useParams();
  const location = useLocation();
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showReferrals, setShowReferrals] = useState(false);
  const [activeTab, setActiveTab] = useState('friends');
  const { confirmDialog, showConfirm } = useConfirm();
  const { alertDialog, showAlert } = useAlert();
  const navigate = useNavigate();

  const isOwnProfile = !routeUserId || routeUserId === user?.id;
  const targetUserId = routeUserId || user?.id;

  // Проверяем query параметр при загрузке
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'requests') {
      setActiveTab('requests');
    }
  }, [location.search]);

  useEffect(() => {
    if (targetUserId) {
      loadFriends();
      if (isOwnProfile) {
        loadFriendRequests();
      }
    }
  }, [targetUserId]);

  const loadFriends = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/users/${targetUserId}/friends`);
      setFriends(response.data);
    } catch (err) {
      console.error('Ошибка загрузки друзей:', err);
      setError('Не удалось загрузить список друзей');
    } finally {
      setLoading(false);
    }
  };

  const loadFriendRequests = async () => {
    try {
      const response = await api.get('/friend-requests');
      setFriendRequests(response.data);
    } catch (err) {
      console.error('Ошибка загрузки запросов в друзья:', err);
    }
  };

  const handleVisitProfile = (friendId) => {
    window.location.href = `/user/${friendId}`;
  };

  const handleRemoveFriend = async (friendId, friendName) => {
    const confirmed = await showConfirm({
      title: 'Удалить из друзей?',
      message: `Вы уверены, что хотите удалить ${friendName} из друзей?`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/users/${user.id}/friends/${friendId}`);
      await showAlert({
        title: 'Успешно',
        message: `${friendName} удален из друзей`,
        type: 'success'
      });
      // Перезагружаем список друзей
      loadFriends();
    } catch (err) {
      console.error('Ошибка удаления друга:', err);
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось удалить друга. Попробуйте еще раз.',
        type: 'error'
      });
    }
  };

  const handleAcceptRequest = async (requestId, userName) => {
    try {
      await api.put(`/friend-requests/${requestId}/accept`);
      await showAlert({
        title: 'Успешно',
        message: `${userName} добавлен в друзья`,
        type: 'success'
      });
      // Перезагружаем списки
      loadFriends();
      loadFriendRequests();
    } catch (err) {
      console.error('Ошибка принятия запроса:', err);
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось принять запрос. Попробуйте еще раз.',
        type: 'error'
      });
    }
  };

  const handleRejectRequest = async (requestId, userName) => {
    const confirmed = await showConfirm({
      title: 'Отклонить запрос?',
      message: `Вы уверены, что хотите отклонить запрос от ${userName}?`,
      confirmText: 'Отклонить',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });

    if (!confirmed) {
      return;
    }

    try {
      await api.put(`/friend-requests/${requestId}/reject`);
      await showAlert({
        title: 'Запрос отклонен',
        message: `Запрос от ${userName} отклонен`,
        type: 'success'
      });
      // Перезагружаем список запросов
      loadFriendRequests();
    } catch (err) {
      console.error('Ошибка отклонения запроса:', err);
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось отклонить запрос. Попробуйте еще раз.',
        type: 'error'
      });
    }
  };

  const handleBlockUser = async (requestId, userId, userName) => {
    const confirmed = await showConfirm({
      title: 'Заблокировать пользователя?',
      message: `Вы уверены, что хотите заблокировать ${userName}? Вы не будете видеть его посты и сообщения.`,
      confirmText: 'Заблокировать',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });

    if (!confirmed) {
      return;
    }

    try {
      // Сначала отклоняем запрос
      await api.put(`/friend-requests/${requestId}/reject`);
      // Затем блокируем пользователя
      await api.post(`/users/${userId}/block`);
      await showAlert({
        title: 'Пользователь заблокирован',
        message: `${userName} заблокирован`,
        type: 'success'
      });
      // Перезагружаем список запросов
      loadFriendRequests();
    } catch (err) {
      console.error('Ошибка блокировки пользователя:', err);
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось заблокировать пользователя. Попробуйте еще раз.',
        type: 'error'
      });
    }
  };

  if (loading) {
    return (
      <UserPageLayout user={user}>
        <div className={styles.container}>
          <div className={styles.loading}>Загрузка друзей...</div>
        </div>
      </UserPageLayout>
    );
  }

  if (error) {
    return (
      <UserPageLayout user={user}>
        <div className={styles.container}>
          <div className={styles.error}>{error}</div>
        </div>
      </UserPageLayout>
    );
  }

  return (
    <UserPageLayout user={user}>
      {confirmDialog}
      {alertDialog}
      <div className={styles.container}>
        {!showReferrals ? (
          <>
            <h1 className={styles.title}>
              {isOwnProfile ? 'Мои друзья' : `Друзья`}
            </h1>
            
            {!isOwnProfile && (
              <button 
                className={styles.backButton}
                onClick={() => navigate(`/user/${routeUserId}`)}
              >
                <Icon name="arrow-left" size="medium" />
                <span>Назад</span>
              </button>
            )}
            
            {/* Вкладки */}
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${activeTab === 'friends' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('friends')}
              >
                Друзья ({friends.length})
              </button>
              {isOwnProfile && (
                <button
                  className={`${styles.tab} ${activeTab === 'requests' ? styles.activeTab : ''}`}
                  onClick={() => setActiveTab('requests')}
                >
                  Запросы в друзья ({friendRequests.length})
                </button>
              )}
            </div>
            
            {/* Кнопка для открытия списка рефералов (только для своих друзей) */}
            {isOwnProfile && (
              <div className={styles.referralCard} onClick={() => setShowReferrals(true)}>
                <div className={styles.referralCardContent}>
                  <Icon name="friends" size="medium" />
                  <span>Приглашенные друзья</span>
                </div>
                <Icon name="chevron-right" size="small" />
              </div>
            )}
            
            {/* Контент вкладок */}
            {activeTab === 'friends' ? (
              friends.length === 0 ? (
                <div className={styles.empty}>
                  <span className={styles.emptyIcon}><Icon name="friends" size="large" /></span>
                  <p>У вас пока нет друзей</p>
                  <p className={styles.emptyHint}>
                    Найдите пользователей через поиск и добавьте их в друзья
                  </p>
                </div>
              ) : (
                <div className={styles.friendsList}>
                  {friends.map((friend) => (
                    <div key={friend.id} className={styles.friendCard}>
                      <UserAvatar 
                        user={friend} 
                        size="medium" 
                        className={styles.friendAvatar}
                      />
                      
                      <div className={styles.friendInfo}>
                        <h3 className={`${styles.friendName} ${resolveDisplayNameWithTooltip(friend.id, friend.displayName).isNickname ? 'displayNameNickname' : ''}`} title={resolveDisplayNameWithTooltip(friend.id, friend.displayName).tooltip}>
                          {resolveDisplayNameWithTooltip(friend.id, friend.displayName).text}
                          {friend.userStatus && (
                            <span className={styles.friendStatus}> | {friend.userStatus}</span>
                          )}
                        </h3>
                        {friend.telegramUsername && (
                          <p className={styles.friendUsername}>@{friend.telegramUsername}</p>
                        )}
                      </div>
                      
                      <div className={styles.friendActions}>
                        <button
                          className={styles.visitButton}
                          onClick={() => handleVisitProfile(friend.id)}
                        >
                          Перейти в профиль
                        </button>
                        
                        {isOwnProfile && (
                          <button
                            className={styles.removeFriendButton}
                            onClick={() => handleRemoveFriend(friend.id, friend.displayName)}
                          >
                            Удалить из друзей
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              // Вкладка запросов в друзья
              friendRequests.length === 0 ? (
                <div className={styles.empty}>
                  <span className={styles.emptyIcon}><Icon name="friends" size="large" /></span>
                  <p>Нет новых запросов в друзья</p>
                </div>
              ) : (
                <div className={styles.requestsList}>
                  {friendRequests.map((request) => (
                    <div key={request.id} className={styles.requestCard}>
                      <UserAvatar 
                        user={{ 
                          id: request.from_user_id,
                          displayName: request.display_name,
                          avatarUrl: request.avatar_url
                        }} 
                        size="medium" 
                        className={styles.requestAvatar}
                      />
                      
                      <div className={styles.requestInfo}>
                        <h3 className={styles.requestName}>{request.display_name}</h3>
                        {request.telegram_username && (
                          <p className={styles.requestUsername}>@{request.telegram_username}</p>
                        )}
                        <p className={styles.requestDate}>
                          {new Date(request.created_at).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                      
                      <div className={styles.requestActions}>
                        <button
                          className={styles.acceptButton}
                          onClick={() => handleAcceptRequest(request.id, request.display_name)}
                        >
                          ✓ Принять
                        </button>
                        
                        <button
                          className={styles.rejectButton}
                          onClick={() => handleRejectRequest(request.id, request.display_name)}
                        >
                          ✗ Отклонить
                        </button>
                        
                        <button
                          className={styles.blockButton}
                          onClick={() => handleBlockUser(request.id, request.from_user_id, request.display_name)}
                        >
                          🚫 Заблокировать
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        ) : (
          <>
            {/* Экран списка рефералов */}
            <div className={styles.referralsScreen}>
              <button 
                onClick={() => setShowReferrals(false)}
                className={styles.backButton}
              >
                <Icon name="arrow-left" size="medium" />
                <span>Назад</span>
              </button>
              
              <ReferralStats userId={user.id} />
            </div>
          </>
        )}
      </div>
    </UserPageLayout>
  );
};

export default FriendsPage;
