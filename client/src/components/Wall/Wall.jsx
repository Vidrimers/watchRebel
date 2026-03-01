import React, { useEffect, useState } from 'react';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchWall, createPost } from '../../store/slices/wallSlice';
import WallPost from './WallPost';
import styles from './Wall.module.css';

/**
 * Компонент стены активности пользователя
 * Отображает ленту постов в хронологическом порядке (новые сверху)
 */
const Wall = ({ userId, isOwnProfile = false, wallPrivacy = 'all', isFriend = false }) => {
  const dispatch = useAppDispatch();
  const { posts, loading, error } = useAppSelector((state) => state.wall);
  const { user: currentUser } = useAppSelector((state) => state.auth);
  const [newPostContent, setNewPostContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Загрузка постов при монтировании компонента
  useEffect(() => {
    if (userId) {
      dispatch(fetchWall(userId));
    }
  }, [dispatch, userId]);

  // Определяем, можно ли писать на этой стене
  const canPostOnWall = () => {
    if (isOwnProfile) return true; // Всегда можно писать на своей стене
    if (wallPrivacy === 'all') return true; // Все могут писать
    if (wallPrivacy === 'friends' && isFriend) return true; // Только друзья
    return false; // Никто не может писать
  };

  // Обработка создания нового текстового поста
  const handleCreatePost = async (e) => {
    e.preventDefault();
    
    if (!newPostContent.trim()) {
      return;
    }

    setIsCreating(true);
    try {
      await dispatch(createPost({
        postType: 'text',
        content: newPostContent.trim(),
        targetUserId: isOwnProfile ? undefined : userId // Добавляем targetUserId для чужой стены
      })).unwrap();
      
      setNewPostContent('');
      
      // Перезагружаем стену после создания поста
      dispatch(fetchWall(userId));
    } catch (err) {
      console.error('Ошибка создания поста:', err);
      alert(err.message || 'Ошибка создания поста');
    } finally {
      setIsCreating(false);
    }
  };

  // Обработка нажатия Enter для отправки поста
  const handleKeyDown = (e) => {
    // Если нажат Enter без Shift - отправляем пост
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Предотвращаем перенос строки
      handleCreatePost(e);
    }
    // Если нажат Enter с Shift - разрешаем перенос строки (стандартное поведение)
  };

  if (loading && posts.length === 0) {
    return (
      <div className={styles.wall}>
        <div className={styles.loading}>Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.wall}>
        <div className={styles.error}>
          Ошибка загрузки стены: {error.message || 'Неизвестная ошибка'}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wall}>
      {/* Форма создания нового поста */}
      {/* Показываем для своего профиля или если можно писать на чужой стене */}
      {(isOwnProfile || canPostOnWall()) && (
        <div className={styles.createPostContainer}>
          <form onSubmit={handleCreatePost} className={styles.createPostForm}>
            <textarea
              className={styles.postInput}
              placeholder={isOwnProfile ? "Что у вас нового?" : "Написать на стене..."}
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              disabled={isCreating}
            />
            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={!newPostContent.trim() || isCreating}
            >
              {isCreating ? 'Публикация...' : 'Опубликовать'}
            </button>
          </form>
        </div>
      )}

      {/* Сообщение если нельзя писать на стене */}
      {!isOwnProfile && !canPostOnWall() && (
        <div className={styles.wallPrivacyMessage}>
          {wallPrivacy === 'none' && (
            <p>Пользователь запретил публикации на своей стене</p>
          )}
          {wallPrivacy === 'friends' && !isFriend && (
            <p>Только друзья могут писать на стене этого пользователя</p>
          )}
        </div>
      )}

      {/* Список постов */}
      <div className={styles.postsList}>
        {posts.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Пока нет записей на стене</p>
            {isOwnProfile && (
              <p className={styles.emptyHint}>
                Добавьте фильм в список или напишите что-нибудь!
              </p>
            )}
          </div>
        ) : (
          posts.map((post) => (
            <WallPost 
              key={post.id} 
              post={post}
              isOwnProfile={isOwnProfile}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Wall;
