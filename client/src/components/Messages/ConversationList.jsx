import React, { useEffect, useState } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { fetchConversations, setCurrentConversation } from '../../store/slices/messagesSlice';
import api from '../../services/api';
import styles from './ConversationList.module.css';

/**
 * Список диалогов
 * Отображает все диалоги пользователя с превью последнего сообщения
 */
const ConversationList = ({ onSelectConversation }) => {
  const dispatch = useAppDispatch();
  const { conversations, loading, currentConversation } = useAppSelector((state) => state.messages);
  const { user } = useAppSelector((state) => state.auth);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Загружаем диалоги при монтировании компонента
  useEffect(() => {
    dispatch(fetchConversations());
  }, [dispatch]);

  // Загружаем список друзей при открытии модального окна
  useEffect(() => {
    if (showNewMessageModal && user) {
      loadFriends();
    }
  }, [showNewMessageModal, user]);

  const loadFriends = async () => {
    try {
      setLoadingFriends(true);
      const response = await api.get(`/users/${user.id}/friends`);
      setFriends(response.data);
    } catch (error) {
      console.error('Ошибка загрузки друзей:', error);
    } finally {
      setLoadingFriends(false);
    }
  };

  // Обработчик выбора диалога
  const handleSelectConversation = (conversation) => {
    dispatch(setCurrentConversation(conversation.id));
    if (onSelectConversation) {
      onSelectConversation(conversation);
    }
  };

  // Обработчик выбора друга для нового сообщения
  const handleSelectFriend = (friend) => {
    // Проверяем, существует ли уже диалог с этим пользователем
    const existingConversation = conversations.find(
      conv => conv.otherUser.id === friend.id
    );

    if (existingConversation) {
      // Если диалог уже существует, открываем его
      setShowNewMessageModal(false);
      setSearchQuery('');
      handleSelectConversation(existingConversation);
    } else {
      // Создаем временный объект диалога для нового сообщения
      const newConversation = {
        id: null, // null означает новый диалог
        otherUser: {
          id: friend.id,
          displayName: friend.displayName,
          avatarUrl: friend.avatarUrl
        },
        lastMessage: null,
        unreadCount: 0,
        lastMessageAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      
      setShowNewMessageModal(false);
      setSearchQuery('');
      handleSelectConversation(newConversation);
    }
  };

  // Фильтрация друзей по поисковому запросу
  const filteredFriends = friends.filter(friend =>
    friend.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <div className={styles.header}>
          <h2 className={styles.title}>Сообщения</h2>
          <button 
            className={styles.newMessageButton}
            onClick={() => setShowNewMessageModal(true)}
            title="Написать новое сообщение"
          >
            Написать
          </button>
        </div>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>💬</span>
          <p>Пока нет диалогов</p>
          <p className={styles.emptyHint}>Нажмите "Написать", чтобы начать переписку</p>
        </div>

        {/* Модальное окно выбора друга */}
        {showNewMessageModal && (
          <div className={styles.modal} onClick={() => setShowNewMessageModal(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3>Выберите получателя</h3>
                <button 
                  className={styles.closeButton}
                  onClick={() => setShowNewMessageModal(false)}
                >
                  ×
                </button>
              </div>
              
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Поиск друзей..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />

              <div className={styles.friendsList}>
                {loadingFriends ? (
                  <div className={styles.modalLoading}>Загрузка друзей...</div>
                ) : filteredFriends.length === 0 ? (
                  <div className={styles.modalEmpty}>
                    {searchQuery ? 'Друзья не найдены' : 'У вас пока нет друзей'}
                  </div>
                ) : (
                  filteredFriends.map((friend) => (
                    <div
                      key={friend.id}
                      className={styles.friendItem}
                      onClick={() => handleSelectFriend(friend)}
                    >
                      <div className={styles.friendAvatar}>
                        {friend.avatarUrl ? (
                          <img 
                            src={
                              friend.avatarUrl.startsWith('/uploads/')
                                ? `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${friend.avatarUrl}`
                                : friend.avatarUrl
                            }
                            alt={friend.displayName}
                            className={styles.friendAvatarImage}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div 
                          className={styles.friendAvatarPlaceholder}
                          style={{ display: friend.avatarUrl ? 'none' : 'flex' }}
                        >
                          {friend.displayName.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <span className={styles.friendName}>{friend.displayName}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Сообщения</h2>
        <button 
          className={styles.newMessageButton}
          onClick={() => setShowNewMessageModal(true)}
          title="Написать новое сообщение"
        >
          Написать
        </button>
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
                  src={
                    conversation.otherUser.avatarUrl.startsWith('/uploads/')
                      ? `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${conversation.otherUser.avatarUrl}`
                      : conversation.otherUser.avatarUrl
                  }
                  alt={conversation.otherUser.displayName}
                  className={styles.avatarImage}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div 
                className={styles.avatarPlaceholder}
                style={{ display: conversation.otherUser.avatarUrl ? 'none' : 'flex' }}
              >
                {conversation.otherUser.displayName.charAt(0).toUpperCase()}
              </div>
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

      {/* Модальное окно выбора друга */}
      {showNewMessageModal && (
        <div className={styles.modal} onClick={() => setShowNewMessageModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Выберите получателя</h3>
              <button 
                className={styles.closeButton}
                onClick={() => setShowNewMessageModal(false)}
              >
                ×
              </button>
            </div>
            
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Поиск друзей..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />

            <div className={styles.friendsList}>
              {loadingFriends ? (
                <div className={styles.modalLoading}>Загрузка друзей...</div>
              ) : filteredFriends.length === 0 ? (
                <div className={styles.modalEmpty}>
                  {searchQuery ? 'Друзья не найдены' : 'У вас пока нет друзей'}
                </div>
              ) : (
                filteredFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className={styles.friendItem}
                    onClick={() => handleSelectFriend(friend)}
                  >
                    <div className={styles.friendAvatar}>
                      {friend.avatarUrl ? (
                        <img 
                          src={
                            friend.avatarUrl.startsWith('/uploads/')
                              ? `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${friend.avatarUrl}`
                              : friend.avatarUrl
                          }
                          alt={friend.displayName}
                          className={styles.friendAvatarImage}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className={styles.friendAvatarPlaceholder}
                        style={{ display: friend.avatarUrl ? 'none' : 'flex' }}
                      >
                        {friend.displayName.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <span className={styles.friendName}>{friend.displayName}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationList;
