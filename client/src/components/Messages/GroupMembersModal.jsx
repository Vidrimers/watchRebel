import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../hooks/useAppSelector';
import api from '../../services/api';
import { hasGroupKey, getGroupKey, fetchPublicKey, encryptGroupKeyForMember, generateGroupKey, storeGroupKey } from '../../services/e2ee';
import useAlert from '../../hooks/useAlert';
import styles from './GroupMembersModal.module.css';

const PERMISSIONS = [
  { key: 'manage_members', label: 'Управление участниками', desc: 'Добавлять и удалять участников' },
  { key: 'manage_messages', label: 'Управление сообщениями', desc: 'Удалять сообщения других участников' },
  { key: 'edit_group', label: 'Редактирование группы', desc: 'Изменять название и аватарку' },
  { key: 'send_announcements', label: 'Отправлять объявления', desc: 'Создавать объявления в группе' },
  { key: 'delete_announcements', label: 'Удалять объявления', desc: 'Удалять объявления в группе' },
  { key: 'manage_moderators', label: 'Управление модераторами', desc: 'Назначать и снимать модераторов (своих)' }
];

const GroupMembersModal = ({
  conversationId,
  isCreator,
  isSecretGroup,
  onClose,
  onMembersUpdated
}) => {
  const { user } = useAppSelector((state) => state.auth);
  const navigate = useNavigate();
  const { alertDialog, showAlert } = useAlert();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [error, setError] = useState(null);
  const [modTarget, setModTarget] = useState(null);
  const [modPermissions, setModPermissions] = useState(['manage_members', 'manage_messages']);

  useEffect(() => {
    loadMembers();
  }, [conversationId]);

  useEffect(() => {
    if (!modTarget) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') setModTarget(null);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [modTarget]);

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
      let encryptedGroupKey = null;

      // Для секретных групп — шифруем групповый ключ для нового участника
      if (isSecretGroup) {
        const groupKeyData = getGroupKey(conversationId);
        if (!groupKeyData) {
          await showAlert({ title: 'Ошибка', message: 'Нет группового ключа', type: 'error' });
          return;
        }

        const theirKey = await fetchPublicKey(friendId);
        if (!theirKey) {
          await showAlert({ title: 'Ошибка', message: 'У пользователя нет ключей E2EE', type: 'error' });
          return;
        }

        encryptedGroupKey = await encryptGroupKeyForMember(groupKeyData.key, theirKey.publicKey);
      }

      await api.post(`/messages/conversations/${conversationId}/members`, {
        userId: friendId,
        encryptedGroupKey
      });

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
      const response = await api.delete(`/messages/conversations/${conversationId}/members/${memberId}`);

      // Для секретных групп — если нужна ротация ключа
      if (response.data.keyRotationNeeded) {
        await handleKeyRotation();
      }

      await loadMembers();
      onMembersUpdated?.();
    } catch (err) {
      setError(err.data?.error || 'Ошибка удаления участника');
    }
  };

  const handleKeyRotation = async () => {
    try {
      // Генерируем новый групповый ключ
      const newGroupKey = generateGroupKey();

      // Получаем текущих участников
      const currentMembers = members.filter(m => m.userId !== user.id);
      const encryptedKeys = [];

      // Шифруем новый ключ для каждого оставшегося участника
      for (const member of currentMembers) {
        const theirKey = await fetchPublicKey(member.userId);
        if (theirKey) {
          const encryptedKey = await encryptGroupKeyForMember(newGroupKey, theirKey.publicKey);
          encryptedKeys.push({ userId: member.userId, encryptedGroupKey: encryptedKey });
        }
      }

      // Шифруем для себя
      const myKey = await fetchPublicKey(user.id);
      if (myKey) {
        const myEncryptedKey = await encryptGroupKeyForMember(newGroupKey, myKey.publicKey);
        encryptedKeys.push({ userId: user.id, encryptedGroupKey: myEncryptedKey });
      }

      // Получаем текущую версию ключа
      const currentKeyData = getGroupKey(conversationId);
      const newVersion = (currentKeyData?.version || 1) + 1;

      // Отправляем обновлённые ключи на сервер
      await api.put(`/messages/conversations/${conversationId}/group-key`, {
        encryptedKeys,
        keyVersion: newVersion
      });

      // Сохраняем новый ключ локально
      storeGroupKey(conversationId, newGroupKey, newVersion);

      await showAlert({ title: 'Готово', message: 'Ключ группы обновлён', type: 'success' });
    } catch (err) {
      console.error('Ошибка ротации ключа:', err);
      await showAlert({ title: 'Ошибка', message: 'Не удалось обновить ключ группы', type: 'error' });
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

  const handleRemoveModerator = async (modUserId) => {
    if (!confirm('Снять модератора?')) return;
    try {
      await api.delete(`/messages/conversations/${conversationId}/moderators/${modUserId}`);
      await loadMembers();
    } catch (err) {
      setError(err.data?.error || 'Ошибка снятия модератора');
    }
  };

  const filteredFriends = friends.filter(f =>
    f.displayName.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !members.some(m => m.userId === f.id && !m.leftAt)
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Участники группы {isSecretGroup && '🔒'}</h3>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.loading}>Загрузка...</div>
          ) : (
            <>
              <div className={styles.membersList}>
                {members.map(member => (
                  <div key={member.userId} className={styles.memberItem}>
                    <div className={styles.memberInfo}>
                      <div className={styles.memberAvatar}>
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl} alt={member.displayName} className={styles.memberAvatarImg} />
                        ) : (
                          <div className={styles.memberAvatarPlaceholder}>
                            {member.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className={styles.memberDetails}>
                        <span className={styles.memberName}>
                          {member.displayName}
                          {member.isCreator && <span className={styles.creatorBadge}>Создатель</span>}
                          {member.isModerator && <span className={styles.modBadge}>Мод</span>}
                        </span>
                        {member.permissions.length > 0 && (
                          <span className={styles.permissions}>
                            {member.permissions.map(p => PERMISSIONS.find(perm => perm.key === p)?.label).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.memberActions}>
                      {member.userId !== user.id && !member.isCreator && (
                        <>
                          {isCreator && !member.isModerator && (
                            <button
                              className={styles.actionBtn}
                              onClick={() => {
                                setModTarget(member);
                                setModPermissions(['manage_members', 'manage_messages']);
                              }}
                              title="Назначить модератором"
                            >
                              🛡️
                            </button>
                          )}
                          {isCreator && member.isModerator && (
                            <button
                              className={styles.actionBtn}
                              onClick={() => handleRemoveModerator(member.userId)}
                              title="Снять модератора"
                            >
                              ⚡
                            </button>
                          )}
                          {(isCreator || member.isModerator) && (
                            <button
                              className={`${styles.actionBtn} ${styles.removeBtn}`}
                              onClick={() => handleRemoveMember(member.userId)}
                              title="Удалить из группы"
                            >
                              ✕
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {showAddMember && (
                <div className={styles.addMemberSection}>
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
                      <div className={styles.loading}>Загрузка...</div>
                    ) : filteredFriends.length === 0 ? (
                      <div className={styles.empty}>Нет друзей для добавления</div>
                    ) : (
                      filteredFriends.map(friend => (
                        <div
                          key={friend.id}
                          className={styles.friendItem}
                          onClick={() => handleAddMember(friend.id)}
                        >
                          <div className={styles.friendAvatar}>
                            {friend.avatarUrl ? (
                              <img src={friend.avatarUrl} alt={friend.displayName} className={styles.friendAvatarImg} />
                            ) : (
                              <div className={styles.friendAvatarPlaceholder}>
                                {friend.displayName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <span className={styles.friendName}>{friend.displayName}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {error && <div className={styles.error}>{error}</div>}
            </>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.leaveBtn} onClick={handleLeaveGroup}>
            Покинуть группу
          </button>
          <button className={styles.addBtn} onClick={() => {
            setShowAddMember(!showAddMember);
            if (!showAddMember) loadFriends();
          }}>
            {showAddMember ? 'Отмена' : '+ Добавить участника'}
          </button>
        </div>

        {/* Модалка назначения модератора */}
        {modTarget && (
          <div className={styles.overlay} onClick={() => setModTarget(null)}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <div className={styles.header}>
                <h3>Назначить модератором: {modTarget.displayName}</h3>
                <button className={styles.closeBtn} onClick={() => setModTarget(null)}>×</button>
              </div>
              <div className={styles.body}>
                <div className={styles.permissionsList}>
                  {PERMISSIONS.map(perm => (
                    <label key={perm.key} className={styles.permissionItem}>
                      <input
                        type="checkbox"
                        checked={modPermissions.includes(perm.key)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setModPermissions(prev => [...prev, perm.key]);
                          } else {
                            setModPermissions(prev => prev.filter(p => p !== perm.key));
                          }
                        }}
                      />
                      <div>
                        <span className={styles.permissionLabel}>{perm.label}</span>
                        <span className={styles.permissionDesc}>{perm.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className={styles.footer}>
                <button className={styles.cancelBtn} onClick={() => setModTarget(null)}>Отмена</button>
                <button className={styles.confirmBtn} onClick={handleAssignModerator}>Назначить</button>
              </div>
            </div>
          </div>
        )}
      </div>
      {alertDialog}
    </div>
  );
};

export default GroupMembersModal;
