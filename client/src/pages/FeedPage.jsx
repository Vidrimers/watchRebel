import React, { useEffect, useState, useCallback } from 'react';
import { useAppSelector } from '../hooks/useAppSelector';
import useInfiniteScroll from '../hooks/useInfiniteScroll';
import UserPageLayout from '../components/Layout/UserPageLayout';
import WallPost from '../components/Wall/WallPost';
import Icon from '../components/Common/Icon';
import api from '../services/api';
import { addMessageHandler, removeMessageHandler } from '../services/websocket';
import styles from './FeedPage.module.css';

/**
 * Страница ленты активности друзей
 * Отображает последние посты от всех друзей пользователя с infinite scroll
 */
const FeedPage = () => {
  const { user } = useAppSelector((state) => state.auth);
  const [newPostsCount, setNewPostsCount] = useState(0);

  // Функция загрузки ленты с пагинацией
  const fetchFeed = async (limit, offset) => {
    if (!user) return { posts: [], hasMore: false };
    const response = await api.get(`/feed/${user.id}`, {
      params: { limit, offset }
    });
    return response.data;
  };

  // Используем хук infinite scroll
  const { items: posts, loading, hasMore, refresh, error, setItems } = useInfiniteScroll(fetchFeed, 20);

  // WebSocket обработчик для обновлений ленты
  const handleWebSocketMessage = useCallback((data) => {
    if (data.type === 'feed_new_post') {
      const newPost = data.post;
      
      // Если это пост текущего пользователя - добавляем сразу в ленту
      if (newPost.author?.id === user?.id) {
        setItems(prevPosts => {
          // Проверяем, нет ли уже этого поста (избегаем дублирования)
          const postExists = prevPosts.some(p => p.id === newPost.id);
          if (postExists) {
            return prevPosts;
          }
          // Добавляем пост в начало ленты
          return [newPost, ...prevPosts];
        });
      } else {
        // Для постов друзей - увеличиваем счетчик
        setNewPostsCount(prev => prev + 1);
      }
    } else if (data.type === 'post_updated') {
      // Обновление содержимого поста (редактирование)
      const updatedPost = data.post;
      
      setItems(prevPosts => {
        return prevPosts.map(post => {
          if (post.id === updatedPost.id) {
            // Обновляем пост полностью
            return { ...post, ...updatedPost };
          }
          return post;
        });
      });
    } else if (data.type === 'post_deleted') {
      // Удаление поста
      const { postId } = data;
      
      setItems(prevPosts => {
        return prevPosts.filter(post => post.id !== postId);
      });
    } else if (data.type === 'feed_post_update') {
      // Обновление поста (реакция или комментарий)
      const { postId, updateType, data: updateData } = data;
      
      setItems(prevPosts => {
        return prevPosts.map(post => {
          if (post.id === postId) {
            if (updateType === 'reaction') {
              // Обновляем реакции
              const existingReactionIndex = post.reactions?.findIndex(
                r => r.userId === updateData.userId
              );
              
              const updatedReactions = post.reactions ? [...post.reactions] : [];
              
              if (existingReactionIndex >= 0) {
                // Обновляем существующую реакцию
                updatedReactions[existingReactionIndex] = {
                  id: updateData.reactionId,
                  userId: updateData.userId,
                  emoji: updateData.emoji,
                  user: updateData.user
                };
              } else {
                // Добавляем новую реакцию
                updatedReactions.push({
                  id: updateData.reactionId,
                  userId: updateData.userId,
                  emoji: updateData.emoji,
                  user: updateData.user
                });
              }
              
              return { ...post, reactions: updatedReactions };
            } else if (updateType === 'comment') {
              // Увеличиваем счетчик комментариев
              return { 
                ...post, 
                commentsCount: (post.commentsCount || 0) + 1 
              };
            } else if (updateType === 'rating_update') {
              // Обновляем рейтинг в посте
              return {
                ...post,
                rating: updateData.rating
              };
            }
          }
          return post;
        });
      });
    } else if (data.type === 'feed_reaction_local') {
      // Локальное обновление реакции (от текущего пользователя)
      const { postId, reaction } = data;
      
      setItems(prevPosts => {
        return prevPosts.map(post => {
          if (post.id === postId) {
            const existingReactionIndex = post.reactions?.findIndex(
              r => r.userId === user?.id
            );
            
            let updatedReactions = post.reactions ? [...post.reactions] : [];
            
            if (reaction) {
              // Добавляем или обновляем реакцию
              if (existingReactionIndex >= 0) {
                updatedReactions[existingReactionIndex] = reaction;
              } else {
                updatedReactions.push(reaction);
              }
            } else {
              // Удаляем реакцию
              if (existingReactionIndex >= 0) {
                updatedReactions.splice(existingReactionIndex, 1);
              }
            }
            
            return { ...post, reactions: updatedReactions };
          }
          return post;
        });
      });
    }
  }, [setItems, user]);

  // Подключаем WebSocket обработчик
  useEffect(() => {
    addMessageHandler(handleWebSocketMessage);
    
    return () => {
      removeMessageHandler(handleWebSocketMessage);
    };
  }, [handleWebSocketMessage]);

  // Обработчик обновления ленты (показать новые посты)
  const handleShowNewPosts = () => {
    setNewPostsCount(0);
    refresh();
  };

  // Обработчик изменения реакции - отправляем локальное событие
  const handleReactionChange = useCallback((postId, reaction) => {
    // Отправляем локальное событие для обновления UI
    handleWebSocketMessage({
      type: 'feed_reaction_local',
      postId,
      reaction
    });
  }, [handleWebSocketMessage]);

  // Обработчик удаления поста
  const handlePostDeleted = useCallback((postId) => {
    setItems(prevPosts => prevPosts.filter(post => post.id !== postId));
  }, [setItems]);

  // Обработчик редактирования поста
  const handlePostUpdated = useCallback((postId, updatedContent) => {
    setItems(prevPosts => {
      return prevPosts.map(post => 
        post.id === postId ? { ...post, content: updatedContent } : post
      );
    });
  }, [setItems]);

  return (
    <UserPageLayout user={user}>
      <div className={styles.feedPage}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            <Icon name="feed" size="medium" /> Лента друзей
          </h1>
        </div>

        {/* Кнопка показа новых постов */}
        {newPostsCount > 0 && (
          <div className={styles.newPostsNotification}>
            <button 
              className={styles.newPostsButton}
              onClick={handleShowNewPosts}
            >
              <Icon name="refresh" size="small" /> Показать {newPostsCount} {newPostsCount === 1 ? 'новый пост' : 'новых постов'}
            </button>
          </div>
        )}

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
            <a href="/search?tab=users" className={styles.findFriendsButton}>
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
                    onReactionChange={(reaction) => handleReactionChange(post.id, reaction)}
                    onPostDeleted={() => handlePostDeleted(post.id)}
                    onPostUpdated={(updatedContent) => handlePostUpdated(post.id, updatedContent)}
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
