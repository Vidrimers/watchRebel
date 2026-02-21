import React, { useEffect, useState } from 'react';
import { useAppSelector } from '../hooks/useAppSelector';
import UserPageLayout from '../components/Layout/UserPageLayout';
import WallPost from '../components/Wall/WallPost';
import api from '../services/api';
import styles from './FeedPage.module.css';

/**
 * Страница ленты активности друзей
 * Отображает последние посты от всех друзей пользователя
 */
const FeedPage = () => {
  const { user } = useAppSelector((state) => state.auth);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Функция загрузки ленты
  const fetchFeed = async () => {
    if (!user) return;

    try {
      setError(null);
      const response = await api.get(`/feed/${user.id}`);
      setPosts(response.data);
    } catch (err) {
      console.error('Ошибка загрузки ленты:', err);
      setError(err.response?.data?.error || 'Не удалось загрузить ленту');
    } finally {
      setLoading(false);
    }
  };

  // Загрузка ленты при монтировании компонента
  useEffect(() => {
    fetchFeed();
  }, [user]);

  // Автообновление ленты каждые 30 секунд
  useEffect(() => {
    const interval = setInterval(() => {
      fetchFeed();
    }, 30000); // 30 секунд

    return () => clearInterval(interval);
  }, [user]);

  // Обработчик добавления реакции - обновляем ленту
  const handleReactionAdded = () => {
    fetchFeed();
  };

  return (
    <UserPageLayout>
      <div className={styles.feedPage}>
        <div className={styles.header}>
          <h1 className={styles.title}>📰 Лента друзей</h1>
        </div>

        {loading && posts.length === 0 ? (
          <div className={styles.loading}>
            <p>Загрузка ленты...</p>
          </div>
        ) : error ? (
          <div className={styles.error}>
            <p>❌ {error}</p>
            <button 
              className={styles.retryButton}
              onClick={fetchFeed}
            >
              Попробовать снова
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyIcon}>📭</p>
            <h2>Лента пуста</h2>
            <p className={styles.emptyHint}>
              Добавьте друзей, чтобы видеть их активность здесь
            </p>
            <a href="/friends" className={styles.findFriendsButton}>
              Найти друзей
            </a>
          </div>
        ) : (
          <div className={styles.postsList}>
            {posts.map((post) => {
              // Проверяем, является ли пост объявлением администратора
              const isAnnouncement = post.content?.startsWith('📢 Объявление администратора:');
              
              return (
                <div key={post.id} className={styles.postWrapper}>
                  {/* Информация об авторе поста (не показываем для объявлений) */}
                  {!isAnnouncement && (
                    <div className={styles.postAuthor}>
                      <a 
                        href={`/user/${post.userId}`}
                        className={styles.authorLink}
                      >
                        {post.author?.avatarUrl && (
                          <img 
                            src={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${post.author.avatarUrl}`}
                            alt={post.author.displayName}
                            className={styles.authorAvatar}
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        )}
                        <span className={styles.authorName}>
                          {post.author?.displayName || 'Пользователь'}
                        </span>
                      </a>
                    </div>
                  )}

                  {/* Сам пост */}
                  <WallPost 
                    post={post}
                    isOwnProfile={false}
                    onReactionChange={handleReactionAdded}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </UserPageLayout>
  );
};

export default FeedPage;
