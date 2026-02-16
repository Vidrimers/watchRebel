import React from 'react';
import styles from './ErrorMessage.module.css';

/**
 * ErrorMessage - компонент для отображения ошибок
 * Используется для показа ошибок API, валидации и других ошибок приложения
 */
const ErrorMessage = ({ 
  error, 
  onClose, 
  type = 'error',
  title,
  showDetails = false 
}) => {
  if (!error) return null;

  // Определяем сообщение об ошибке
  const getErrorMessage = () => {
    if (typeof error === 'string') {
      return error;
    }
    if (error.message) {
      return error.message;
    }
    if (error.error) {
      return error.error;
    }
    return 'Произошла неизвестная ошибка';
  };

  // Определяем заголовок
  const getTitle = () => {
    if (title) return title;
    
    switch (type) {
      case 'error':
        return 'Ошибка';
      case 'warning':
        return 'Предупреждение';
      case 'info':
        return 'Информация';
      default:
        return 'Ошибка';
    }
  };

  // Определяем иконку
  const getIcon = () => {
    switch (type) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '❌';
    }
  };

  const errorMessage = getErrorMessage();
  const errorTitle = getTitle();
  const icon = getIcon();

  return (
    <div className={`${styles.errorMessage} ${styles[type]}`} role="alert">
      <div className={styles.errorHeader}>
        <span className={styles.errorIcon}>{icon}</span>
        <h3 className={styles.errorTitle}>{errorTitle}</h3>
        {onClose && (
          <button 
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Закрыть"
          >
            ×
          </button>
        )}
      </div>
      
      <p className={styles.errorText}>{errorMessage}</p>

      {showDetails && error.details && (
        <details className={styles.errorDetails}>
          <summary>Подробности</summary>
          <pre className={styles.errorDetailsContent}>
            {typeof error.details === 'string' 
              ? error.details 
              : JSON.stringify(error.details, null, 2)
            }
          </pre>
        </details>
      )}
    </div>
  );
};

/**
 * ErrorMessageInline - компактная версия для inline отображения
 */
export const ErrorMessageInline = ({ error, onClose }) => {
  if (!error) return null;

  const errorMessage = typeof error === 'string' 
    ? error 
    : error.message || error.error || 'Произошла ошибка';

  return (
    <div className={styles.errorInline} role="alert">
      <span className={styles.errorInlineIcon}>⚠️</span>
      <span className={styles.errorInlineText}>{errorMessage}</span>
      {onClose && (
        <button 
          onClick={onClose}
          className={styles.errorInlineClose}
          aria-label="Закрыть"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;
