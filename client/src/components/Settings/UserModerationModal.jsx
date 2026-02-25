import React, { useState } from 'react';
import Icon from '../Common/Icon';
import styles from './UserModerationModal.module.css';
import api from '../../services/api';
import useAlert from '../../hooks/useAlert.jsx';
import useConfirm from '../../hooks/useConfirm.jsx';

/**
 * Модальное окно для модерации пользователя
 * Объединяет функционал AdminModerationPanel и действия с пользователем
 */
function UserModerationModal({ user, onClose, onUpdate }) {
  const { alertDialog, showAlert } = useAlert();
  const { confirmDialog, showConfirm } = useConfirm();
  
  const [showBanModal, setShowBanModal] = useState(false);
  const [banType, setBanType] = useState(null); // 'posts' или 'permanent'
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState(1440); // 24 часа по умолчанию
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Состояние для переименования
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(user.displayName);
  const [renameReason, setRenameReason] = useState(''); // Причина переименования (опционально)

  /**
   * Обработчик блокировки постов
   */
  const handleBanPosts = async () => {
    if (!reason.trim()) {
      setError('Необходимо указать причину блокировки');
      return;
    }

    if (duration <= 0) {
      setError('Длительность должна быть больше 0');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.post(`/admin/users/${user.id}/ban-posts`, {
        reason: reason.trim(),
        durationMinutes: duration
      });

      setShowBanModal(false);
      setReason('');
      setDuration(1440);

      if (onUpdate) {
        onUpdate();
      }

      await showAlert({
        title: 'Успешно',
        message: 'Пользователю запрещено создавать посты',
        type: 'success'
      });
    } catch (err) {
      console.error('Ошибка блокировки постов:', err);
      setError(err.response?.data?.error || 'Ошибка блокировки постов');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Обработчик постоянной блокировки
   */
  const handlePermanentBan = async () => {
    if (!reason.trim()) {
      setError('Необходимо указать причину блокировки');
      return;
    }

    const confirmed = await showConfirm({
      title: 'Постоянная блокировка',
      message: 'Вы уверены, что хотите навсегда заблокировать этого пользователя?',
      confirmText: 'Заблокировать',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.post(`/admin/users/${user.id}/ban-permanent`, {
        reason: reason.trim()
      });

      setShowBanModal(false);
      setReason('');

      if (onUpdate) {
        onUpdate();
      }

      await showAlert({
        title: 'Успешно',
        message: 'Пользователь заблокирован навсегда',
        type: 'success'
      });
    } catch (err) {
      console.error('Ошибка постоянной блокировки:', err);
      setError(err.response?.data?.error || 'Ошибка постоянной блокировки');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Обработчик разблокировки
   */
  const handleUnban = async () => {
    const confirmed = await showConfirm({
      title: 'Разблокировать пользователя',
      message: 'Вы уверены, что хотите разблокировать этого пользователя?',
      confirmText: 'Разблокировать',
      cancelText: 'Отмена',
      confirmButtonStyle: 'success'
    });

    if (!confirmed) {
      return;
    }

    setLoading(true);

    try {
      await api.post(`/admin/users/${user.id}/unban`);

      if (onUpdate) {
        onUpdate();
      }

      await showAlert({
        title: 'Успешно',
        message: 'Пользователь разблокирован',
        type: 'success'
      });
    } catch (err) {
      console.error('Ошибка разблокировки:', err);
      await showAlert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Ошибка разблокировки',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Обработчик переименования
   */
  const handleRename = async () => {
    if (!newName.trim()) {
      await showAlert({
        title: 'Ошибка',
        message: 'Введите новое имя',
        type: 'warning'
      });
      return;
    }

    setLoading(true);

    try {
      const payload = { displayName: newName.trim() };
      
      // Добавляем причину, если она указана
      if (renameReason.trim()) {
        payload.reason = renameReason.trim();
      }

      await api.put(`/admin/users/${user.id}`, payload);

      setIsRenaming(false);
      setRenameReason(''); // Очищаем причину

      if (onUpdate) {
        onUpdate();
      }

      await showAlert({
        title: 'Успешно',
        message: 'Пользователь переименован',
        type: 'success'
      });
    } catch (err) {
      console.error('Ошибка переименования:', err);
      await showAlert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Ошибка переименования',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Обработчик удаления пользователя
   */
  const handleDelete = async () => {
    const confirmed = await showConfirm({
      title: 'Удалить пользователя?',
      message: 'Вы уверены, что хотите удалить этого пользователя? Все его данные будут удалены безвозвратно.',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });

    if (!confirmed) {
      return;
    }

    setLoading(true);

    try {
      await api.delete(`/admin/users/${user.id}`);

      await showAlert({
        title: 'Успешно',
        message: 'Пользователь удален',
        type: 'success'
      });

      if (onUpdate) {
        onUpdate();
      }

      onClose();
    } catch (err) {
      console.error('Ошибка удаления:', err);
      await showAlert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Ошибка удаления',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Открыть модальное окно для блокировки постов
   */
  const openPostBanModal = () => {
    setBanType('posts');
    setShowBanModal(true);
    setError(null);
  };

  /**
   * Открыть модальное окно для постоянной блокировки
   */
  const openPermanentBanModal = () => {
    setBanType('permanent');
    setShowBanModal(true);
    setError(null);
  };

  /**
   * Закрыть модальное окно бана
   */
  const closeBanModal = () => {
    setShowBanModal(false);
    setBanType(null);
    setReason('');
    setDuration(1440);
    setError(null);
  };

  return (
    <>
      {alertDialog}
      {confirmDialog}
      
      {/* Основное модальное окно */}
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          {/* Шапка с аватаркой и именем */}
          <div className={styles.header}>
            <img
              src={
                user.avatarUrl?.startsWith('/uploads/')
                  ? `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${user.avatarUrl}`
                  : user.avatarUrl || '/default-avatar.png'
              }
              alt={user.displayName}
              className={styles.avatar}
            />
            <div className={styles.userInfo}>
              <h3 className={styles.userName}>{user.displayName}</h3>
              <p className={styles.userUsername}>@{user.telegramUsername || 'нет username'}</p>
            </div>
            <button className={styles.closeButton} onClick={onClose}>
              ✕
            </button>
          </div>

          {/* Действия модерации */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Модерация</h4>
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

          {/* Действия с пользователем */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Управление</h4>
            
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
                  rows={3}
                  disabled={loading}
                />
                <div className={styles.renameActions}>
                  <button
                    className={`${styles.actionButton} ${styles.saveButton}`}
                    onClick={handleRename}
                    disabled={loading}
                  >
                    Сохранить
                  </button>
                  <button
                    className={`${styles.actionButton} ${styles.cancelButton}`}
                    onClick={() => {
                      setIsRenaming(false);
                      setNewName(user.displayName);
                      setRenameReason(''); // Очищаем причину при отмене
                    }}
                    disabled={loading}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.actions}>
                <button
                  className={`${styles.actionButton} ${styles.editButton}`}
                  onClick={() => setIsRenaming(true)}
                  disabled={loading}
                >
                  <Icon name="edit" size="small" /> Переименовать
                </button>
                <button
                  className={`${styles.actionButton} ${styles.deleteButton}`}
                  onClick={handleDelete}
                  disabled={loading}
                >
                  <Icon name="delete" size="small" /> Удалить
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Модальное окно бана */}
      {showBanModal && (
        <div className={styles.modalOverlay} onClick={closeBanModal}>
          <div className={styles.banModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              {banType === 'posts' ? (
                <>
                  <Icon name="block" size="small" /> Запретить посты
                </>
              ) : (
                <>
                  <Icon name="ban" size="small" /> Постоянная блокировка
                </>
              )}
            </h3>

            {error && (
              <div className={styles.error}>{error}</div>
            )}

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
                <input
                  id="duration"
                  type="number"
                  className={styles.input}
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                  min="1"
                  disabled={loading}
                />
                <div className={styles.durationPresets}>
                  <button 
                    className={styles.presetButton}
                    onClick={() => setDuration(60)}
                    disabled={loading}
                  >
                    1 час
                  </button>
                  <button 
                    className={styles.presetButton}
                    onClick={() => setDuration(1440)}
                    disabled={loading}
                  >
                    1 день
                  </button>
                  <button 
                    className={styles.presetButton}
                    onClick={() => setDuration(10080)}
                    disabled={loading}
                  >
                    1 неделя
                  </button>
                  <button 
                    className={styles.presetButton}
                    onClick={() => setDuration(43200)}
                    disabled={loading}
                  >
                    1 месяц
                  </button>
                </div>
              </div>
            )}

            <div className={styles.modalActions}>
              <button
                className={`${styles.button} ${styles.cancelButton}`}
                onClick={closeBanModal}
                disabled={loading}
              >
                Отмена
              </button>
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
