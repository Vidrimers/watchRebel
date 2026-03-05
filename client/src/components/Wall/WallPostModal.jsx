import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import WallPost from './WallPost';
import Icon from '../Common/Icon';
import api from '../../services/api';
import { addMessageHandler, removeMessageHandler } from '../../services/websocket';
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

  // WebSocket обработчик для обновления поста в реальном времени
  const handleWebSocketMessage = useCallback((data) => {
    // Обновление поста (реакция или комментарий)
    if (data.type === 'feed_post_update' && post) {
      const { postId, updateType, data: updateData } = data;
      
      // Проверяем, что это наш пост
      if (postId === post.id) {
        if (updateType === 'comment') {
          // Увеличиваем счётчик комментариев
          setPost(prevPost => ({
            ...prevPost,
            commentsCount: (prevPost.commentsCount || 0) + 1
          }));
        } else if (updateType === 'reaction') {
          // Обновляем реакции
          setPost(prevPost => {
            const existingReactionIndex = prevPost.reactions?.findIndex(
              r => r.userId === updateData.userId
            );
            
            const updatedReactions = prevPost.reactions ? [...prevPost.reactions] : [];
            
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
            
            return { ...prevPost, reactions: updatedReactions };
          });
        }
      }
    }
  }, [post]);

  // Подключаем WebSocket обработчик
  useEffect(() => {
    if (isOpen && post) {
      addMessageHandler(handleWebSocketMessage);
      
      return () => {
        removeMessageHandler(handleWebSocketMessage);
      };
    }
  }, [isOpen, post, handleWebSocketMessage]);

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
