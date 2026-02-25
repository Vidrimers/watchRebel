import React, { useState, useEffect } from 'react';
import Icon from '../Common/Icon';
import styles from './StatusEditModal.module.css';

/**
 * Модальное окно для редактирования статуса пользователя
 */
const StatusEditModal = ({ isOpen, onClose, currentStatus, onSave, onDelete }) => {
  const [status, setStatus] = useState(currentStatus || '');
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setStatus(currentStatus || '');
    setError(null);
  }, [currentStatus, isOpen]);

  const handleSave = async () => {
    if (status.trim().length > 100) {
      setError('Статус не может быть длиннее 100 символов');
      return;
    }

    setIsSaving(true);
    setError(null);
    
    try {
      await onSave(status.trim());
      onClose();
    } catch (err) {
      setError(err.message || 'Ошибка сохранения статуса');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    setError(null);
    
    try {
      await onDelete();
      onClose();
    } catch (err) {
      setError(err.message || 'Ошибка удаления статуса');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Редактировать статус</h3>
          <button 
            className={styles.closeButton} 
            onClick={onClose}
            disabled={isSaving}
          >
            <Icon name="close" size="small" />
          </button>
        </div>

        <div className={styles.modalBody}>
          <textarea
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            onKeyDown={handleKeyDown}
            className={styles.statusInput}
            placeholder="Расскажите о себе..."
            maxLength={100}
            rows={3}
            autoFocus
            disabled={isSaving}
          />
          <div className={styles.statusCounter}>
            {status.length}/100
          </div>
          {error && (
            <div className={styles.errorMessage}>{error}</div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <div className={styles.leftButtons}>
            {currentStatus && (
              <button 
                onClick={handleDelete} 
                className={styles.deleteButton}
                disabled={isSaving}
              >
                <Icon name="delete" size="small" /> Удалить статус
              </button>
            )}
          </div>
          <div className={styles.rightButtons}>
            <button 
              onClick={onClose} 
              className={styles.cancelButton}
              disabled={isSaving}
            >
              Отмена
            </button>
            <button 
              onClick={handleSave} 
              className={styles.saveButton}
              disabled={isSaving}
            >
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusEditModal;
