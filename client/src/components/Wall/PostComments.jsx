import React, { useState, useEffect, useRef } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import PostComment from './PostComment';
import ReactionPicker from './ReactionPicker';
import api from '../../services/api';
import styles from './PostComments.module.css';

/**
 * Компонент для отображения комментариев к посту
 * Поддерживает пагинацию и бесконечную вложенность
 * 
 * @param {string} postId - ID поста
 * @param {boolean} isOpen - Открыта ли форма комментирования
 * @param {Function} onClose - Callback для закрытия формы
 * @param {Function} onCommentAdded - Callback при добавлении комментария
 */
const PostComments = ({ postId, isOpen, onClose, onCommentAdded }) => {
  const currentUser = useAppSelector((state) => state.auth.user);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const limit = 5;

  // Загрузка комментариев
  const loadComments = async (reset = false) => {
    try {
      setLoading(true);
      const currentOffset = reset ? 0 : offset;
      
      const response = await api.get(`/wall/${postId}/comments`, {
        params: { limit, offset: currentOffset }
      });

      if (reset) {
        setComments(response.data.comments);
        setOffset(limit);
      } else {
        setComments([...comments, ...response.data.comments]);
        setOffset(currentOffset + limit);
      }

      setTotal(response.data.total);
      setHasMore(response.data.hasMore);
    } catch (error) {
      console.error('Ошибка загрузки комментариев:', error);
    } finally {
      setLoading(false);
    }
  };

  // Загрузка комментариев при монтировании
  useEffect(() => {
    if (isOpen) {
      loadComments(true);
    }
  }, [postId, isOpen]);

  // Обработка отправки комментария
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!commentText.trim() || submitting) return;

    try {
      setSubmitting(true);
      
      // TODO: Добавить поддержку загрузки файла
      await api.post(`/wall/${postId}/comments`, {
        content: commentText.trim()
      });

      // Очищаем поле ввода и файл
      setCommentText('');
      setSelectedFile(null);
      
      // Перезагружаем комментарии
      await loadComments(true);
      
      // Уведомляем родителя о добавлении комментария
      if (onCommentAdded) {
        onCommentAdded();
      }
    } catch (error) {
      console.error('Ошибка отправки комментария:', error);
      alert(error.response?.data?.error || 'Не удалось отправить комментарий');
    } finally {
      setSubmitting(false);
    }
  };

  // Обработка нажатия Enter (без Shift)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Добавление эмодзи через ReactionPicker
  const handleEmojiSelect = (emoji) => {
    setCommentText(commentText + emoji);
    setShowEmojiPicker(false);
  };

  // Обработка выбора файла
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Проверка размера (макс 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('Файл слишком большой. Максимальный размер: 10MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  // Удаление выбранного файла
  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Обработка обновления комментария
  const handleCommentUpdate = () => {
    loadComments(true);
  };

  // Обработка удаления комментария
  const handleCommentDelete = () => {
    loadComments(true);
  };

  const charCount = commentText.length;
  const maxChars = 1000;

  // Не показываем компонент если форма закрыта и нет комментариев
  if (!isOpen && total === 0) {
    return null;
  }

  return (
    <div className={styles.postComments}>
      {/* Форма добавления комментария */}
      {isOpen && (
        <form className={styles.commentForm} onSubmit={handleSubmit}>
          <div className={styles.textareaWrapper}>
            <textarea
              className={styles.commentInput}
              placeholder="Напишите комментарий..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={maxChars}
              rows={3}
              disabled={submitting}
              autoFocus
            />
            
            {/* Кнопки внутри textarea */}
            <div className={styles.textareaButtons}>
              {/* Кнопка загрузки файла */}
              <button
                type="button"
                className={styles.fileButton}
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                title="Прикрепить файл"
              >
                <svg 
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,.pdf,.doc,.docx"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              
              {/* Кнопка эмодзи */}
              <button
                type="button"
                className={styles.emojiButton}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                disabled={submitting}
                title="Добавить эмодзи"
              >
                <svg 
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <circle cx="8" cy="10" r="1.5" fill="currentColor"/>
                  <circle cx="16" cy="10" r="1.5" fill="currentColor"/>
                  <path d="M8 14.5C8.5 15.5 10 17 12 17C14 17 15.5 15.5 16 14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            
            {/* Панель эмодзи */}
            {showEmojiPicker && (
              <div className={styles.emojiPickerWrapper}>
                <ReactionPicker
                  onSelect={handleEmojiSelect}
                  onClose={() => setShowEmojiPicker(false)}
                />
              </div>
            )}
          </div>
          
          {/* Выбранный файл */}
          {selectedFile && (
            <div className={styles.selectedFile}>
              <span className={styles.fileName}>{selectedFile.name}</span>
              <button
                type="button"
                className={styles.removeFileButton}
                onClick={handleRemoveFile}
              >
                ×
              </button>
            </div>
          )}
          
          <div className={styles.commentFormFooter}>
            <span className={styles.charCount}>
              {charCount} / {maxChars}
            </span>
            <div className={styles.formButtons}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => {
                  onClose();
                  setCommentText('');
                  setShowEmojiPicker(false);
                  setSelectedFile(null);
                }}
                disabled={submitting}
              >
                Отмена
              </button>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={!commentText.trim() || submitting}
              >
                {submitting ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </div>
          <div className={styles.hint}>
            Нажмите Enter для отправки, Shift+Enter для новой строки
          </div>
        </form>
      )}

      {/* Счетчик комментариев */}
      {total > 0 && (
        <div className={styles.commentsHeader}>
          <span className={styles.commentsCount}>
            💬 {total} {total === 1 ? 'комментарий' : total < 5 ? 'комментария' : 'комментариев'}
          </span>
        </div>
      )}

      {/* Список комментариев */}
      {total > 0 && (
        <div className={styles.commentsList}>
          {comments.map((comment) => (
            <PostComment
              key={comment.id}
              comment={comment}
              postId={postId}
              onUpdate={handleCommentUpdate}
              onDelete={handleCommentDelete}
            />
          ))}
        </div>
      )}

      {/* Кнопка "Загрузить еще" */}
      {hasMore && (
        <button
          className={styles.loadMoreButton}
          onClick={() => loadComments(false)}
          disabled={loading}
        >
          {loading ? 'Загрузка...' : 'Загрузить еще комментарии'}
        </button>
      )}
    </div>
  );
};

export default PostComments;
