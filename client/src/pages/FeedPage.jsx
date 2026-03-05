import React, { useEffect } from 'react';
import { useAppSelector } from '../hooks/useAppSelector';
import useInfiniteScroll from '../hooks/useInfiniteScroll';
import UserPageLayout from '../components/Layout/UserPageLayout';
import WallPost from '../components/Wall/WallPost';
import Icon from '../components/Common/Icon';
import api from '../services/api';
import styles from './FeedPage.module.css';

/**
 * Страница ленты активности друзей
 * Отображает последние посты от всех друзей пользователя с infinite scroll
 */
const FeedPage = () => {
  const { user } = useAppSelector((state) => state.auth);

  // Функция загрузки ленты с пагинацией
  const fetchFeed = async (limit, offset) => {
    if (!user) return { posts: [], hasMore: false };
    const response = await api.get(`/feed/${user.id}`, {
      params: { limit, offset }
    });
    return response.data;
  };

  // Используем хук infinite scroll
  const { items: posts, loading, hasMore, refresh, error } = useInfiniteScroll(fetchFeed, 20);

  // Автообновление ленты каждые 30 секунд (только первая страница)
  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 30000); // 30 секунд

    return () => clearInterval(interval);
  }, [refresh]);

  // Обработчик добавления реакции - обновляем ленту
  const handleReactionAdded = () => {
    refresh();
  };

  return (
    <UserPageLayout user={user}>
      <div className={styles.feedPage}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            <Icon name="feed" size="medium" /> Лента друзей
          </h1>
        </div>

        {loading && posts.length === 0 ? (
          <div className={styles.loading}>
            <p>Загрузка ленты...</p>
          </div>
        ) : error ? (
          <div className={styles.error}>
            <p>
              <Icon name="close" size="small" /> {error}
            </p>
            <button 
              className={styles.retryButton}
              onClick={refresh}
            >
              Попробовать снова
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className={styles.emptyState}>
            <Icon name="mailbox" size={64} className={styles.emptyIcon} />
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
                      <div className={styles.authorLink}>
                        {/* Аватар автора */}
                        <div className={styles.avatarContainer}>
                          {post.author?.avatarUrl ? (
                            <img 
                              src={post.author.avatarUrl.startsWith('http') 
                                ? post.author.avatarUrl 
                                : `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${post.author.avatarUrl}`
                              }
                              alt={post.author.displayName}
                              className={styles.authorAvatar}
                              title={post.author?.userStatus || post.author?.displayName}
                              onClick={() => window.location.href = `/user/${post.author.id}`}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                const placeholder = document.createElement('div');
                                placeholder.className = styles.avatarPlaceholder;
                                placeholder.textContent = (post.author?.displayName || 'U').charAt(0).toUpperCase();
                                e.target.parentElement.appendChild(placeholder);
                              }}
                            />
                          ) : (
                            <div 
                              className={styles.avatarPlaceholder}
                              title={post.author?.userStatus || post.author?.displayName}
                            >
                              {(post.author?.displayName || 'U').charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        
                        <span className={styles.authorName}>
                          {/* Если автор !== владелец стены, показываем "автор → владелец" */}
                          {post.author?.id !== post.wallOwner?.id ? (
                            <>
                              <a 
                                href={`/user/${post.author.id}`} 
                                style={{ color: 'inherit', textDecoration: 'none' }}
                                title={post.author?.userStatus || ''}
                              >
                                {post.author?.displayName || 'Пользователь'}
                              </a>
                              <span style={{ color: 'var(--text-tertiary)', margin: '0 8px' }}>→</span>
                              
                              {/* Аватар владельца стены */}
                              <div className={styles.avatarContainer} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
                                {post.wallOwner?.avatarUrl ? (
                                  <img 
                                    src={post.wallOwner.avatarUrl.startsWith('http') 
                                      ? post.wallOwner.avatarUrl 
                                      : `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${post.wallOwner.avatarUrl}`
                                    }
                                    alt={post.wallOwner.displayName}
                                    className={styles.authorAvatar}
                                    title={post.wallOwner?.displayName || ''}
                                    onClick={() => window.location.href = `/user/${post.wallOwner.id}`}
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      const placeholder = document.createElement('div');
                                      placeholder.className = styles.avatarPlaceholder;
                                      placeholder.textContent = (post.wallOwner?.displayName || 'U').charAt(0).toUpperCase();
                                      e.target.parentElement.appendChild(placeholder);
                                    }}
                                  />
                                ) : (
                                  <div 
                                    className={styles.avatarPlaceholder}
                                    title={post.wallOwner?.displayName || ''}
                                  >
                                    {(post.wallOwner?.displayName || 'U').charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              
                              <a 
                                href={`/user/${post.wallOwner.id}`} 
                                style={{ color: 'inherit', textDecoration: 'none' }}
                                title={post.wallOwner?.displayName || ''}
                              >
                                {post.wallOwner?.displayName || 'Пользователь'}
                              </a>
                            </>
                          ) : (
                            <a 
                              href={`/user/${post.author.id}`} 
                              style={{ color: 'inherit', textDecoration: 'none' }}
                              title={post.author?.userStatus || ''}
                            >
                              {post.author?.displayName || 'Пользователь'}
                            </a>
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Сам пост */}
                  <WallPost 
                    post={post}
                    isOwnProfile={false}
                    onReactionChange={handleReactionAdded}
                    isFeedView={true}
                  />
                </div>
              );
            })}

            {/* Индикатор загрузки при подгрузке */}
            {loading && posts.length > 0 && (
              <div className={styles.loadingMore}>
                <p>Загрузка...</p>
              </div>
            )}

            {/* Сообщение о конце списка */}
            {!hasMore && posts.length > 0 && (
              <div className={styles.endOfList}>
                <p>Вы просмотрели все посты</p>
              </div>
            )}
          </div>
        )}
      </div>
    </UserPageLayout>
  );
};

export default FeedPage;
