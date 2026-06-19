import React, { useState } from 'react';
import styles from './AdminModerationPanel.module.css';
import api from '../../services/api';
import useAlert from '../../hooks/useAlert.jsx';
import useConfirm from '../../hooks/useConfirm.jsx';
import Icon from '../Common/Icon.jsx';

/**
 * Компонент панели модерации для администратора
 * Отображается как dropdown меню
 */
function AdminModerationPanel({ userId, isAdmin, onModerationAction }) {
  const { alertDialog, showAlert } = useAlert();
  const { confirmDialog, showConfirm } = useConfirm();
  
  const [isOpen, setIsOpen] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [banType, setBanType] = useState(null); // 'posts' или 'permanent'
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState(1440); // 24 часа по умолчанию
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Если не админ, не показываем панель
  if (!isAdmin) {
    return null;
  }

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
      await api.post(`/admin/users/${userId}/ban-posts`, {
        reason: reason.trim(),
        durationMinutes: duration
      });

      // Закрываем модальное окно
      setShowBanModal(false);
      setReason('');
      setDuration(1440);

      // Уведомляем родительский компонент
      if (onModerationAction) {
        onModerationAction('post_ban');
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
      await api.post(`/admin/users/${userId}/ban-permanent`, {
        reason: reason.trim()
      });

      // Закрываем модальное окно
      setShowBanModal(false);
      setReason('');

      // Уведомляем родительский компонент
      if (onModerationAction) {
        onModerationAction('permanent_ban');
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
    setIsOpen(false);
    
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
    setError(null);

    try {
      await api.post(`/admin/users/${userId}/unban`);

      // Уведомляем родительский компонент
      if (onModerationAction) {
        onModerationAction('unban');
      }

      await showAlert({
        title: 'Успешно',
        message: 'Пользователь разблокирован',
        type: 'success'
      });
    } catch (err) {
      console.error('Ошибка разблокировки:', err);
      setError(err.response?.data?.error || 'Ошибка разблокировки');
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
    setIsOpen(false);
    setError(null);
  };

  /**
   * Открыть модальное окно для постоянной блокировки
   */
  const openPermanentBanModal = () => {
    setBanType('permanent');
    setShowBanModal(true);
    setIsOpen(false);
    setError(null);
  };

  /**
   * Закрыть модальное окно
   */
  const closeModal = () => {
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
      <div className={styles.moderationPanel}>
        <button 
          className={styles.dropdownToggle}
          onClick={() => setIsOpen(!isOpen)}
          disabled={loading}
          title="Модерация"
        >
          <Icon name="settings" size={18} />
        </button>
        
        {isOpen && (
          <div className={styles.dropdownMenu}>
            <button 
              className={`${styles.dropdownItem} ${styles.banPostsButton}`}
              onClick={openPostBanModal}
              disabled={loading}
            >
              <Icon name="block" size={16} /> Запретить посты
            </button>
            
            <button 
              className={`${styles.dropdownItem} ${styles.permanentBanButton}`}
              onClick={openPermanentBanModal}
              disabled={loading}
            >
              <Icon name="ban" size={16} /> Забанить навсегда
            </button>
            
            <button 
              className={`${styles.dropdownItem} ${styles.unbanButton}`}
              onClick={handleUnban}
              disabled={loading}
            >
              <Icon name="check" size={16} /> Разбанить
            </button>
          </div>
        )}

      {/* Модальное окно */}
      {showBanModal && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
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
                onClick={closeModal}
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
    </div>
    </>
  );
}

export default AdminModerationPanel;
