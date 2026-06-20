import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { createPost } from '../../store/slices/wallSlice';
import { sendMessage } from '../../store/slices/messagesSlice';
import Icon from './Icon';
import api from '../../services/api';
import styles from './ShareModal.module.css';

const ShareModal = ({ media, onClose }) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [mode, setMode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isCtrlDown, setIsCtrlDown] = useState(false);
  const [sending, setSending] = useState(false);
  const [friends, setFriends] = useState([]);
  const searchRef = useRef(null);

  useEffect(() => {
    const loadFriends = async () => {
      try {
        const response = await api.get(`/users/${user.id}/friends`);
        setFriends(response.data);
      } catch (error) {
        console.error('Ошибка загрузки друзей:', error);
      }
    };
    if (user?.id) loadFriends();
  }, [user?.id]);

  useEffect(() => {
    searchRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Control') setIsCtrlDown(true);
    };
    const handleKeyUp = (e) => {
      if (e.key === 'Control') setIsCtrlDown(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const filteredFriends = useMemo(() => {
    if (!searchQuery) return friends;
    const q = searchQuery.toLowerCase();
    return friends.filter(f =>
      (f.displayName || '').toLowerCase().includes(q) ||
      (f.username || '').toLowerCase().includes(q)
    );
  }, [friends, searchQuery]);

  const toggleUser = (userId) => {
    if (isCtrlDown) {
      setSelectedUsers(prev =>
        prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
      );
    } else {
      setSelectedUsers(prev =>
        prev.includes(userId) ? [] : [userId]
      );
    }
  };

  const handleSendToWall = async () => {
    setSending(true);
    try {
      await dispatch(createPost({
        postType: 'media_shared',
        content: 'Рекомендую к просмотру!',
        tmdbId: media.id,
        mediaType: media.mediaType,
        posterPath: media.poster_path
      })).unwrap();
      onClose();
    } catch (error) {
      console.error('Ошибка:', error);
    } finally {
      setSending(false);
    }
  };

  const handleSendToUsers = async () => {
    if (selectedUsers.length === 0) return;
    setSending(true);
    try {
      for (const userId of selectedUsers) {
        await dispatch(sendMessage({
          receiverId: userId,
          content: `🎬 ${media.title || media.name}`,
          files: [],
          suggestedMedia: {
            tmdbId: media.id,
            mediaType: media.mediaType,
            title: media.title || media.name,
            posterPath: media.poster_path,
            voteAverage: media.vote_average
          }
        })).unwrap();
      }
      onClose();
    } catch (error) {
      console.error('Ошибка:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Поделиться</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>

        {!mode ? (
          <div className={styles.modeSelect}>
            <button className={styles.modeButton} onClick={() => setMode('wall')}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              </svg>
              <span>На стене</span>
            </button>
            <button className={styles.modeButton} onClick={() => setMode('message')}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              <span>Отправить в личку</span>
            </button>
          </div>
        ) : mode === 'wall' ? (
          <div className={styles.wallSection}>
            <p className={styles.wallText}>Опубликовать фильм на вашей стене?</p>
            <div className={styles.wallActions}>
              <button className={styles.cancelBtn} onClick={() => setMode(null)}>Назад</button>
              <button className={styles.sendBtn} onClick={handleSendToWall} disabled={sending}>
                {sending ? 'Публикация...' : 'Опубликовать'}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.messageSection}>
            <div className={styles.searchWrapper}>
              <input
                ref={searchRef}
                type="text"
                className={styles.searchInput}
                placeholder="Поиск по друзьям..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className={styles.hint}>
              {isCtrlDown ? 'Отпустите Ctrl для выбора одного' : 'Зажмите Ctrl для выбора нескольких'}
            </div>
            <div className={styles.friendsList}>
              {filteredFriends.length === 0 ? (
                <p className={styles.empty}>Нет друзей</p>
              ) : (
                filteredFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className={`${styles.friendItem} ${selectedUsers.includes(friend.id) ? styles.selected : ''}`}
                    onClick={() => toggleUser(friend.id)}
                  >
                    {friend.avatarUrl ? (
                      <img src={friend.avatarUrl} alt="" className={styles.friendAvatar} />
                    ) : (
                      <div className={styles.friendAvatarPlaceholder}>
                        <Icon name="user" size="small" />
                      </div>
                    )}
                    <span className={styles.friendName}>{friend.displayName}</span>
                    {selectedUsers.includes(friend.id) && (
                      <span className={styles.checkmark}>✓</span>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className={styles.wallActions}>
              <button className={styles.cancelBtn} onClick={() => { setMode(null); setSelectedUsers([]); }}>Назад</button>
              <button className={styles.sendBtn} onClick={handleSendToUsers} disabled={sending || selectedUsers.length === 0}>
                {sending ? 'Отправка...' : `Отправить (${selectedUsers.length})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShareModal;
