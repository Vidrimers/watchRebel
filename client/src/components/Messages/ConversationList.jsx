import React, { useEffect, useState } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { fetchConversations, setCurrentConversation, clearMessages } from '../../store/slices/messagesSlice';
import { addMessageHandler, removeMessageHandler } from '../../services/websocket';
import Icon from '../Common/Icon';
import useAlert from '../../hooks/useAlert';
import api from '../../services/api';
import { resolveDisplayNameWithTooltip } from '../../utils/nicknameResolver';
import { hasIdentityKey, fetchPublicKey, isEncryptedMessage, removeSessionKey } from '../../services/e2ee';
import CreateGroupChatModal from './CreateGroupChatModal';
import styles from './ConversationList.module.css';

/**
 * Список диалогов
 * Отображает все диалоги пользователя с превью последнего сообщения
 */
const ConversationList = ({ onSelectConversation }) => {
  const dispatch = useAppDispatch();
  const { conversations, loading, currentConversation } = useAppSelector((state) => state.messages);
  const { user } = useAppSelector((state) => state.auth);
  const { alertDialog, showAlert } = useAlert();
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletePopup, setDeletePopup] = useState(null);

  // Загружаем диалоги при монтировании компонента
  useEffect(() => {
    dispatch(fetchConversations());
  }, [dispatch]);

  // Глобальный WebSocket-обработчик для обновления списка диалогов
  useEffect(() => {
    const handleWebSocketEvent = (data) => {
      // Обновляем список при получении событий, связанных с группами
      if (data.type === 'secret_group_joined' ||
          data.type === 'group_deleted' ||
          data.type === 'secret_group_member_left' ||
          data.type === 'secret_group_removed') {
        dispatch(fetchConversations());
      }
    };

    addMessageHandler(handleWebSocketEvent);
    return () => removeMessageHandler(handleWebSocketEvent);
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
    dispatch(clearMessages());
    dispatch(setCurrentConversation(conversation.id));
    if (onSelectConversation) {
      onSelectConversation(conversation);
    }
  };

  // Обработчик создания секретного чата
  const handleCreateSecretChat = async (friend) => {
    if (!hasIdentityKey()) {
      await showAlert({ title: 'E2EE', message: 'Сначала создайте ключи E2EE в настройках', type: 'warning' });
      return;
    }

    // Проверяем, есть ли уже секретный чат с этим пользователем
    const existingSecret = conversations.find(
      conv => conv.isSecret && conv.otherUser?.id === friend.id
    );
    if (existingSecret) {
      setShowNewMessageModal(false);
      setSearchQuery('');
      handleSelectConversation(existingSecret);
      return;
    }

    try {
      // Проверяем, есть ли у друга публичный ключ
      const theirKey = await fetchPublicKey(friend.id);
      if (!theirKey) {
        await showAlert({ title: 'E2EE', message: 'У этого пользователя ещё нет ключей шифрования. Секретный чат будет доступен после создания ключей.', type: 'warning' });
        return;
      }

      // Создаём секретный чат на сервере
      const response = await api.post('/messages/conversations/secret', { memberId: friend.id });
      const newConversation = {
        id: response.data.id,
        isSecret: true,
        otherUser: response.data.otherUser,
        lastMessage: null,
        unreadCount: 0,
        lastMessageAt: response.data.createdAt,
        createdAt: response.data.createdAt
      };

      setShowNewMessageModal(false);
      setSearchQuery('');
      dispatch(fetchConversations());
      handleSelectConversation(newConversation);
    } catch (error) {
      console.error('Ошибка создания секретного чата:', error);
      const msg = error.response?.data?.error || 'Не удалось создать секретный чат';
      await showAlert({ title: 'Ошибка', message: msg, type: 'error' });
    }
  };

  // Обработчик выбора друга для нового сообщения
  const handleSelectFriend = (friend) => {
    // Проверяем, существует ли уже диалог с этим пользователем
    const existingConversation = conversations.find(
      conv => !conv.isGroup && conv.otherUser?.id === friend.id
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

  // Обработчик клика на крестик удаления
  const handleDeleteClick = (e, conversationId) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setDeletePopup({
      conversationId,
      position: { x: rect.left, y: rect.bottom + 4 }
    });
  };

  // Закрытие popup при клике вне области
  useEffect(() => {
    if (!deletePopup) return;
    const handleClickOutside = () => setDeletePopup(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [deletePopup]);

  // Удаление диалога
  const handleDeleteConversation = async (deleteType) => {
    if (!deletePopup) return;
    try {
      // Находим диалог для проверки является ли он секретным
      const conversation = conversations.find(c => c.id === deletePopup.conversationId);

      await api.delete(`/messages/conversations/${deletePopup.conversationId}`, {
        params: { deleteType }
      });

      // Удаляем session key для секретных чатов
      if (conversation?.isSecret) {
        removeSessionKey(deletePopup.conversationId);
      }

      // Обновляем список диалогов
      dispatch(fetchConversations());
      setDeletePopup(null);
    } catch (error) {
      console.error('Ошибка удаления диалога:', error);
      // Если диалог не найден на сервере — обновляем список (удалим из кэша)
      if (error.status === 404) {
        dispatch(fetchConversations());
        setDeletePopup(null);
      }
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
          <span className={styles.emptyIcon}>
            <Icon name="messages" size="large" />
          </span>
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
                                ? `${import.meta.env.VITE_API_URL || ''}${friend.avatarUrl}`
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
                      <button
                        className={styles.secretChatButton}
                        onClick={(e) => { e.stopPropagation(); handleCreateSecretChat(friend); }}
                        title="Создать секретный чат"
                      >
                        <Icon name="secret-chat" size="small" />
                      </button>
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
        <div className={styles.headerButtons}>
          <button
            className={styles.newMessageButton}
            onClick={() => setShowNewMessageModal(true)}
            title="Написать новое сообщение"
          >
            Написать
          </button>
          <button
            className={styles.newMessageButton}
            onClick={() => setShowCreateGroupModal(true)}
            title="Создать групповой чат"
          >
            Группа
          </button>
        </div>
      </div>

      <ul className={styles.list}>
        {conversations.map((conversation) => {
          const isGroup = conversation.isGroup;
          const isSecret = conversation.isSecret;
          const displayName = isGroup ? conversation.groupName : conversation.otherUser?.displayName;
          const avatarUrl = isGroup ? conversation.groupAvatar : conversation.otherUser?.avatarUrl;

          return (
            <li
              key={conversation.id}
              className={`${styles.item} ${currentConversation === conversation.id ? styles.active : ''}`}
              onClick={() => handleSelectConversation(conversation)}
            >
              <div className={styles.avatar}>
                {avatarUrl ? (
                  <img
                    src={
                      avatarUrl.startsWith('/uploads/')
                        ? `${import.meta.env.VITE_API_URL || ''}${avatarUrl}`
                        : avatarUrl
                    }
                    alt={displayName}
                    className={styles.avatarImage}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div
                  className={styles.avatarPlaceholder}
                  style={{ display: avatarUrl ? 'none' : 'flex' }}
                >
                  {isGroup ? '👥' : (displayName?.charAt(0).toUpperCase() || '?')}
                </div>
              </div>

              <div className={styles.content}>
                <div className={styles.topRow}>
                  <span className={styles.name} title={displayName}>
                    {isSecret && <Icon name="secret-chat" size="small" className={styles.secretIcon} />}
                    {isGroup ? `👥 ${displayName}` : (
                      conversation.otherUser ? resolveDisplayNameWithTooltip(conversation.otherUser.id, displayName).text : displayName
                    )}
                  </span>
                  <span className={styles.time}>{formatDate(conversation.lastMessageAt)}</span>
                </div>
                <div className={styles.bottomRow}>
                  <p className={styles.lastMessage} title={conversation.lastMessage}>
                    {conversation.isSecret && isEncryptedMessage(conversation.lastMessage)
                      ? '🔒 Зашифрованное сообщение'
                      : truncateText(conversation.lastMessage)
                    }
                  </p>
                  {conversation.unreadCount > 0 && (
                    <div className={styles.unreadBadge}>
                      {conversation.unreadCount}
                    </div>
                  )}
                </div>
                {isGroup && conversation.membersCount > 0 && (
                  <div className={styles.memberCount}>{conversation.membersCount} участников</div>
                )}
              </div>

              <button
                className={styles.deleteButton}
                onClick={(e) => handleDeleteClick(e, conversation.id)}
                title="Удалить диалог"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>

      {showCreateGroupModal && (
        <CreateGroupChatModal
          onClose={() => setShowCreateGroupModal(false)}
          onCreated={(convId) => {
            setShowCreateGroupModal(false);
            dispatch(fetchConversations());
          }}
        />
      )}

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
                              ? `${import.meta.env.VITE_API_URL || ''}${friend.avatarUrl}`
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
                    <button
                      className={styles.secretChatButton}
                      onClick={(e) => { e.stopPropagation(); handleCreateSecretChat(friend); }}
                      title="Создать секретный чат"
                    >
                      <Icon name="secret-chat" size="small" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Popup удаления диалога */}
      {deletePopup && (
        <div
          className={styles.deletePopup}
          style={{ left: deletePopup.position.x, top: deletePopup.position.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className={styles.deletePopupOption}
            onClick={() => handleDeleteConversation('for_me')}
          >
            Удалить у себя
          </button>
          <button
            className={`${styles.deletePopupOption} ${styles.deletePopupDanger}`}
            onClick={() => handleDeleteConversation('for_everyone')}
          >
            Удалить у всех
          </button>
          <button
            className={styles.deletePopupOption}
            style={{ borderTop: '1px solid var(--border-color, #e0e0e0)', textAlign: 'center', color: 'var(--text-secondary, #666)' }}
            onClick={() => setDeletePopup(null)}
          >
            Отмена
          </button>
        </div>
      )}
      {alertDialog}
    </div>
  );
};

export default ConversationList;
