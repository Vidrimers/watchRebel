import React, { useState, useEffect, useRef } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import useConfirm from '../../hooks/useConfirm';
import ReactionPicker from './ReactionPicker';
import ReactionTooltip from './ReactionTooltip';
import ImageModal from './ImageModal';
import LinkifiedText from './LinkifiedText';
import api from '../../services/api';
import styles from './PostComment.module.css';

/**
 * Компонент отдельного комментария с поддержкой вложенности
 * Максимальная глубина вложенности - 2 уровня
 * 
 * @param {Object} comment - Данные комментария
 * @param {string} postId - ID поста
 * @param {number} depth - Уровень вложенности (для отступов и ограничения)
 * @param {string} parentAuthorName - Имя автора родительского комментария
 * @param {boolean} isDeleted - Флаг локального удаления
 * @param {Set} deletedComments - Set с ID удаленных комментариев
 * @param {Function} onReply - Callback для ответа на комментарий
 * @param {Function} onEdit - Callback для редактирования комментария
 * @param {Function} onDelete - Callback для удаления комментария
 * @param {Function} onRestore - Callback для восстановления комментария
 */
const PostComment = ({ comment, postId, depth = 0, parentAuthorName = null, isDeleted = false, deletedComments, onReply, onEdit, onDelete, onRestore }) => {
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
  const [showImageModal, setShowImageModal] = useState(false);
  const [replyFile, setReplyFile] = useState(null);
  const [isDraggingReply, setIsDraggingReply] = useState(false);
  const replyFileInputRef = useRef(null);
  const editTextareaRef = useRef(null);
  const repliesLimit = 5;

  // Функция склонения для слова "ответ"
  const getRepliesText = (count) => {
    if (count === 1) return '1 ответ';
    if (count >= 2 && count <= 4) return `${count} ответа`;
    return `${count} ответов`;
  };

  // Состояние для лайков
  const [isLiked, setIsLiked] = useState(comment.isLikedByCurrentUser || false);
  const [likesCount, setLikesCount] = useState(comment.likesCount || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [showLikesTooltip, setShowLikesTooltip] = useState(false);
  const [likesTooltipPosition, setLikesTooltipPosition] = useState({ x: 0, y: 0 });
  const [likedUsers, setLikedUsers] = useState([]);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const likeButtonRef = useRef(null);
  const tooltipTimeoutRef = useRef(null);
  const hideTooltipTimeoutRef = useRef(null);

  const isOwn = currentUser && comment.userId === currentUser.id;
  const isServerDeleted = comment.content === '[Комментарий удален]';

  // Обновляем состояние лайков при изменении пропса comment
  useEffect(() => {
    setIsLiked(comment.isLikedByCurrentUser || false);
    setLikesCount(comment.likesCount || 0);
  }, [comment.isLikedByCurrentUser, comment.likesCount]);

  // Перемещаем курсор в конец при открытии редактирования
  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      const textarea = editTextareaRef.current;
      const length = textarea.value.length;
      textarea.setSelectionRange(length, length);
      textarea.focus();
    }
  }, [isEditing]);

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
      
      // Вызываем callback для редактирования
      if (onEdit) {
        await onEdit(comment.id, editedContent.trim());
      }

      setIsEditing(false);
    } catch (error) {
      console.error('Ошибка редактирования комментария:', error);
      alert(error.response?.data?.error || 'Не удалось отредактировать комментарий');
    } finally {
      setIsSaving(false);
    }
  };

  // Обработка ответа
  const handleReply = () => {
    setShowReplyForm(true);
    setReplyText(''); // Пустое поле
  };

  const handleCancelReply = () => {
    setShowReplyForm(false);
    setReplyText('');
  };

  const handleSubmitReply = async (e) => {
    e.preventDefault();
    
    // Проверяем что есть либо текст, либо файл
    if (!replyText.trim() && !replyFile) return;
    if (submittingReply) return;

    try {
      setSubmittingReply(true);
      
      // Создаем FormData для отправки файла
      const formData = new FormData();
      if (replyText.trim()) {
        formData.append('content', replyText.trim());
      }
      if (replyFile) {
        formData.append('image', replyFile);
      }
      formData.append('parent_comment_id', comment.id);

      await api.post(`/wall/${postId}/comments`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setReplyText('');
      setReplyFile(null);
      if (replyFileInputRef.current) {
        replyFileInputRef.current.value = '';
      }
      setShowReplyForm(false);
      
      // Перезагружаем ответы
      await loadReplies(true);
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

  // Обработка выбора файла для ответа
  const handleReplyFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Проверка размера (макс 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('Файл слишком большой. Максимальный размер: 10MB');
        return;
      }
      setReplyFile(file);
    }
  };

  // Удаление выбранного файла ответа
  const handleRemoveReplyFile = () => {
    setReplyFile(null);
    if (replyFileInputRef.current) {
      replyFileInputRef.current.value = '';
    }
  };

  // Drag & Drop handlers для ответа
  const handleReplyDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingReply(true);
  };

  const handleReplyDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingReply(false);
  };

  const handleReplyDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleReplyDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingReply(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      // Проверка типа файла
      if (!file.type.startsWith('image/')) {
        alert('Можно загружать только изображения');
        return;
      }
      
      // Проверка размера
      if (file.size > 10 * 1024 * 1024) {
        alert('Файл слишком большой. Максимальный размер: 10MB');
        return;
      }
      
      setReplyFile(file);
    }
  };

  // Добавление эмодзи через ReactionPicker
  const handleEmojiSelect = (emoji) => {
    setReplyText(replyText + emoji);
    setShowEmojiPicker(false);
  };

  // Обработка лайка комментария
  const handleLike = async () => {
    if (isLiking || !currentUser) return;

    try {
      setIsLiking(true);
      
      // Оптимистичное обновление UI
      const newIsLiked = !isLiked;
      const newLikesCount = newIsLiked ? likesCount + 1 : likesCount - 1;
      
      setIsLiked(newIsLiked);
      setLikesCount(newLikesCount);

      // Отправляем запрос на сервер
      const response = await api.post(`/wall/comments/${comment.id}/like`);
      
      // Обновляем с реальными данными с сервера
      setIsLiked(response.data.liked);
      setLikesCount(response.data.likesCount);
      
      // Сбрасываем список лайкнувших, чтобы перезагрузить при следующем наведении
      setLikedUsers([]);
    } catch (error) {
      console.error('Ошибка лайка комментария:', error);
      // Откатываем изменения при ошибке
      setIsLiked(!isLiked);
      setLikesCount(isLiked ? likesCount + 1 : likesCount - 1);
    } finally {
      setIsLiking(false);
    }
  };

  // Загрузка списка лайкнувших
  const loadLikedUsers = async () => {
    if (loadingLikes || likedUsers.length > 0 || likesCount === 0) return;

    try {
      setLoadingLikes(true);
      const response = await api.get(`/wall/comments/${comment.id}/likes`);
      setLikedUsers(response.data.users);
    } catch (error) {
      console.error('Ошибка загрузки списка лайков:', error);
    } finally {
      setLoadingLikes(false);
    }
  };

  // Показать тултип с лайкнувшими
  const handleLikeMouseEnter = () => {
    if (likesCount === 0) return;

    // Загружаем список пользователей
    loadLikedUsers();

    // Показываем тултип с задержкой
    tooltipTimeoutRef.current = setTimeout(() => {
      if (likeButtonRef.current) {
        const rect = likeButtonRef.current.getBoundingClientRect();
        setLikesTooltipPosition({
          x: rect.left,
          y: rect.bottom + 8
        });
        setShowLikesTooltip(true);
      }
    }, 300);
  };

  // Скрыть тултип
  const handleLikeMouseLeave = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    // Даем время пользователю переместить мышь на tooltip
    hideTooltipTimeoutRef.current = setTimeout(() => {
      setShowLikesTooltip(false);
    }, 200);
  };

  // Отменить скрытие при наведении на tooltip
  const handleTooltipMouseEnter = () => {
    if (hideTooltipTimeoutRef.current) {
      clearTimeout(hideTooltipTimeoutRef.current);
    }
  };

  // Скрыть тултип при уходе мыши с тултипа
  const handleTooltipMouseLeave = () => {
    setShowLikesTooltip(false);
  };

  // Очистка таймаутов при размонтировании
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
      if (hideTooltipTimeoutRef.current) {
        clearTimeout(hideTooltipTimeoutRef.current);
      }
    };
  }, []);

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

  const paddingLeft = 0; // Убираем динамические отступы

  return (
    <div className={`${styles.commentWrapper} ${depth === 1 ? styles.isFirstLevelReply : ''}`}>
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
              {depth > 0 && parentAuthorName && (
                <span className={styles.replyArrow}> → {parentAuthorName}</span>
              )}
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
                ref={editTextareaRef}
                className={styles.editInput}
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={400}
                rows={3}
                disabled={isSaving}
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
            <>
              <div className={`${styles.commentText} ${(isDeleted || isServerDeleted) ? styles.deletedText : ''}`}>
                {isDeleted || isServerDeleted ? (
                  '[Комментарий удален]'
                ) : (
                  <LinkifiedText text={comment.content} />
                )}
              </div>
              
              {/* Изображение комментария */}
              {!isDeleted && !isServerDeleted && comment.imageUrl && (
                <div className={styles.commentImage}>
                  <img 
                    src={comment.imageUrl.startsWith('http') 
                      ? comment.imageUrl 
                      : `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${comment.imageUrl}`
                    }
                    alt="Изображение комментария"
                    className={styles.commentImageImg}
                    onClick={() => setShowImageModal(true)}
                  />
                </div>
              )}
            </>
          )}

          {/* Модалка для просмотра изображения */}
          {comment.imageUrl && (
            <ImageModal
              imageUrl={comment.imageUrl.startsWith('http') 
                ? comment.imageUrl 
                : `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${comment.imageUrl}`
              }
              alt="Изображение комментария"
              isOpen={showImageModal}
              onClose={() => setShowImageModal(false)}
            />
          )}

          {/* Действия */}
          {!isServerDeleted && !isEditing && (
            <div className={styles.commentActions}>
              <div className={styles.commentActionsLeft}>
                {isDeleted ? (
                  // Если локально удален - показываем кнопку восстановления
                  <button className={styles.actionButton} onClick={() => onRestore && onRestore(comment.id)}>
                    Восстановить
                  </button>
                ) : (
                  <>
                    <button className={styles.actionButton} onClick={handleReply}>
                      Ответить
                    </button>
                    
                    {isOwn && (
                      <>
                        <button className={styles.actionButton} onClick={handleEdit}>
                          Редактировать
                        </button>
                        <button className={styles.actionButton} onClick={() => onDelete && onDelete(comment.id)}>
                          Удалить
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
              
              {/* Кнопка лайка справа */}
              {!isDeleted && (
                <div className={styles.commentActionsRight}>
                  <button 
                    ref={likeButtonRef}
                    className={`${styles.actionButton} ${styles.likeButton} ${isLiked ? styles.liked : ''} ${likesCount > 0 ? styles.hasLikes : ''}`}
                    onClick={handleLike}
                    onMouseEnter={handleLikeMouseEnter}
                    onMouseLeave={handleLikeMouseLeave}
                    disabled={isLiking || !currentUser}
                    title={isLiked ? 'Убрать лайк' : 'Лайкнуть'}
                  >
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill={isLiked ? '#ef4444' : 'none'}
                      xmlns="http://www.w3.org/2000/svg"
                      className={styles.heartIcon}
                    >
                      <path 
                        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </svg>
                    {likesCount > 0 && (
                      <span className={`${styles.likesCount} ${isLiked ? styles.likedCount : ''}`}>
                        {likesCount}
                      </span>
                    )}
                  </button>
                  
                  {/* Тултип со списком лайкнувших */}
                  {showLikesTooltip && likedUsers.length > 0 && (
                    <ReactionTooltip
                      users={likedUsers}
                      position={likesTooltipPosition}
                      onMouseEnter={handleTooltipMouseEnter}
                      onMouseLeave={handleTooltipMouseLeave}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Форма ответа */}
          {showReplyForm && (
            <form className={styles.replyForm} onSubmit={handleSubmitReply}>
              <div 
                className={`${styles.textareaWrapper} ${isDraggingReply ? styles.dragging : ''}`}
                onDragEnter={handleReplyDragEnter}
                onDragLeave={handleReplyDragLeave}
                onDragOver={handleReplyDragOver}
                onDrop={handleReplyDrop}
              >
                <textarea
                  className={styles.replyInput}
                  placeholder={`Ответ для @${comment.author.displayName}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={400}
                  rows={2}
                  disabled={submittingReply}
                  autoFocus
                />
                
                {/* Кнопки внутри textarea */}
                <div className={styles.textareaButtons}>
                  {/* Кнопка загрузки файла */}
                  <button
                    type="button"
                    className={styles.fileButton}
                    onClick={() => replyFileInputRef.current?.click()}
                    disabled={submittingReply}
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
                    ref={replyFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleReplyFileSelect}
                    style={{ display: 'none' }}
                  />
                  
                  {/* Кнопка эмодзи */}
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
              {replyFile && (
                <div className={styles.selectedFile}>
                  <span className={styles.fileName}>{replyFile.name}</span>
                  <button
                    type="button"
                    className={styles.removeFileButton}
                    onClick={handleRemoveReplyFile}
                  >
                    ×
                  </button>
                </div>
              )}
              
              <div className={styles.replyActions}>
                <button
                  type="submit"
                  className={styles.submitReplyButton}
                  disabled={(!replyText.trim() && !replyFile) || submittingReply}
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
              {loadingReplies ? 'Загрузка...' : getRepliesText(comment.repliesCount)}
            </button>
          )}
        </div>
      </div>

      {/* Список ответов - вынесен за пределы .comment */}
      {showReplies && replies.length > 0 && (
        <div className={styles.repliesList}>
          {replies.map((reply) => (
            <PostComment
              key={reply.id}
              comment={reply}
              postId={postId}
              depth={depth + 1}
              parentAuthorName={comment.author.displayName}
              isDeleted={deletedComments && deletedComments.has(reply.id)}
              deletedComments={deletedComments}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onRestore={onRestore}
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
  );
};

export default PostComment;
