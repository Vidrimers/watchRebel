import React, { useEffect, useRef, useState } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { fetchMessages, sendMessage, deleteMessage } from '../../store/slices/messagesSlice';
import styles from './MessageThread.module.css';

/**
 * Окно переписки
 * Отображает сообщения в выбранном диалоге и позволяет отправлять новые
 */
const MessageThread = ({ conversation }) => {
  const dispatch = useAppDispatch();
  const { messages, loading, sendingMessage } = useAppSelector((state) => state.messages);
  const { user } = useAppSelector((state) => state.auth);
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef(null);

  // Загружаем сообщения при выборе диалога
  useEffect(() => {
    if (conversation && conversation.id) {
      dispatch(fetchMessages(conversation.id));
      
      // Устанавливаем polling для автоматического обновления сообщений
      const pollInterval = setInterval(() => {
        dispatch(fetchMessages(conversation.id));
      }, 3000); // Проверяем каждые 3 секунды
      
      return () => clearInterval(pollInterval);
    }
  }, [conversation, dispatch]);

  // Автоскролл к последнему сообщению
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Обработчик отправки сообщения
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!messageText.trim() || sendingMessage) return;

    const content = messageText.trim();
    setMessageText('');

    const result = await dispatch(sendMessage({
      receiverId: conversation.otherUser.id,
      content
    }));

    // Если это новый диалог (id === null), обновляем список диалогов
    if (conversation.id === null && result.meta.requestStatus === 'fulfilled') {
      // Диалог будет автоматически добавлен в список через fetchConversations
      // который вызывается в ConversationList при монтировании
    }
  };

  // Обработчик нажатия Enter
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Обработчик удаления сообщения
  const handleDeleteMessage = (messageId) => {
    if (window.confirm('Удалить это сообщение?')) {
      dispatch(deleteMessage(messageId));
    }
  };

  // Форматирование времени
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Форматирование даты для разделителя
  const formatDateSeparator = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Сегодня';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Вчера';
    } else {
      return date.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  // Проверка, нужен ли разделитель даты
  const shouldShowDateSeparator = (currentMessage, previousMessage) => {
    if (!previousMessage) return true;
    
    const currentDate = new Date(currentMessage.createdAt).toDateString();
    const previousDate = new Date(previousMessage.createdAt).toDateString();
    
    return currentDate !== previousDate;
  };

  if (!conversation) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>💬</span>
          <p>Выберите диалог для начала переписки</p>
        </div>
      </div>
    );
  }

  if (loading && messages.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerAvatar}>
            {conversation.otherUser.avatarUrl ? (
              <>
                <img 
                  src={
                    conversation.otherUser.avatarUrl.startsWith('/uploads/')
                      ? `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${conversation.otherUser.avatarUrl}`
                      : conversation.otherUser.avatarUrl
                  }
                  alt={conversation.otherUser.displayName}
                  className={styles.headerAvatarImage}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div 
                  className={styles.headerAvatarPlaceholder}
                  style={{ display: 'none' }}
                >
                  {conversation.otherUser.displayName.charAt(0).toUpperCase()}
                </div>
              </>
            ) : (
              <div className={styles.headerAvatarPlaceholder}>
                {conversation.otherUser.displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <h2 className={styles.headerName}>{conversation.otherUser.displayName}</h2>
        </div>
        <div className={styles.loading}>Загрузка сообщений...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Шапка с информацией о собеседнике */}
      <div className={styles.header}>
        <div className={styles.headerAvatar}>
          {conversation.otherUser.avatarUrl ? (
            <img 
              src={
                conversation.otherUser.avatarUrl.startsWith('/uploads/')
                  ? `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${conversation.otherUser.avatarUrl}`
                  : conversation.otherUser.avatarUrl
              }
              alt={conversation.otherUser.displayName}
              className={styles.headerAvatarImage}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div 
            className={styles.headerAvatarPlaceholder}
            style={{ display: conversation.otherUser.avatarUrl ? 'none' : 'flex' }}
          >
            {conversation.otherUser.displayName.charAt(0).toUpperCase()}
          </div>
        </div>
        <h2 className={styles.headerName}>{conversation.otherUser.displayName}</h2>
      </div>

      {/* Список сообщений */}
      <div className={styles.messagesContainer}>
        {messages.length === 0 ? (
          <div className={styles.emptyMessages}>
            <p>Начните переписку с {conversation.otherUser.displayName}</p>
          </div>
        ) : (
          <div className={styles.messagesList}>
            {messages.map((message, index) => {
              const isOwnMessage = message.senderId === user.id;
              const showDateSeparator = shouldShowDateSeparator(message, messages[index - 1]);

              return (
                <React.Fragment key={message.id}>
                  {showDateSeparator && (
                    <div className={styles.dateSeparator}>
                      {formatDateSeparator(message.createdAt)}
                    </div>
                  )}
                  
                  <div className={`${styles.message} ${isOwnMessage ? styles.ownMessage : styles.otherMessage}`}>
                    <div className={styles.messageAvatar}>
                      {isOwnMessage ? (
                        user.avatarUrl ? (
                          <>
                            <img 
                              src={
                                user.avatarUrl.startsWith('/uploads/')
                                  ? `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${user.avatarUrl}`
                                  : user.avatarUrl
                              }
                              alt={user.displayName}
                              className={styles.messageAvatarImage}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                            <div 
                              className={styles.messageAvatarPlaceholder}
                              style={{ display: 'none' }}
                            >
                              {user.displayName.charAt(0).toUpperCase()}
                            </div>
                          </>
                        ) : (
                          <div className={styles.messageAvatarPlaceholder}>
                            {user.displayName.charAt(0).toUpperCase()}
                          </div>
                        )
                      ) : (
                        conversation.otherUser.avatarUrl ? (
                          <>
                            <img 
                              src={
                                conversation.otherUser.avatarUrl.startsWith('/uploads/')
                                  ? `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${conversation.otherUser.avatarUrl}`
                                  : conversation.otherUser.avatarUrl
                              }
                              alt={conversation.otherUser.displayName}
                              className={styles.messageAvatarImage}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                            <div 
                              className={styles.messageAvatarPlaceholder}
                              style={{ display: 'none' }}
                            >
                              {conversation.otherUser.displayName.charAt(0).toUpperCase()}
                            </div>
                          </>
                        ) : (
                          <div className={styles.messageAvatarPlaceholder}>
                            {conversation.otherUser.displayName.charAt(0).toUpperCase()}
                          </div>
                        )
                      )}
                    </div>
                    
                    <div className={styles.messageBubble}>
                      <p className={styles.messageText}>{message.content}</p>
                      {message.sentViaBot && (
                        <div className={styles.botLabel}>
                          📱 Отвечено с помощью бота
                        </div>
                      )}
                      <div className={styles.messageFooter}>
                        <span className={styles.messageTime}>{formatTime(message.createdAt)}</span>
                        {isOwnMessage && (
                          <button
                            className={styles.deleteButton}
                            onClick={() => handleDeleteMessage(message.id)}
                            title="Удалить сообщение"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Форма отправки сообщения */}
      <form className={styles.inputForm} onSubmit={handleSendMessage}>
        <textarea
          className={styles.input}
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Напишите сообщение..."
          rows={1}
          disabled={sendingMessage}
        />
        <button
          type="submit"
          className={styles.sendButton}
          disabled={!messageText.trim() || sendingMessage}
        >
          {sendingMessage ? '...' : '➤'}
        </button>
      </form>
    </div>
  );
};

export default MessageThread;
