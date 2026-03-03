import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import styles from './ImageComment.module.css';

/**
 * Компонент для отображения комментария к изображению с поддержкой вложенности
 * 
 * @param {Object} comment - Объект комментария
 * @param {Function} onReply - Callback для ответа на комментарий
 * @param {Function} onEdit - Callback для редактирования комментария
 * @param {Function} onDelete - Callback для удаления комментария
 * @param {number} depth - Уровень вложенности (для отступов)
 */
const ImageComment = ({ comment, onReply, onEdit, onDelete, depth = 0 }) => {
  const currentUser = useSelector((state) => state.auth.user);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isReplying, setIsReplying] = useState(false);

  const isOwnComment = currentUser && currentUser.id === comment.author.id;
  const isDeleted = comment.content === '[Комментарий удален]';

  // Форматирование даты
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} д назад`;

    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  // Обработка сохранения редактирования
  const handleSaveEdit = () => {
    if (editContent.trim().length === 0) {
      alert('Комментарий не может быть пустым');
      return;
    }

    if (editContent.length > 500) {
      alert('Комментарий не может быть длиннее 500 символов');
      return;
    }

    onEdit(comment.id, editContent.trim());
    setIsEditing(false);
  };

  // Обработка отмены редактирования
  const handleCancelEdit = () => {
    setEditContent(comment.content);
    setIsEditing(false);
  };

  // Обработка ответа
  const handleReplyClick = () => {
    setIsReplying(true);
    onReply(comment.id, comment.author.displayName);
  };

  return (
    <div className={styles.commentWrapper} style={{ paddingLeft: `${depth * 20}px` }}>
      <div className={styles.comment}>
        {/* Аватар */}
        <div className={styles.avatar}>
          {comment.author.avatarUrl ? (
            <img
              src={`${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${comment.author.avatarUrl}`}
              alt={comment.author.displayName}
            />
          ) : (
            <div className={styles.avatarPlaceholder}>
              {comment.author.displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Контент комментария */}
        <div className={styles.commentContent}>
          {/* Имя автора и дата */}
          <div className={styles.commentHeader}>
            <span className={styles.authorName}>{comment.author.displayName}</span>
            <span className={styles.commentDate}>
              {formatDate(comment.createdAt)}
              {comment.editedAt && <span className={styles.edited}> (изменено)</span>}
            </span>
          </div>

          {/* Текст комментария или форма редактирования */}
          {isEditing ? (
            <div className={styles.editForm}>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                maxLength={500}
                className={styles.editTextarea}
                autoFocus
              />
              <div className={styles.editActions}>
                <span className={styles.charCounter}>
                  {editContent.length}/500
                </span>
                <button onClick={handleSaveEdit} className={styles.saveButton}>
                  Сохранить
                </button>
                <button onClick={handleCancelEdit} className={styles.cancelButton}>
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <p className={`${styles.commentText} ${isDeleted ? styles.deletedText : ''}`}>
              {comment.content}
            </p>
          )}

          {/* Действия с комментарием */}
          {!isDeleted && !isEditing && (
            <div className={styles.commentActions}>
              <button onClick={handleReplyClick} className={styles.actionButton}>
                Ответить
              </button>
              {isOwnComment && (
                <>
                  <button onClick={() => setIsEditing(true)} className={styles.actionButton}>
                    Редактировать
                  </button>
                  <button onClick={() => onDelete(comment.id)} className={styles.actionButton}>
                    Удалить
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Рекурсивное отображение ответов */}
      {comment.replies && comment.replies.length > 0 && (
        <div className={styles.replies}>
          {comment.replies.map((reply) => (
            <ImageComment
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageComment;
