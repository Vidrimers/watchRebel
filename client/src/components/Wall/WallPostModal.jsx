import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import WallPost from './WallPost';
import Icon from '../Common/Icon';
import api from '../../services/api';
import styles from './WallPostModal.module.css';

/**
 * Модальное окно для отображения отдельного поста
 * Используется при переходе по уведомлениям
 */
const WallPostModal = ({ postId, isOpen, onClose }) => {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen && postId) {
      loadPost();
    }
  }, [isOpen, postId]);

  const loadPost = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(`/wall/post/${postId}`);
      setPost(response.data);
    } catch (err) {
      console.error('Ошибка загрузки поста:', err);
      setError(err.response?.data?.error || 'Не удалось загрузить пост');
    } finally {
      setLoading(false);
    }
  };

  const handleReactionChange = () => {
    // Перезагружаем пост после изменения реакций
    loadPost();
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className={styles.backdrop} 
      data-modal="wall-post"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // Закрываем только если клик по самому backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      onMouseUp={(e) => {
        e.stopPropagation();
      }}
    >
      <div className={styles.modal} ref={modalRef}>
        <button className={styles.closeButton} onClick={onClose} aria-label="Закрыть">
          ✕
        </button>

        <div className={styles.content}>
          {loading && (
            <div className={styles.loading}>Загрузка поста...</div>
          )}

          {error && (
            <div className={styles.error}>
              <p>{error}</p>
              <button onClick={onClose} className={styles.errorButton}>
                Закрыть
              </button>
            </div>
          )}

          {post && !loading && !error && (
            <WallPost 
              post={post} 
              isOwnProfile={false}
              onReactionChange={handleReactionChange}
              isModal={true}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default WallPostModal;
