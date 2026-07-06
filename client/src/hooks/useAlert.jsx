import React from 'react';
import { useState, useCallback } from 'react';
import AlertDialog from '../components/Common/AlertDialog';

/**
 * Хук для отображения диалога уведомления
 * @returns {Object} { alertDialog, showAlert, showConfirm }
 */
const useAlert = () => {
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    buttonText: 'ОК',
    cancelText: null,
    resolver: null
  });

  /**
   * Показать диалог уведомления (только ОК)
   */
  const showAlert = useCallback((options) => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        title: options.title || '',
        message: options.message || '',
        type: options.type || 'info',
        buttonText: options.buttonText || 'ОК',
        cancelText: null,
        resolver: resolve
      });
    });
  }, []);

  /**
   * Показать диалог подтверждения (Отмена + ОК)
   * @returns {Promise<boolean>} true если подтверждено, false если отменено
   */
  const showConfirm = useCallback((options) => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        title: options.title || '',
        message: options.message || '',
        type: options.type || 'warning',
        buttonText: options.confirmText || 'Да',
        cancelText: options.cancelText || 'Отмена',
        resolver: (result) => resolve(result)
      });
    });
  }, []);

  const handleClose = useCallback(() => {
    if (dialogState.resolver) {
      dialogState.resolver(dialogState.cancelText ? false : undefined);
    }
    setDialogState(prev => ({ ...prev, isOpen: false }));
  }, [dialogState.resolver, dialogState.cancelText]);

  const handleConfirm = useCallback(() => {
    if (dialogState.resolver) {
      dialogState.resolver(dialogState.cancelText ? true : undefined);
    }
    setDialogState(prev => ({ ...prev, isOpen: false }));
  }, [dialogState.resolver, dialogState.cancelText]);

  const alertDialog = (
    <AlertDialog
      isOpen={dialogState.isOpen}
      title={dialogState.title}
      message={dialogState.message}
      type={dialogState.type}
      buttonText={dialogState.buttonText}
      cancelText={dialogState.cancelText}
      onClose={handleClose}
      onConfirm={dialogState.cancelText ? handleConfirm : null}
    />
  );

  return { alertDialog, showAlert, showConfirm };
};

export default useAlert;
