import React, { useState, useEffect } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { sendMessage, fetchConversations } from '../../store/slices/messagesSlice';
import useToast from '../../hooks/useToast';
import api from '../../services/api';
import styles from './ForwardMessageModal.module.css';

const ForwardMessageModal = ({ message, onClose }) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { showToast } = useToast();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [showAuthor, setShowAuthor] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      const response = await api.get(`/users/${user.id}/friends`);
      setFriends(response.data);
    } catch (error) {
      console.error('Ошибка загрузки друзей:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFriend = (friendId) => {
    setSelectedFriends(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleForward = async () => {
    if (selectedFriends.length === 0) return;
    setSending(true);

    try {
      for (const friendId of selectedFriends) {
        await dispatch(sendMessage({
          receiverId: friendId,
          content: message.content,
          forwardFrom: showAuthor ? message.senderId : null,
          forwardMessageId: message.id
        }));
      }

      dispatch(fetchConversations());
      showToast(`Переслано ${selectedFriends.length > 1 ? `${selectedFriends.length} друзьям` : 'другу'}`, 'success');
      onClose();
    } catch (error) {
      console.error('Ошибка пересылки:', error);
      showToast('Ошибка при пересылке', 'error');
    } finally {
      setSending(false);
    }
  };

  const filteredFriends = friends.filter(f =>
    f.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Переслать сообщение</h3>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.preview}>
          <span className={styles.previewLabel}>Сообщение:</span>
          <span className={styles.previewText}>
            {message.content?.length > 100
              ? message.content.substring(0, 100) + '...'
              : message.content || '[вложение]'
            }
          </span>
        </div>

        <input
          type="text"
          className={styles.searchInput}
          placeholder="Поиск друзей..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          autoFocus
        />

        <label className={styles.authorToggle}>
          <input
            type="checkbox"
            checked={showAuthor}
            onChange={e => setShowAuthor(e.target.checked)}
          />
          <span>Показывать автора</span>
        </label>

        <div className={styles.friendsList}>
          {loading ? (
            <div className={styles.loading}>Загрузка...</div>
          ) : filteredFriends.length === 0 ? (
            <div className={styles.empty}>{searchQuery ? 'Не найдено' : 'Нет друзей'}</div>
          ) : (
            filteredFriends.map(friend => (
              <div
                key={friend.id}
                className={`${styles.friendItem} ${selectedFriends.includes(friend.id) ? styles.selected : ''}`}
                onClick={() => toggleFriend(friend.id)}
              >
                <div className={styles.friendAvatar}>
                  {friend.avatarUrl ? (
                    <img
                      src={friend.avatarUrl.startsWith('/uploads/')
                        ? `${import.meta.env.VITE_API_URL || ''}${friend.avatarUrl}`
                        : friend.avatarUrl
                      }
                      alt={friend.displayName}
                      className={styles.avatarImg}
                    />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      {friend.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className={styles.friendName}>{friend.displayName}</span>
                <div className={`${styles.checkbox} ${selectedFriends.includes(friend.id) ? styles.checked : ''}`}>
                  {selectedFriends.includes(friend.id) && '✓'}
                </div>
              </div>
            ))
          )}
        </div>

        <button
          className={styles.forwardBtn}
          disabled={selectedFriends.length === 0 || sending}
          onClick={handleForward}
        >
          {sending ? 'Отправка...' : `Переслать${selectedFriends.length > 0 ? ` (${selectedFriends.length})` : ''}`}
        </button>
      </div>
    </div>
  );
};

export default ForwardMessageModal;
