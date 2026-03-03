import React, { useState, useEffect } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import useConfirm from '../../hooks/useConfirm';
import ReactionPicker from './ReactionPicker';
import api from '../../services/api';
import styles from './PostComment.module.css';

/**
 * Компонент отдельного комментария с поддержкой вложенности
 * Максимальная глубина вложенности - 2 уровня
 * 
 * @param {Object} comment - Данные комментария
 * @param {string} postId - ID поста
 * @param {number} depth - Уровень вложенности (для отступов и ограничения)
 * @param {Function} onUpdate - Callback при обновлении комментария
 * @param {Function} onDelete - Callback при удалении комментария
 */
const PostComment = ({ comment, postId, depth = 0, onUpdate, onDelete }) => {
  const MAX_DEPTH = 2; // Максимальная глубина вложенности
  const currentUser = useAppSelector((state) => state.auth.user);
  const { confirmDialog, showConfirm } = useConfirm();
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(comment.content);
  const [isSaving, setIsSaving] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replies, setReplies] = useState([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [repliesOffset, setRepliesOffset] = useState(0);
  const [hasMoreReplies, setHasMoreReplies] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const repliesLimit = 5;

  const isOwn = currentUser && comment.userId === currentUser.id;
  const isDeleted = comment.content === '[Комментарий удален]';
  const canNestDeeper = depth < MAX_DEPTH; // Можно ли вкладывать глубже

  // Загрузка ответов на комментарий
  const loadReplies = async (reset = false) => {
    try {
      setLoadingReplies(true);
      const currentOffset = reset ? 0 : repliesOffset;
      
      const response = await api.get(`/wall/comments/${comment.id}/replies`, {
        params: { limit: repliesLimit, offset: currentOffset }
      });

      if (reset) {
        setReplies(response.data.replies);
        setRepliesOffset(repliesLimit);
      } else {
        setReplies([...replies, ...response.data.replies]);
        setRepliesOffset(currentOffset + repliesLimit);
      }

      setHasMoreReplies(response.data.hasMore);
      setShowReplies(true);
    } catch (error) {
      console.error('Ошибка загрузки ответов:', error);
    } finally {
      setLoadingReplies(false);
    }
  };

  // Загрузка ответов при монтировании если есть
  useEffect(() => {
    if (comment.repliesCount > 0 && !showReplies) {
      // Не загружаем автоматически, только по клику
    }
  }, [comment.repliesCount]);

  // Обработка редактирования
  const handleEdit = () => {
    setIsEditing(true);
    setEditedContent(comment.content);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContent(comment.content);
  };

  const handleSaveEdit = async () => {
    if (!editedContent.trim() || isSaving) return;

    try {
      setIsSaving(true);
      
      await api.put(`/wall/comments/${comment.id}`, {
        content: editedContent.trim()
      });

      setIsEditing(false);
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Ошибка редактирования комментария:', error);
      alert(error.response?.data?.error || 'Не удалось отредактировать комментарий');
    } finally {
      setIsSaving(false);
    }
  };

  // Обработка удаления
  const handleDelete = async () => {
    const confirmed = await showConfirm(
      'Вы уверены, что хотите удалить этот комментарий?',
      'Удалить комментарий'
    );

    if (!confirmed) return;

    try {
      await api.delete(`/wall/comments/${comment.id}`);
      
      if (onDelete) {
        onDelete();
      }
    } catch (error) {
      console.error('Ошибка удаления комментария:', error);
      alert(error.response?.data?.error || 'Не удалось удалить комментарий');
    }
  };

  // Обработка ответа
  const handleReply = () => {
    setShowReplyForm(true);
    setReplyText(`@${comment.author.displayName} `);
  };

  const handleCancelReply = () => {
    setShowReplyForm(false);
    setReplyText('');
  };

  const handleSubmitReply = async (e) => {
    e.preventDefault();
    
    if (!replyText.trim() || submittingReply) return;

    try {
      setSubmittingReply(true);
      
      await api.post(`/wall/${postId}/comments`, {
        content: replyText.trim(),
        parent_comment_id: comment.id
      });

      setReplyText('');
      setShowReplyForm(false);
      
      // Перезагружаем ответы
      await loadReplies(true);
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Ошибка отправки ответа:', error);
      alert(error.response?.data?.error || 'Не удалось отправить ответ');
    } finally {
      setSubmittingReply(false);
    }
  };

  // Обработка нажатия Enter (без Shift)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isEditing) {
        handleSaveEdit();
      } else if (showReplyForm) {
        handleSubmitReply(e);
      }
    }
  };

  // Добавление эмодзи через ReactionPicker
  const handleEmojiSelect = (emoji) => {
    setReplyText(replyText + emoji);
    setShowEmojiPicker(false);
  };

  // Форматирование даты
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    if (days < 7) return `${days} д назад`;
    
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const paddingLeft = depth > 0 ? Math.min(depth, MAX_DEPTH) * 40 : 0; // Ограничиваем отступ максимальной глубиной

  return (
    <div className={styles.commentWrapper} style={{ paddingLeft: `${paddingLeft}px` }}>
      {confirmDialog}
      
      <div className={styles.comment}>
        {/* Аватар */}
        <div className={styles.avatar}>
          {comment.author.avatarUrl ? (
            <img 
              src={comment.author.avatarUrl.startsWith('http') 
                ? comment.author.avatarUrl 
                : `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${comment.author.avatarUrl}`
              }
              alt={comment.author.displayName}
              className={styles.avatarImage}
            />
          ) : (
            <div className={styles.avatarPlaceholder}>
              {comment.author.displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Контент комментария */}
        <div className={styles.commentContent}>
          {/* Заголовок */}
          <div className={styles.commentHeader}>
            <span className={styles.authorName}>
              {comment.author.displayName}
            </span>
            <span className={styles.commentDate}>
              {formatDate(comment.createdAt)}
              {comment.editedAt && <span className={styles.edited}> (изменено)</span>}
            </span>
          </div>

          {/* Текст комментария */}
          {isEditing ? (
            <div className={styles.editForm}>
              <textarea
                className={styles.editInput}
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={1000}
                rows={3}
                disabled={isSaving}
                autoFocus
              />
              <div className={styles.editActions}>
                <button
                  className={styles.saveButton}
                  onClick={handleSaveEdit}
                  disabled={!editedContent.trim() || isSaving}
                >
                  {isSaving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  className={styles.cancelButton}
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <p className={`${styles.commentText} ${isDeleted ? styles.deletedText : ''}`}>
              {comment.content}
            </p>
          )}

          {/* Действия */}
          {!isEditing && !isDeleted && (
            <div className={styles.commentActions}>
              <button className={styles.actionButton} onClick={handleReply}>
                Ответить
              </button>
              
              {isOwn && (
                <>
                  <button className={styles.actionButton} onClick={handleEdit}>
                    Редактировать
                  </button>
                  <button className={styles.actionButton} onClick={handleDelete}>
                    Удалить
                  </button>
                </>
              )}
            </div>
          )}

          {/* Форма ответа */}
          {showReplyForm && (
            <form className={styles.replyForm} onSubmit={handleSubmitReply}>
              <div className={styles.textareaWrapper}>
                <textarea
                  className={styles.replyInput}
                  placeholder={`Ответ для @${comment.author.displayName}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={1000}
                  rows={2}
                  disabled={submittingReply}
                  autoFocus
                />
                <button
                  type="button"
                  className={styles.emojiButton}
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  disabled={submittingReply}
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
              
              <div className={styles.replyActions}>
                <button
                  type="submit"
                  className={styles.submitReplyButton}
                  disabled={!replyText.trim() || submittingReply}
                >
                  {submittingReply ? 'Отправка...' : 'Отправить'}
                </button>
                <button
                  type="button"
                  className={styles.cancelReplyButton}
                  onClick={handleCancelReply}
                  disabled={submittingReply}
                >
                  Отмена
                </button>
              </div>
            </form>
          )}

          {/* Кнопка показать ответы */}
          {comment.repliesCount > 0 && !showReplies && (
            <button
              className={styles.showRepliesButton}
              onClick={() => loadReplies(true)}
              disabled={loadingReplies}
            >
              {loadingReplies ? 'Загрузка...' : `Показать ответы (${comment.repliesCount})`}
            </button>
          )}

          {/* Список ответов */}
          {showReplies && replies.length > 0 && (
            <div className={styles.repliesList}>
              {replies.map((reply) => (
                <PostComment
                  key={reply.id}
                  comment={reply}
                  postId={postId}
                  depth={canNestDeeper ? depth + 1 : depth} // Ограничиваем глубину
                  onUpdate={() => loadReplies(true)}
                  onDelete={() => loadReplies(true)}
                />
              ))}
              
              {/* Кнопка "Загрузить еще ответы" */}
              {hasMoreReplies && (
                <button
                  className={styles.loadMoreRepliesButton}
                  onClick={() => loadReplies(false)}
                  disabled={loadingReplies}
                >
                  {loadingReplies ? 'Загрузка...' : 'Показать еще ответы'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostComment;
