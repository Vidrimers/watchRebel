import React, { useState, useEffect } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import api from '../../services/api';
import styles from './GroupMembersModal.module.css';

const GroupMembersModal = ({
  conversationId,
  isCreator,
  onClose,
  onMembersUpdated
}) => {
  const { user } = useAppSelector((state) => state.auth);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMembers();
  }, [conversationId]);

  const loadMembers = async () => {
    try {
      const response = await api.get(`/messages/conversations/${conversationId}/members`);
      setMembers(response.data);
    } catch (err) {
      console.error('Ошибка загрузки участников:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadFriends = async () => {
    try {
      setLoadingFriends(true);
      const response = await api.get(`/users/${user.id}/friends`);
      setFriends(response.data);
    } catch (err) {
      console.error('Ошибка загрузки друзей:', err);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleAddMember = async (friendId) => {
    try {
      await api.post(`/messages/conversations/${conversationId}/members`, { userId: friendId });
      await loadMembers();
      setShowAddMember(false);
      onMembersUpdated?.();
    } catch (err) {
      setError(err.data?.error || 'Ошибка добавления участника');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!confirm('Удалить участника из группы?')) return;
    try {
      await api.delete(`/messages/conversations/${conversationId}/members/${memberId}`);
      await loadMembers();
      onMembersUpdated?.();
    } catch (err) {
      setError(err.data?.error || 'Ошибка удаления участника');
    }
  };

  const handleLeaveGroup = async () => {
    if (!confirm('Покинуть группу?')) return;
    try {
      await api.delete(`/messages/conversations/${conversationId}/members/${user.id}`);
      onClose();
      onMembersUpdated?.();
    } catch (err) {
      setError(err.data?.error || 'Ошибка выхода из группы');
    }
  };

  const handleToggleModerator = async (member) => {
    if (member.isModerator) {
      // Снять модератора
      try {
        await api.delete(`/messages/conversations/${conversationId}/moderators/${member.userId}`);
        await loadMembers();
      } catch (err) {
        setError(err.data?.error || 'Ошибка снятия модератора');
      }
    } else {
      // Назначить модератора (с базовыми правами)
      try {
        await api.post(`/messages/conversations/${conversationId}/moderators`, {
          userId: member.userId,
          permissions: ['manage_members', 'manage_messages']
        });
        await loadMembers();
      } catch (err) {
        setError(err.data?.error || 'Ошибка назначения модератора');
      }
    }
  };

  const filteredFriends = friends.filter(f =>
    f.displayName.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !members.some(m => m.userId === f.id)
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Участники ({members.length})</h3>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.empty}>Загрузка...</div>
          ) : (
            <>
              {isCreator && (
                <button
                  className={styles.addMemberBtn}
                  onClick={() => {
                    setShowAddMember(!showAddMember);
                    if (!showAddMember) loadFriends();
                  }}
                >
                  + Добавить участника
                </button>
              )}

              {showAddMember && (
                <div className={styles.addMemberPanel}>
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Поиск друзей..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  <div className={styles.friendsList}>
                    {loadingFriends ? (
                      <div className={styles.empty}>Загрузка...</div>
                    ) : filteredFriends.length === 0 ? (
                      <div className={styles.empty}>Нет доступных друзей</div>
                    ) : (
                      filteredFriends.map(friend => (
                        <div key={friend.id} className={styles.friendItem}>
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
                          <button
                            className={styles.addBtn}
                            onClick={() => handleAddMember(friend.id)}
                          >
                            Добавить
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className={styles.membersList}>
                {members.map(member => (
                  <div key={member.userId} className={styles.memberItem}>
                    <div className={styles.memberAvatar}>
                      {member.avatarUrl ? (
                        <img
                          src={
                            member.avatarUrl.startsWith('/uploads/')
                              ? `${import.meta.env.VITE_API_URL || ''}${member.avatarUrl}`
                              : member.avatarUrl
                          }
                          alt={member.displayName}
                          className={styles.memberAvatarImg}
                        />
                      ) : (
                        <div className={styles.memberAvatarPlaceholder}>
                          {member.displayName?.charAt(0).toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <div className={styles.memberInfo}>
                      <span className={styles.memberName}>
                        {member.displayName}
                        {member.userId === user.id && ' (вы)'}
                      </span>
                      <div className={styles.memberBadges}>
                        {member.isCreator && <span className={styles.badgeCreator}>Создатель</span>}
                        {member.isModerator && <span className={styles.badgeMod}>Модератор</span>}
                      </div>
                    </div>
                    <div className={styles.memberActions}>
                      {isCreator && !member.isCreator && member.userId !== user.id && (
                        <>
                          <button
                            className={styles.actionBtn}
                            onClick={() => handleToggleModerator(member)}
                            title={member.isModerator ? 'Снять модератора' : 'Назначить модератором'}
                          >
                            {member.isModerator ? '🔧' : '⚙️'}
                          </button>
                          <button
                            className={`${styles.actionBtn} ${styles.removeBtn}`}
                            onClick={() => handleRemoveMember(member.userId)}
                            title="Удалить участника"
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {error && <div className={styles.error}>{error}</div>}
        </div>

        <div className={styles.footer}>
          <button className={styles.leaveBtn} onClick={handleLeaveGroup}>
            Покинуть группу
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupMembersModal;
