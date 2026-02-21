import React, { useEffect, useState } from 'react';
import { useAppSelector } from '../hooks/useAppSelector';
import UserPageLayout from '../components/Layout/UserPageLayout';
import UserAvatar from '../components/User/UserAvatar';
import api from '../services/api';
import styles from './FriendsPage.module.css';

/**
 * Страница друзей
 * Отображает список друзей пользователя
 */
const FriendsPage = () => {
  const { user } = useAppSelector((state) => state.auth);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      loadFriends();
    }
  }, [user]);

  const loadFriends = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/users/${user.id}/friends`);
      setFriends(response.data);
    } catch (err) {
      console.error('Ошибка загрузки друзей:', err);
      setError('Не удалось загрузить список друзей');
    } finally {
      setLoading(false);
    }
  };

  const handleVisitProfile = (friendId) => {
    window.location.href = `/user/${friendId}`;
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
      <div className={styles.container}>
        <h1 className={styles.title}>Мои друзья</h1>
        
        {friends.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>👥</span>
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
                  <h3 className={styles.friendName}>{friend.displayName}</h3>
                  {friend.telegramUsername && (
                    <p className={styles.friendUsername}>@{friend.telegramUsername}</p>
                  )}
                </div>
                
                <button
                  className={styles.visitButton}
                  onClick={() => handleVisitProfile(friend.id)}
                >
                  Перейти в профиль
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </UserPageLayout>
  );
};

export default FriendsPage;
