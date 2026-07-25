import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../Common/Icon';
import UserAvatar from '../User/UserAvatar';
import styles from './UserModerationModal.module.css';
import api from '../../services/api';
import useAlert from '../../hooks/useAlert.jsx';
import useConfirm from '../../hooks/useConfirm.jsx';

function UserModerationModal({ user, onClose, onUpdate }) {
  const navigate = useNavigate();
  const { alertDialog, showAlert } = useAlert();
  const { confirmDialog, showConfirm } = useConfirm();

  const [showBanModal, setShowBanModal] = useState(false);
  const [banType, setBanType] = useState(null);
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState(1440);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(user.displayName);
  const [renameReason, setRenameReason] = useState('');

  // Новые состояния
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Загрузка статистики
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const result = await api.get(`/admin/users/${user.id}/stats`);
        setStats(result.data);
      } catch (err) {
        console.error('Ошибка загрузки статистики:', err);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, [user.id]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  // === Обработчики ===

  const handleBanPosts = async () => {
    if (!reason.trim()) { setError('Необходимо указать причину блокировки'); return; }
    if (duration <= 0) { setError('Длительность должна быть больше 0'); return; }
    setLoading(true); setError(null);
    try {
      await api.post(`/admin/users/${user.id}/ban-posts`, { reason: reason.trim(), durationMinutes: duration });
      setShowBanModal(false); setReason(''); setDuration(1440);
      if (onUpdate) onUpdate();
      await showAlert({ title: 'Успешно', message: 'Пользователю запрещено создавать посты', type: 'success' });
    } catch (err) {
      setError(err.data?.error || 'Ошибка блокировки постов');
    } finally { setLoading(false); }
  };

  const handlePermanentBan = async () => {
    if (!reason.trim()) { setError('Необходимо указать причину блокировки'); return; }
    const confirmed = await showConfirm({
      title: 'Постоянная блокировка',
      message: 'Вы уверены, что хотите навсегда заблокировать этого пользователя?',
      confirmText: 'Заблокировать', cancelText: 'Отмена', confirmButtonStyle: 'danger'
    });
    if (!confirmed) return;
    setLoading(true); setError(null);
    try {
      await api.post(`/admin/users/${user.id}/ban-permanent`, { reason: reason.trim() });
      setShowBanModal(false); setReason('');
      if (onUpdate) onUpdate();
      await showAlert({ title: 'Успешно', message: 'Пользователь заблокирован навсегда', type: 'success' });
    } catch (err) {
      setError(err.data?.error || 'Ошибка постоянной блокировки');
    } finally { setLoading(false); }
  };

  const handleUnban = async () => {
    const confirmed = await showConfirm({
      title: 'Разблокировать пользователя', message: 'Вы уверены?',
      confirmText: 'Разблокировать', cancelText: 'Отмена', confirmButtonStyle: 'success'
    });
    if (!confirmed) return;
    setLoading(true);
    try {
      await api.post(`/admin/users/${user.id}/unban`);
      if (onUpdate) onUpdate();
      await showAlert({ title: 'Успешно', message: 'Пользователь разблокирован', type: 'success' });
    } catch (err) {
      await showAlert({ title: 'Ошибка', message: err.data?.error || 'Ошибка разблокировки', type: 'error' });
    } finally { setLoading(false); }
  };

  const handleRename = async () => {
    if (!newName.trim()) {
      await showAlert({ title: 'Ошибка', message: 'Введите новое имя', type: 'warning' });
      return;
    }
    setLoading(true);
    try {
      const payload = { displayName: newName.trim() };
      if (renameReason.trim()) payload.reason = renameReason.trim();
      await api.put(`/admin/users/${user.id}`, payload);
      setIsRenaming(false); setRenameReason('');
      if (onUpdate) onUpdate();
      await showAlert({ title: 'Успешно', message: 'Пользователь переименован', type: 'success' });
    } catch (err) {
      await showAlert({ title: 'Ошибка', message: err.data?.error || 'Ошибка переименования', type: 'error' });
    } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    const confirmed = await showConfirm({
      title: 'Удалить пользователя?',
      message: 'Все данные будут удалены безвозвратно.',
      confirmText: 'Удалить', cancelText: 'Отмена', confirmButtonStyle: 'danger'
    });
    if (!confirmed) return;
    setLoading(true);
    try {
      await api.delete(`/admin/users/${user.id}`);
      await showAlert({ title: 'Успешно', message: 'Пользователь удален', type: 'success' });
      if (onUpdate) onUpdate();
      onClose();
    } catch (err) {
      await showAlert({ title: 'Ошибка', message: err.data?.error || 'Ошибка удаления', type: 'error' });
    } finally { setLoading(false); }
  };

  const handleResetPassword = async () => {
    const confirmed = await showConfirm({
      title: 'Сбросить пароль?',
      message: `Отправить письмо для сброса пароля на ${user.email}?`,
      confirmText: 'Отправить', cancelText: 'Отмена', confirmButtonStyle: 'primary'
    });
    if (!confirmed) return;
    setLoading(true);
    try {
      const result = await api.post(`/admin/users/${user.id}/reset-password`);
      await showAlert({ title: 'Успешно', message: result.data.message, type: 'success' });
    } catch (err) {
      await showAlert({ title: 'Ошибка', message: err.data?.error || 'Ошибка отправки', type: 'error' });
    } finally { setLoading(false); }
  };

  const handleUnlink = async (method) => {
    const methodNames = { telegram: 'Telegram', email: 'Email', google: 'Google', discord: 'Discord' };
    const confirmed = await showConfirm({
      title: `Отвязать ${methodNames[method]}?`,
      message: `Вы уверены, что хотите отвязать ${methodNames[method]} от пользователя?`,
      confirmText: 'Отвязать', cancelText: 'Отмена', confirmButtonStyle: 'danger'
    });
    if (!confirmed) return;
    setLoading(true);
    try {
      await api.delete(`/admin/users/${user.id}/unlink/${method}`);
      if (onUpdate) onUpdate();
      await showAlert({ title: 'Успешно', message: `${methodNames[method]} отвязан`, type: 'success' });
    } catch (err) {
      await showAlert({ title: 'Ошибка', message: err.data?.error || 'Ошибка отвязки', type: 'error' });
    } finally { setLoading(false); }
  };

  const openPostBanModal = () => { setBanType('posts'); setShowBanModal(true); setError(null); };
  const openPermanentBanModal = () => { setBanType('permanent'); setShowBanModal(true); setError(null); };
  const closeBanModal = () => { setShowBanModal(false); setBanType(null); setReason(''); setDuration(1440); setError(null); };

  // Проверяем какие методы привязаны
  const connectedMethods = [];
  if (user.telegramUsername) connectedMethods.push({ key: 'telegram', label: 'Telegram', icon: 'telegram', value: `@${user.telegramUsername}` });
  if (user.email) connectedMethods.push({ key: 'email', label: 'Email', icon: 'email', value: user.email, verified: user.emailVerified });
  if (user.hasGoogle) connectedMethods.push({ key: 'google', label: 'Google', icon: 'google', value: 'Привязан' });
  if (user.hasDiscord) connectedMethods.push({ key: 'discord', label: 'Discord', icon: 'discord', value: 'Привязан' });

  return (
    <>
      {alertDialog}
      {confirmDialog}

      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

          {/* Шапка */}
          <div className={styles.header}>
            <UserAvatar user={user} size="medium" />
            <div className={styles.userInfo}>
              <h3 className={styles.userName}>
                {user.displayName}
                {user.isAdmin && <span className={styles.adminBadge}>Админ</span>}
              </h3>
              <div className={styles.userAuthMethods}>
                {user.authMethod === 'telegram' && <span className={styles.authBadge}><Icon name="telegram" size="small" /> Telegram</span>}
                {user.authMethod === 'email' && <span className={styles.authBadge}><Icon name="email" size="small" /> Email</span>}
                {user.authMethod === 'google' && <span className={styles.authBadge}><Icon name="google" size="small" /> Google</span>}
                {user.authMethod === 'discord' && <span className={styles.authBadge}><Icon name="discord" size="small" /> Discord</span>}
              </div>
              <p className={styles.userUsername}>
                {user.telegramUsername && `@${user.telegramUsername}`}
                {!user.telegramUsername && user.email && user.email}
                {!user.telegramUsername && !user.email && <span className={styles.noUsername}>—</span>}
              </p>
            </div>
            <button className={styles.closeButton} onClick={onClose}>✕</button>
          </div>

          {/* Информация */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}><Icon name="user" size="small" /> Информация</h4>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Регистрация</span>
                <span className={styles.infoValue}>{formatDate(user.createdAt)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Последняя активность</span>
                <span className={styles.infoValue}>{user.lastFeedView ? formatDate(user.lastFeedView) : 'Нет данных'}</span>
              </div>
              {user.banReason && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Причина бана</span>
                  <span className={`${styles.infoValue} ${styles.banText}`}>{user.banReason}</span>
                </div>
              )}
              {user.userStatus && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Статус</span>
                  <span className={styles.infoValue}>{user.userStatus}</span>
                </div>
              )}
            </div>
            {!statsLoading && stats && (
              <div className={styles.statsRow}>
                <span className={styles.statItem}>📝 {stats.posts} постов</span>
                <span className={styles.statItem}>👥 {stats.friends} друзей</span>
                <span className={styles.statItem}>⭐ {stats.ratings} оценок</span>
                <span className={styles.statItem}>📋 {stats.lists} списков</span>
              </div>
            )}
          </div>

          {/* Связанные аккаунты */}
          {connectedMethods.length > 0 && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}><Icon name="paperclip" size="small" /> Связанные аккаунты</h4>
              <div className={styles.connectionsList}>
                {connectedMethods.map(m => (
                  <div key={m.key} className={styles.connectionItem}>
                    <div className={styles.connectionInfo}>
                      <Icon name={m.icon} size="small" />
                      <span className={styles.connectionLabel}>{m.label}</span>
                      <span className={styles.connectionValue}>{m.value}</span>
                      {m.verified !== undefined && (
                        <span className={m.verified ? styles.verifiedBadge : styles.unverifiedBadge}>
                          {m.verified ? '✓ Подтверждён' : '⏳ Не подтверждён'}
                        </span>
                      )}
                    </div>
                    <button
                      className={styles.unlinkButton}
                      onClick={() => handleUnlink(m.key)}
                      disabled={loading}
                      title={`Отвязать ${m.label}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Модерация */}
          {user.authMethod === 'email' && user.email && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}><Icon name="lock" size="small" /> Безопасность</h4>
              <div className={styles.actions}>
                <button
                  className={`${styles.actionButton} ${styles.resetPasswordButton}`}
                  onClick={handleResetPassword}
                  disabled={loading}
                >
                  🔑 Сбросить пароль
                </button>
              </div>
            </div>
          )}

          {/* Модерация */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>🛡️ Модерация</h4>
            <div className={styles.actions}>
              <button
                className={`${styles.actionButton} ${styles.banPostsButton}`}
                onClick={openPostBanModal}
                disabled={loading}
              >
                🚫 Запретить посты
              </button>
              {user.isBlocked ? (
                <button
                  className={`${styles.actionButton} ${styles.unbanButton}`}
                  onClick={handleUnban}
                  disabled={loading}
                >
                  ✅ Разбанить
                </button>
              ) : (
                <button
                  className={`${styles.actionButton} ${styles.permanentBanButton}`}
                  onClick={openPermanentBanModal}
                  disabled={loading}
                >
                  ⛔ Забанить навсегда
                </button>
              )}
            </div>
          </div>

          {/* Управление */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>⚙️ Управление</h4>
            {isRenaming ? (
              <div className={styles.renameForm}>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Новое имя"
                  className={styles.input}
                  disabled={loading}
                />
                <textarea
                  value={renameReason}
                  onChange={(e) => setRenameReason(e.target.value)}
                  placeholder="Причина переименования (опционально)"
                  className={styles.textarea}
                  rows={2}
                  disabled={loading}
                />
                <div className={styles.renameActions}>
                  <button className={`${styles.actionButton} ${styles.saveButton}`} onClick={handleRename} disabled={loading}>Сохранить</button>
                  <button className={`${styles.actionButton} ${styles.cancelButton}`} onClick={() => { setIsRenaming(false); setNewName(user.displayName); setRenameReason(''); }} disabled={loading}>Отмена</button>
                </div>
              </div>
            ) : (
              <div className={styles.actions}>
                <button className={`${styles.actionButton} ${styles.editButton}`} onClick={() => setIsRenaming(true)} disabled={loading}>
                  <Icon name="edit" size="small" /> Переименовать
                </button>
                <button className={`${styles.actionButton} ${styles.deleteButton}`} onClick={handleDelete} disabled={loading}>
                  <Icon name="delete" size="small" /> Удалить
                </button>
              </div>
            )}
          </div>

          {/* Быстрые действия */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}><Icon name="friends" size="small" /> Быстрые действия</h4>
            <div className={styles.actions}>
              <button className={`${styles.actionButton} ${styles.quickActionButton}`} onClick={() => { onClose(); navigate(`/user/${user.id}`); }}>
                👤 Профиль
              </button>
              <button className={`${styles.actionButton} ${styles.quickActionButton}`} onClick={() => { onClose(); navigate(`/user/${user.id}?tab=wall`); }}>
                📝 Стена
              </button>
              <button className={`${styles.actionButton} ${styles.quickActionButton}`} onClick={() => { onClose(); navigate(`/user/${user.id}?tab=watchlist`); }}>
                🎬 Смотрю
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Модальное окно бана */}
      {showBanModal && (
        <div className={styles.modalOverlay} onClick={closeBanModal}>
          <div className={styles.banModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              {banType === 'posts' ? '🚫 Запретить посты' : '⛔ Постоянная блокировка'}
            </h3>
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.formGroup}>
              <label htmlFor="reason">Причина блокировки:</label>
              <textarea
                id="reason"
                className={styles.textarea}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Укажите причину блокировки..."
                rows={4}
                disabled={loading}
              />
            </div>
            {banType === 'posts' && (
              <div className={styles.formGroup}>
                <label htmlFor="duration">Длительность (минуты):</label>
                <input id="duration" type="number" className={styles.input} value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 0)} min="1" disabled={loading} />
                <div className={styles.durationPresets}>
                  <button className={styles.presetButton} onClick={() => setDuration(60)} disabled={loading}>1 час</button>
                  <button className={styles.presetButton} onClick={() => setDuration(1440)} disabled={loading}>1 день</button>
                  <button className={styles.presetButton} onClick={() => setDuration(10080)} disabled={loading}>1 неделя</button>
                  <button className={styles.presetButton} onClick={() => setDuration(43200)} disabled={loading}>1 месяц</button>
                </div>
              </div>
            )}
            <div className={styles.modalActions}>
              <button className={`${styles.button} ${styles.cancelButton}`} onClick={closeBanModal} disabled={loading}>Отмена</button>
              <button
                className={`${styles.button} ${banType === 'posts' ? styles.banPostsButton : styles.permanentBanButton}`}
                onClick={banType === 'posts' ? handleBanPosts : handlePermanentBan}
                disabled={loading}
              >
                {loading ? 'Обработка...' : 'Подтвердить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default UserModerationModal;
