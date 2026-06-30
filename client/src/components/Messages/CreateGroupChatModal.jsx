import React, { useState, useEffect } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import api from '../../services/api';
import styles from './CreateGroupChatModal.module.css';

const CreateGroupChatModal = ({ onClose, onCreated }) => {
  const { user } = useAppSelector((state) => state.auth);
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      const response = await api.get(`/users/${user.id}/friends`);
      setFriends(response.data);
    } catch (err) {
      console.error('Ошибка загрузки друзей:', err);
    } finally {
      setLoadingFriends(false);
    }
  };

  const toggleFriend = (friendId) => {
    setSelectedIds(prev =>
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
    );
  };

  const filteredFriends = friends.filter(f =>
    f.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = async () => {
    if (!groupName.trim()) {
      setError('Введите название группы');
      return;
    }
    if (selectedIds.length < 1) {
      setError('Добавьте хотя бы одного участника');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/messages/conversations/group', {
        groupName: groupName.trim(),
        memberIds: selectedIds
      });
      onCreated(response.data.id);
    } catch (err) {
      setError(err.data?.error || 'Ошибка создания группы');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Новый групповой чат</h3>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.body}>
          <input
            type="text"
            className={styles.input}
            placeholder="Название группы"
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            autoFocus
          />

          <input
            type="text"
            className={styles.input}
            placeholder="Поиск друзей..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />

          {selectedIds.length > 0 && (
            <div className={styles.selectedCount}>
              Выбрано: {selectedIds.length}
            </div>
          )}

          <div className={styles.friendsList}>
            {loadingFriends ? (
              <div className={styles.empty}>Загрузка...</div>
            ) : filteredFriends.length === 0 ? (
              <div className={styles.empty}>
                {searchQuery ? 'Друзья не найдены' : 'У вас пока нет друзей'}
              </div>
            ) : (
              filteredFriends.map(friend => (
                <div
                  key={friend.id}
                  className={`${styles.friendItem} ${selectedIds.includes(friend.id) ? styles.selected : ''}`}
                  onClick={() => toggleFriend(friend.id)}
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
                        className={styles.friendAvatarImg}
                      />
                    ) : (
                      <div className={styles.friendAvatarPlaceholder}>
                        {friend.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className={styles.friendName}>{friend.displayName}</span>
                  {selectedIds.includes(friend.id) && (
                    <span className={styles.checkmark}>✓</span>
                  )}
                </div>
              ))
            )}
          </div>

          {error && <div className={styles.error}>{error}</div>}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Отмена</button>
          <button
            className={styles.createBtn}
            onClick={handleCreate}
            disabled={loading || !groupName.trim() || selectedIds.length < 1}
          >
            {loading ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupChatModal;
