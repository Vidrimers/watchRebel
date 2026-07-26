import React, { useState, useCallback, useRef } from 'react';
import styles from './useToast.module.css';

const TOAST_DURATION = 4000; // 4 секунды

/**
 * Хук для отображения тост-уведомлений
 * @returns {Object} { toastContainer, showToast }
 */
const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);

  const showToast = useCallback((message, type = 'info') => {
    const id = ++counterRef.current;
    const newToast = { id, message, type };

    setToasts(prev => [...prev, newToast]);

    // Автоматическое удаление через TOAST_DURATION
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, TOAST_DURATION);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toastContainer = toasts.length > 0 ? (
    <div className={styles.container}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`${styles.toast} ${styles[toast.type]}`}
          onClick={() => removeToast(toast.id)}
        >
          <span className={styles.icon}>
            {toast.type === 'success' && '✓'}
            {toast.type === 'error' && '✕'}
            {toast.type === 'warning' && '⚠'}
            {toast.type === 'info' && 'ℹ'}
          </span>
          <span className={styles.message}>{toast.message}</span>
        </div>
      ))}
    </div>
  ) : null;

  return { toastContainer, showToast };
};

export default useToast;
