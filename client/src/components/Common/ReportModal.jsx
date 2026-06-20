import React, { useState } from 'react';
import Icon from './Icon';
import useAlert from '../../hooks/useAlert.jsx';
import api from '../../services/api';
import styles from './ReportModal.module.css';

const ReportModal = ({ reportedUserId, reportedUserName, onClose }) => {
  const { alertDialog, showAlert } = useAlert();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (reason.trim().length < 10) {
      await showAlert({
        title: 'Ошибка',
        message: 'Причина жалобы должна содержать минимум 10 символов',
        type: 'error'
      });
      return;
    }

    try {
      setLoading(true);
      await api.post('/reports', {
        reportedUserId,
        reason: reason.trim()
      });

      await showAlert({
        title: 'Жалоба отправлена',
        message: 'Спасибо! Ваша жалоба рассмотрена администратором.',
        type: 'success'
      });
      onClose();
    } catch (error) {
      await showAlert({
        title: 'Ошибка',
        message: error.response?.data?.error || 'Не удалось отправить жалобу',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <>
      {alertDialog}
      <div className={styles.backdrop} onClick={handleBackdropClick}>
        <div className={styles.modal}>
          <div className={styles.header}>
            <h3 className={styles.title}>Жалоба на пользователя</h3>
            <button className={styles.closeBtn} onClick={onClose}>
              <Icon name="close" size={18} />
            </button>
          </div>

          <div className={styles.content}>
            <p className={styles.targetUser}>
              На кого жалуетесь: <strong>{reportedUserName}</strong>
            </p>
            <textarea
              className={styles.textarea}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Опишите причину жалобы (минимум 10 символов)..."
              rows={5}
              maxLength={1000}
              autoFocus
            />
            <span className={styles.charCount}>{reason.length}/1000</span>
          </div>

          <div className={styles.actions}>
            <button className={styles.cancelBtn} onClick={onClose} disabled={loading}>
              Отмена
            </button>
            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={loading || reason.trim().length < 10}
            >
              {loading ? 'Отправка...' : 'Отправить жалобу'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ReportModal;
