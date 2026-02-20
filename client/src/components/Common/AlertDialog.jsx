import React from 'react';
import styles from './AlertDialog.module.css';

/**
 * Компонент диалога уведомления
 * @param {Object} props
 * @param {boolean} props.isOpen - Открыт ли диалог
 * @param {string} props.title - Заголовок диалога
 * @param {string} props.message - Текст сообщения
 * @param {string} props.type - Тип уведомления: 'info', 'success', 'error', 'warning'
 * @param {string} props.buttonText - Текст кнопки (по умолчанию "ОК")
 * @param {Function} props.onClose - Callback при закрытии
 */
const AlertDialog = ({
  isOpen,
  title,
  message,
  type = 'info',
  buttonText = 'ОК',
  onClose
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleClose = () => {
    onClose();
  };

  // Иконки для разных типов
  const icons = {
    info: (
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10" strokeWidth="2"/>
        <line x1="12" y1="16" x2="12" y2="12" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="12" cy="8" r="1" fill="currentColor"/>
      </svg>
    ),
    success: (
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10" strokeWidth="2"/>
        <path d="M9 12l2 2 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    error: (
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10" strokeWidth="2"/>
        <line x1="15" y1="9" x2="9" y2="15" strokeWidth="2" strokeLinecap="round"/>
        <line x1="9" y1="9" x2="15" y2="15" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    warning: (
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 2L2 20h20L12 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="12" y1="9" x2="12" y2="13" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="12" cy="17" r="1" fill="currentColor"/>
      </svg>
    )
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={`${styles.dialog} ${styles[type]}`}>
        <div className={styles.iconContainer}>
          {icons[type]}
        </div>
        {title && <h2 className={styles.title}>{title}</h2>}
        <p className={styles.message}>{message}</p>
        <button
          className={`${styles.button} ${styles[`${type}Button`]}`}
          onClick={handleClose}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
};

export default AlertDialog;
