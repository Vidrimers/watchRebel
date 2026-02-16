import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { fetchWall } from '../store/slices/wallSlice';
import UserPageLayout from '../components/Layout/UserPageLayout';
import UserAvatar from '../components/User/UserAvatar';
import styles from './UserProfilePage.module.css';

/**
 * Страница профиля пользователя
 * Отображает Wall пользователя и его информацию
 */
const UserProfilePage = () => {
  const { userId } = useParams();
  const dispatch = useAppDispatch();
  
  const { user: currentUser, isAuthenticated } = useAppSelector((state) => state.auth);
  const { posts, loading, error } = useAppSelector((state) => state.wall);

  // Определяем, это свой профиль или чужой
  const isOwnProfile = currentUser?.id === userId;
  
  // Для отображения используем текущего пользователя если это свой профиль
  // В будущем здесь будет загрузка профиля другого пользователя
  const profileUser = isOwnProfile ? currentUser : null;

  useEffect(() => {
    if (userId) {
      // Загружаем Wall пользователя
      dispatch(fetchWall(userId));
    }
  }, [userId, dispatch]);

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

        {/* Wall - лента активности */}
        <div className={styles.wallSection}>
          <h2 className={styles.sectionTitle}>Лента активности</h2>
          
          {loading && (
            <div className={styles.loadingContainer}>
              <p>Загрузка...</p>
            </div>
          )}

          {error && (
            <div className={styles.errorMessage}>
              <p>Ошибка загрузки: {error.message || 'Неизвестная ошибка'}</p>
            </div>
          )}

          {!loading && !error && posts.length === 0 && (
            <div className={styles.emptyState}>
              <p>Пока нет записей на стене</p>
              {isOwnProfile && (
                <p className={styles.emptyHint}>
                  Добавьте фильмы в списки или оцените контент, чтобы создать первую запись!
                </p>
              )}
            </div>
          )}

          {!loading && !error && posts.length > 0 && (
            <div className={styles.postsList}>
              {posts.map((post) => (
                <div key={post.id} className={styles.postCard}>
                  <div className={styles.postHeader}>
                    <span className={styles.postDate}>
                      {new Date(post.createdAt).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <span className={styles.postType}>
                      {post.postType === 'text' && '📝 Текст'}
                      {post.postType === 'media_added' && '➕ Добавлен контент'}
                      {post.postType === 'rating' && '⭐ Оценка'}
                      {post.postType === 'review' && '✍️ Отзыв'}
                    </span>
                  </div>
                  
                  <div className={styles.postContent}>
                    {post.content && <p>{post.content}</p>}
                    {post.rating && (
                      <div className={styles.ratingDisplay}>
                        Оценка: <strong>{post.rating}/10</strong>
                      </div>
                    )}
                  </div>

                  {/* Реакции */}
                  {post.reactions && post.reactions.length > 0 && (
                    <div className={styles.reactions}>
                      {post.reactions.map((reaction) => (
                        <span key={reaction.id} className={styles.reaction}>
                          {reaction.emoji}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </UserPageLayout>
  );
};

export default UserProfilePage;
