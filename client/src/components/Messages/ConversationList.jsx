import React, { useEffect } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { fetchConversations, setCurrentConversation } from '../../store/slices/messagesSlice';
import styles from './ConversationList.module.css';

/**
 * Список диалогов
 * Отображает все диалоги пользователя с превью последнего сообщения
 */
const ConversationList = ({ onSelectConversation }) => {
  const dispatch = useAppDispatch();
  const { conversations, loading, currentConversation } = useAppSelector((state) => state.messages);

  // Загружаем диалоги при монтировании компонента
  useEffect(() => {
    dispatch(fetchConversations());
  }, [dispatch]);

  // Обработчик выбора диалога
  const handleSelectConversation = (conversation) => {
    dispatch(setCurrentConversation(conversation.id));
    if (onSelectConversation) {
      onSelectConversation(conversation);
    }
  };

  // Форматирование даты
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин`;
    if (diffHours < 24) return `${diffHours} ч`;
    if (diffDays < 7) return `${diffDays} дн`;
    
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'short'
    });
  };

  // Обрезка длинного текста
  const truncateText = (text, maxLength = 50) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (loading && conversations.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Загрузка диалогов...</div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>💬</span>
          <p>Пока нет диалогов</p>
          <p className={styles.emptyHint}>Найдите пользователя и отправьте ему сообщение</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Сообщения</h2>
      </div>
      
      <ul className={styles.list}>
        {conversations.map((conversation) => (
          <li
            key={conversation.id}
            className={`${styles.item} ${currentConversation === conversation.id ? styles.active : ''}`}
            onClick={() => handleSelectConversation(conversation)}
          >
            <div className={styles.avatar}>
              {conversation.otherUser.avatarUrl ? (
                <img 
                  src={conversation.otherUser.avatarUrl} 
                  alt={conversation.otherUser.displayName}
                  className={styles.avatarImage}
                />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  {conversation.otherUser.displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            
            <div className={styles.content}>
              <div className={styles.topRow}>
                <span className={styles.name}>{conversation.otherUser.displayName}</span>
                <span className={styles.time}>{formatDate(conversation.lastMessageAt)}</span>
              </div>
              <div className={styles.bottomRow}>
                <p className={styles.lastMessage}>
                  {truncateText(conversation.lastMessage)}
                </p>
                {conversation.unreadCount > 0 && (
                  <div className={styles.unreadBadge}>
                    {conversation.unreadCount}
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ConversationList;
