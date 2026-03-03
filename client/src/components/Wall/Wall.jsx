import React, { useEffect, useState, useRef } from 'react';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchWall, createPost } from '../../store/slices/wallSlice';
import WallPost from './WallPost';
import Icon from '../Common/Icon';
import styles from './Wall.module.css';
import axios from 'axios';

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
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

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

  // Обработка выбора файлов
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    addImages(files);
  };

  // Добавление изображений
  const addImages = (files) => {
    // Фильтруем только изображения
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    // Ограничение: максимум 10 изображений
    const remainingSlots = 10 - selectedImages.length;
    const filesToAdd = imageFiles.slice(0, remainingSlots);

    if (filesToAdd.length === 0) {
      if (imageFiles.length === 0) {
        alert('Выберите файлы изображений');
      } else {
        alert('Достигнут лимит в 10 изображений');
      }
      return;
    }

    // Создаем превью для новых изображений
    const newPreviews = filesToAdd.map(file => URL.createObjectURL(file));
    
    setSelectedImages(prev => [...prev, ...filesToAdd]);
    setImagePreviews(prev => [...prev, ...newPreviews]);
  };

  // Удаление изображения из списка
  const removeImage = (index) => {
    // Освобождаем URL объекта
    URL.revokeObjectURL(imagePreviews[index]);
    
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Drag and drop обработчики
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    addImages(files);
  };

  // Обработка создания нового текстового поста
  const handleCreatePost = async (e) => {
    e.preventDefault();
    
    // Проверяем, что есть либо текст, либо изображения
    if (!newPostContent.trim() && selectedImages.length === 0) {
      alert('Добавьте текст или изображения');
      return;
    }

    setIsCreating(true);
    try {
      // Создаем пост
      // Если нет текста, передаем undefined (не будет включено в запрос)
      const postData = {
        postType: 'text',
        targetUserId: isOwnProfile ? undefined : userId
      };
      
      // Добавляем content только если он не пустой
      if (newPostContent.trim()) {
        postData.content = newPostContent.trim();
      }
      
      const result = await dispatch(createPost(postData)).unwrap();

      const postId = result.id;

      // Если есть изображения, загружаем их
      if (selectedImages.length > 0) {
        const formData = new FormData();
        selectedImages.forEach(file => {
          formData.append('images', file);
        });
        formData.append('postId', postId);

        const token = localStorage.getItem('authToken');
        await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:1313'}/api/wall/images`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          }
        });
      }
      
      // Очищаем форму
      setNewPostContent('');
      setSelectedImages([]);
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
      setImagePreviews([]);
      
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

            {/* Drag and drop зона */}
            <div 
              className={`${styles.dropZone} ${isDragging ? styles.dragging : ''}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {imagePreviews.length === 0 ? (
                <p>Перетащите изображения сюда или нажмите кнопку ниже</p>
              ) : (
                <div className={styles.imagePreviews}>
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className={styles.imagePreview}>
                      <img src={preview} alt={`Preview ${index + 1}`} />
                      <button
                        type="button"
                        className={styles.removeImageBtn}
                        onClick={() => removeImage(index)}
                        disabled={isCreating}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Кнопки управления */}
            <div className={styles.postActions}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className={styles.attachButton}
                onClick={() => fileInputRef.current?.click()}
                disabled={isCreating || selectedImages.length >= 10}
              >
                <Icon name="paperclip" size="small" />
              </button>
              <button 
                type="submit" 
                className={styles.submitButton}
                disabled={(!newPostContent.trim() && selectedImages.length === 0) || isCreating}
              >
                {isCreating ? 'Публикация...' : 'Опубликовать'}
              </button>
            </div>
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
