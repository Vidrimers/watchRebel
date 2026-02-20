import React from 'react';
import styles from './ConfirmDialog.module.css';

/**
 * Компонент диалога подтверждения
 * @param {Object} props
 * @param {boolean} props.isOpen - Открыт ли диалог
 * @param {string} props.title - Заголовок диалога
 * @param {string} props.message - Текст сообщения
 * @param {string} props.confirmText - Текст кнопки подтверждения (по умолчанию "Подтвердить")
 * @param {string} props.cancelText - Текст кнопки отмены (по умолчанию "Отмена")
 * @param {string} props.confirmButtonStyle - Стиль кнопки подтверждения: 'danger', 'primary', 'success'
 * @param {Function} props.onConfirm - Callback при подтверждении
 * @param {Function} props.onCancel - Callback при отмене
 */
const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  confirmButtonStyle = 'primary',
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  const handleConfirm = () => {
    onConfirm();
  };

  const handleCancel = () => {
    onCancel();
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.dialog}>
        {title && <h2 className={styles.title}>{title}</h2>}
        <p className={styles.message}>{message}</p>
        <div className={styles.buttons}>
          <button
            className={`${styles.button} ${styles.cancelButton}`}
            onClick={handleCancel}
          >
            {cancelText}
          </button>
          <button
            className={`${styles.button} ${styles.confirmButton} ${styles[confirmButtonStyle]}`}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
