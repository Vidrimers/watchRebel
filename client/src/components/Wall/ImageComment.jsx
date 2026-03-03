import React, { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import styles from './ImageComment.module.css';

/**
 * Компонент для отображения комментария к изображению с поддержкой вложенности
 * 
 * @param {Object} comment - Объект комментария
 * @param {Function} onReply - Callback для ответа на комментарий
 * @param {Function} onEdit - Callback для редактирования комментария
 * @param {Function} onDelete - Callback для удаления комментария
 * @param {Function} onRestore - Callback для восстановления комментария
 * @param {boolean} isDeleted - Флаг локального удаления
 * @param {number} depth - Уровень вложенности (для отступов)
 */
const ImageComment = ({ comment, onReply, onEdit, onDelete, onRestore, isDeleted = false, depth = 0 }) => {
  const currentUser = useSelector((state) => state.auth.user);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const editTextareaRef = useRef(null);

  const isOwnComment = currentUser && currentUser.id === comment.author.id;
  const isServerDeleted = comment.content === '[Комментарий удален]';

  // Перемещаем курсор в конец при открытии редактирования
  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      const textarea = editTextareaRef.current;
      const length = textarea.value.length;
      textarea.setSelectionRange(length, length);
      textarea.focus();
    }
  }, [isEditing]);

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
    setReplyContent(''); // Пустое поле
  };

  // Отправка ответа
  const handleSendReply = () => {
    if (replyContent.trim().length === 0) {
      alert('Комментарий не может быть пустым');
      return;
    }

    if (replyContent.length > 500) {
      alert('Комментарий не может быть длиннее 500 символов');
      return;
    }

    onReply(comment.id, comment.author.displayName, replyContent.trim());
    setIsReplying(false);
    setReplyContent('');
  };

  // Отмена ответа
  const handleCancelReply = () => {
    setIsReplying(false);
    setReplyContent('');
  };

  // Обработка Enter для отправки ответа
  const handleReplyKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  return (
    <div className={`${styles.commentWrapper} ${depth > 0 ? styles.reply : ''}`}>
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
                ref={editTextareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                maxLength={500}
                className={styles.editTextarea}
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
            <p className={`${styles.commentText} ${(isDeleted || isServerDeleted) ? styles.deletedText : ''}`}>
              {isDeleted ? '[Комментарий удален]' : comment.content}
            </p>
          )}

          {/* Действия с комментарием */}
          {!isServerDeleted && !isEditing && (
            <div className={styles.commentActions}>
              {isDeleted ? (
                // Если локально удален - показываем кнопку восстановления
                <button onClick={() => onRestore(comment.id)} className={styles.actionButton}>
                  Восстановить
                </button>
              ) : (
                <>
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
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Форма ответа */}
      {isReplying && (
        <div className={styles.replyForm}>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            onKeyDown={handleReplyKeyDown}
            placeholder={`Ответить ${comment.author.displayName}...`}
            maxLength={500}
            className={styles.replyTextarea}
            autoFocus
          />
          <div className={styles.replyActions}>
            <span className={styles.charCounter}>
              {replyContent.length}/500
            </span>
            <button onClick={handleSendReply} className={styles.sendButton}>
              Отправить
            </button>
            <button onClick={handleCancelReply} className={styles.cancelButton}>
              Отмена
            </button>
          </div>
        </div>
      )}

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
              onRestore={onRestore}
              isDeleted={isDeleted}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageComment;
