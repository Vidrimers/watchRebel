import React from 'react';
import { useState, useCallback } from 'react';
import AlertDialog from '../components/Common/AlertDialog';

/**
 * Хук для отображения диалога уведомления
 * @returns {Object} { alertDialog, showAlert }
 */
const useAlert = () => {
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    buttonText: 'ОК',
    resolver: null
  });

  /**
   * Показать диалог уведомления
   * @param {Object} options
   * @param {string} options.title - Заголовок диалога
   * @param {string} options.message - Текст сообщения
   * @param {string} options.type - Тип: 'info', 'success', 'error', 'warning'
   * @param {string} options.buttonText - Текст кнопки
   * @returns {Promise<void>} Promise, который резолвится при закрытии диалога
   */
  const showAlert = useCallback((options) => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        title: options.title || '',
        message: options.message || '',
        type: options.type || 'info',
        buttonText: options.buttonText || 'ОК',
        resolver: resolve
      });
    });
  }, []);

  const handleClose = useCallback(() => {
    if (dialogState.resolver) {
      dialogState.resolver();
    }
    setDialogState(prev => ({ ...prev, isOpen: false }));
  }, [dialogState.resolver]);

  const alertDialog = (
    <AlertDialog
      isOpen={dialogState.isOpen}
      title={dialogState.title}
      message={dialogState.message}
      type={dialogState.type}
      buttonText={dialogState.buttonText}
      onClose={handleClose}
    />
  );

  return { alertDialog, showAlert };
};

export default useAlert;
