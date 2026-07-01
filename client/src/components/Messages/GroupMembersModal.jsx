import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../hooks/useAppSelector';
import api from '../../services/api';
import styles from './GroupMembersModal.module.css';

const PERMISSIONS = [
  { key: 'manage_members', label: 'Управление участниками', desc: 'Добавлять и удалять участников' },
  { key: 'manage_messages', label: 'Управление сообщениями', desc: 'Удалять сообщения других участников' },
  { key: 'edit_group', label: 'Редактирование группы', desc: 'Изменять название и аватарку' },
  { key: 'send_announcements', label: 'Объявления', desc: 'Отправлять объявления в группу' }
];

const GroupMembersModal = ({
  conversationId,
  isCreator,
  onClose,
  onMembersUpdated
}) => {
  const { user } = useAppSelector((state) => state.auth);
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [error, setError] = useState(null);
  const [modTarget, setModTarget] = useState(null); // участник для назначения модератором
  const [modPermissions, setModPermissions] = useState(['manage_members', 'manage_messages']);

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
      // Показать модалку с текущими правами для редактирования
      setModTarget(member);
      setModPermissions(member.permissions?.length > 0 ? [...member.permissions] : []);
    } else {
      // Показать модалку выбора прав
      setModTarget(member);
      setModPermissions(['manage_members', 'manage_messages']);
    }
  };

  const handleAssignModerator = async () => {
    if (!modTarget) return;
    try {
      await api.post(`/messages/conversations/${conversationId}/moderators`, {
        userId: modTarget.userId,
        permissions: modPermissions
      });
      setModTarget(null);
      await loadMembers();
    } catch (err) {
      setError(err.data?.error || 'Ошибка назначения модератора');
    }
  };

  const handleRemoveModerator = async () => {
    if (!modTarget) return;
    try {
      await api.delete(`/messages/conversations/${conversationId}/moderators/${modTarget.userId}`);
      setModTarget(null);
      await loadMembers();
    } catch (err) {
      setError(err.data?.error || 'Ошибка снятия модератора');
    }
  };

  const togglePermission = (key) => {
    setModPermissions(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
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
                    <a
                      href={`/user/${member.userId}`}
                      className={styles.memberAvatar}
                      onClick={(e) => { e.stopPropagation(); navigate(`/user/${member.userId}`); }}
                    >
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
                    </a>
                    <div className={styles.memberInfo}>
                      <a
                        href={`/user/${member.userId}`}
                        className={styles.memberNameLink}
                        onClick={(e) => { e.stopPropagation(); navigate(`/user/${member.userId}`); }}
                      >
                        {member.displayName}
                        {member.userId === user.id && ' (вы)'}
                      </a>
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

        {/* Модалка выбора/редактирования прав модератора */}
        {modTarget && (
          <div className={styles.permOverlay} onClick={() => setModTarget(null)}>
            <div className={styles.permModal} onClick={e => e.stopPropagation()}>
              <h4 className={styles.permTitle}>
                {modTarget.isModerator ? 'Редактировать права' : 'Назначить модератором'}
              </h4>
              <p className={styles.permSubtitle}>{modTarget.displayName}</p>
              <div className={styles.permList}>
                {PERMISSIONS.map(p => (
                  <label key={p.key} className={styles.permItem}>
                    <input
                      type="checkbox"
                      checked={modPermissions.includes(p.key)}
                      onChange={() => togglePermission(p.key)}
                      className={styles.permCheckbox}
                    />
                    <div className={styles.permInfo}>
                      <span className={styles.permLabel}>{p.label}</span>
                      <span className={styles.permDesc}>{p.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
              <div className={styles.permActions}>
                {modTarget.isModerator && (
                  <button className={styles.permRemove} onClick={handleRemoveModerator}>Снять модератора</button>
                )}
                <div className={styles.permActionsRight}>
                  <button className={styles.permCancel} onClick={() => setModTarget(null)}>Отмена</button>
                  <button className={styles.permSave} onClick={handleAssignModerator}>
                    {modTarget.isModerator ? 'Сохранить' : 'Назначить'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
