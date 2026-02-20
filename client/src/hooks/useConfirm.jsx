import React from 'react';
import { useState, useCallback } from 'react';
import ConfirmDialog from '../components/Common/ConfirmDialog';

/**
 * Хук для отображения диалога подтверждения
 * @returns {Object} { confirmDialog, showConfirm }
 */
const useConfirm = () => {
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Подтвердить',
    cancelText: 'Отмена',
    confirmButtonStyle: 'primary',
    resolver: null
  });

  /**
   * Показать диалог подтверждения
   * @param {Object} options
   * @param {string} options.title - Заголовок диалога
   * @param {string} options.message - Текст сообщения
   * @param {string} options.confirmText - Текст кнопки подтверждения
   * @param {string} options.cancelText - Текст кнопки отмены
   * @param {string} options.confirmButtonStyle - Стиль кнопки: 'danger', 'primary', 'success'
   * @returns {Promise<boolean>} Promise, который резолвится в true при подтверждении, false при отмене
   */
  const showConfirm = useCallback((options) => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        title: options.title || '',
        message: options.message || '',
        confirmText: options.confirmText || 'Подтвердить',
        cancelText: options.cancelText || 'Отмена',
        confirmButtonStyle: options.confirmButtonStyle || 'primary',
        resolver: resolve
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (dialogState.resolver) {
      dialogState.resolver(true);
    }
    setDialogState(prev => ({ ...prev, isOpen: false }));
  }, [dialogState.resolver]);

  const handleCancel = useCallback(() => {
    if (dialogState.resolver) {
      dialogState.resolver(false);
    }
    setDialogState(prev => ({ ...prev, isOpen: false }));
  }, [dialogState.resolver]);

  const confirmDialog = (
    <ConfirmDialog
      isOpen={dialogState.isOpen}
      title={dialogState.title}
      message={dialogState.message}
      confirmText={dialogState.confirmText}
      cancelText={dialogState.cancelText}
      confirmButtonStyle={dialogState.confirmButtonStyle}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirmDialog, showConfirm };
};

export default useConfirm;
