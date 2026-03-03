import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import ImageComment from './ImageComment';
import styles from './ImageGalleryModal.module.css';

/**
 * Модальная галерея для просмотра изображений
 * Fullscreen с навигацией и панелью комментариев справа
 * 
 * @param {Array} images - Массив изображений [{id, url, order}]
 * @param {number} startIndex - Индекс изображения для начального отображения
 * @param {boolean} isOpen - Открыта ли галерея
 * @param {Function} onClose - Callback для закрытия галереи
 */
const ImageGalleryModal = ({ images, startIndex = 0, isOpen, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [imageMetadata, setImageMetadata] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null); // { commentId, authorName }
  const [loading, setLoading] = useState(false);
  const [deletedComments, setDeletedComments] = useState(new Set()); // Локально удаленные комментарии
  const currentUser = useSelector((state) => state.auth.user);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:1313';

  // Обновляем индекс при изменении startIndex
  useEffect(() => {
    setCurrentIndex(startIndex);
  }, [startIndex]);

  // Загружаем комментарии при смене изображения
  useEffect(() => {
    if (!isOpen || !images || images.length === 0) return;

    const currentImage = images[currentIndex];
    if (currentImage && currentImage.id) {
      loadComments(currentImage.id);
    }
  }, [currentIndex, isOpen, images]);

  // Загрузка комментариев
  const loadComments = async (imageId) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/images/${imageId}/comments`);
      setComments(response.data.comments || []);
    } catch (error) {
      console.error('Ошибка загрузки комментариев:', error);
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  // Создание комментария
  const handleCreateComment = async () => {
    if (!newComment.trim()) {
      alert('Комментарий не может быть пустым');
      return;
    }

    if (newComment.length > 500) {
      alert('Комментарий не может быть длиннее 500 символов');
      return;
    }

    const currentImage = images[currentIndex];
    if (!currentImage || !currentImage.id) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.post(
        `${API_URL}/api/images/${currentImage.id}/comments`,
        {
          content: newComment.trim(),
          parent_comment_id: replyTo?.commentId || null
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Перезагружаем комментарии
      await loadComments(currentImage.id);
      
      // Очищаем форму
      setNewComment('');
      setReplyTo(null);
    } catch (error) {
      console.error('Ошибка создания комментария:', error);
      alert('Не удалось создать комментарий');
    }
  };

  // Редактирование комментария
  const handleEditComment = async (commentId, newContent) => {
    try {
      const token = localStorage.getItem('authToken');
      await axios.put(
        `${API_URL}/api/images/comments/${commentId}`,
        { content: newContent },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Перезагружаем комментарии
      const currentImage = images[currentIndex];
      await loadComments(currentImage.id);
    } catch (error) {
      console.error('Ошибка редактирования комментария:', error);
      alert('Не удалось отредактировать комментарий');
    }
  };

  // Удаление комментария (локально, без подтверждения)
  const handleDeleteComment = async (commentId) => {
    // Добавляем в список локально удаленных
    setDeletedComments(prev => new Set([...prev, commentId]));
  };

  // Восстановление комментария
  const handleRestoreComment = (commentId) => {
    setDeletedComments(prev => {
      const newSet = new Set(prev);
      newSet.delete(commentId);
      return newSet;
    });
  };

  // Окончательное удаление всех локально удаленных комментариев при закрытии
  const handleClose = async () => {
    if (deletedComments.size > 0) {
      const token = localStorage.getItem('authToken');
      // Удаляем все локально помеченные комментарии на сервере
      for (const commentId of deletedComments) {
        try {
          await axios.delete(
            `${API_URL}/api/images/comments/${commentId}`,
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          );
        } catch (error) {
          console.error('Ошибка удаления комментария:', error);
        }
      }
    }
    
    // Очищаем список удаленных и закрываем
    setDeletedComments(new Set());
    onClose();
  };

  // Ответ на комментарий
  const handleReply = async (commentId, authorName, content) => {
    // Если передан content, значит это отправка ответа из компонента комментария
    if (content) {
      const currentImage = images[currentIndex];
      if (!currentImage || !currentImage.id) return;

      try {
        const token = localStorage.getItem('authToken');
        await axios.post(
          `${API_URL}/api/images/${currentImage.id}/comments`,
          {
            content: content,
            parent_comment_id: commentId
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        // Перезагружаем комментарии
        await loadComments(currentImage.id);
      } catch (error) {
        console.error('Ошибка создания ответа:', error);
        alert('Не удалось создать ответ');
      }
    } else {
      // Старый вариант - устанавливаем replyTo для формы вверху (на случай если понадобится)
      setReplyTo({ commentId, authorName });
      setNewComment(`@${authorName} `);
    }
  };

  // Отмена ответа
  const handleCancelReply = () => {
    setReplyTo(null);
    setNewComment('');
  };

  // Обработка Enter для отправки
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Предотвращаем перенос строки
      handleCreateComment();
    }
  };

  // Загружаем метаданные изображения
  useEffect(() => {
    if (!isOpen || !images || images.length === 0) return;

    const currentImage = images[currentIndex];
    const img = new Image();
    
    img.onload = () => {
      setImageMetadata({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    
    img.src = `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${currentImage.url}`;

    // Получаем размер файла
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${currentImage.url}`)
      .then(response => {
        const size = response.headers.get('content-length');
        if (size) {
          setImageMetadata(prev => ({
            ...prev,
            size: parseInt(size)
          }));
        }
      })
      .catch(err => console.error('Ошибка получения размера файла:', err));
  }, [currentIndex, isOpen, images]);

  // Обработка клавиш клавиатуры
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex]);

  // Обработка скролла мышкой для переключения изображений
  useEffect(() => {
    if (!isOpen) return;

    const handleWheel = (e) => {
      e.preventDefault();
      
      if (e.deltaY > 0) {
        // Скролл вниз - следующее изображение
        handleNext();
      } else if (e.deltaY < 0) {
        // Скролл вверх - предыдущее изображение
        handlePrevious();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [isOpen, currentIndex]);

  // Блокировка скролла body при открытой галерее
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !images || images.length === 0) {
    return null;
  }

  const currentImage = images[currentIndex];

  // Форматирование размера файла
  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
  };

  // Форматирование разрешения
  const formatResolution = () => {
    if (!imageMetadata?.width || !imageMetadata?.height) return '';
    return `${imageMetadata.width}×${imageMetadata.height}`;
  };

  // Переход к предыдущему изображению
  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  // Переход к следующему изображению
  const handleNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : prev));
  };

  // Обработка клика на backdrop
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Кнопка закрытия */}
        <button className={styles.closeButton} onClick={handleClose}>
          ×
        </button>

        {/* Основная область с изображением */}
        <div className={styles.imageArea} onClick={handleClose}>
          {/* Стрелки и изображение - останавливаем всплытие */}
          <div onClick={(e) => e.stopPropagation()}>
            {/* Стрелка влево */}
            {currentIndex > 0 && (
              <button className={styles.navButton} onClick={handlePrevious}>
                ‹
              </button>
            )}

            {/* Изображение */}
            <div className={styles.imageContainer}>
              <img
                src={`${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${currentImage.url}`}
                alt={`Изображение ${currentIndex + 1}`}
                className={styles.image}
              />
              {/* Индикатор текущего изображения */}
              <div className={styles.imageInfo}>
                <div className={styles.imageCounter}>
                  {currentIndex + 1} / {images.length}
                </div>
                {imageMetadata && (
                  <div className={styles.imageMetadata}>
                    {formatResolution() && <span>{formatResolution()}</span>}
                    {formatResolution() && imageMetadata.size && <span className={styles.separator}>•</span>}
                    {imageMetadata.size && <span>{formatFileSize(imageMetadata.size)}</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Стрелка вправо */}
            {currentIndex < images.length - 1 && (
              <button className={`${styles.navButton} ${styles.navButtonRight}`} onClick={handleNext}>
                ›
              </button>
            )}
          </div>
        </div>

        {/* Панель комментариев справа */}
        <div className={styles.commentsPanel}>
          <div className={styles.commentsPanelHeader}>
            <h3>Комментарии к фото</h3>
            <span className={styles.commentsCount}>
              {comments.length > 0 ? `${comments.length}` : ''}
            </span>
          </div>

          {/* Форма добавления комментария */}
          <div className={styles.commentForm}>
            {replyTo && (
              <div className={styles.replyIndicator}>
                <span>Ответ для {replyTo.authorName}</span>
                <button onClick={handleCancelReply} className={styles.cancelReplyButton}>
                  ×
                </button>
              </div>
            )}
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={replyTo ? `Ответ для @${replyTo.authorName}...` : 'Напишите комментарий...'}
              maxLength={500}
              className={styles.commentTextarea}
            />
            <div className={styles.commentFormActions}>
              <span className={styles.charCounter}>
                {newComment.length}/500
              </span>
              <button onClick={handleCreateComment} className={styles.sendButton}>
                Отправить
              </button>
            </div>
            <div className={styles.commentHint}>
              Enter для отправки, Shift+Enter для новой строки
            </div>
          </div>

          {/* Список комментариев */}
          <div className={styles.commentsList}>
            {loading ? (
              <div className={styles.commentsLoading}>Загрузка...</div>
            ) : comments.length === 0 ? (
              <div className={styles.commentsEmpty}>
                Пока нет комментариев. Будьте первым!
              </div>
            ) : (
              comments.map((comment) => (
                <ImageComment
                  key={comment.id}
                  comment={comment}
                  onReply={handleReply}
                  onEdit={handleEditComment}
                  onDelete={handleDeleteComment}
                  onRestore={handleRestoreComment}
                  isDeleted={deletedComments.has(comment.id)}
                  depth={0}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageGalleryModal;
