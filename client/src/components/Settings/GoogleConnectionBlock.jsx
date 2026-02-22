import React, { useState } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import useConfirm from '../../hooks/useConfirm.jsx';
import useAlert from '../../hooks/useAlert.jsx';
import api from '../../services/api';
import styles from './TelegramConnectionBlock.module.css'; // Используем те же стили

/**
 * Компонент для управления привязкой Google аккаунта
 * Показывает статус привязки и кнопки для привязки/отвязки
 */
const GoogleConnectionBlock = () => {
  const { user } = useAppSelector((state) => state.auth);
  const { confirmDialog, showConfirm } = useConfirm();
  const { alertDialog, showAlert } = useAlert();
  const [loading, setLoading] = useState(false);

  // Проверяем, привязан ли Google (по наличию google_id в user)
  const isGoogleLinked = Boolean(user?.googleId || user?.hasGoogleLinked);

  const handleUnlinkGoogle = async () => {
    const confirmed = await showConfirm({
      title: 'Отвязать Google',
      message: 'Вы уверены, что хотите отвязать Google аккаунт? Вы сможете привязать его снова позже.',
      confirmText: 'Отвязать',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });

    if (!confirmed) return;

    try {
      setLoading(true);
      await api.delete('/auth/unlink-google');

      await showAlert({
        title: 'Успешно',
        message: 'Google аккаунт успешно отвязан',
        type: 'success'
      });

      // Перезагружаем страницу чтобы обновить данные пользователя
      window.location.reload();
    } catch (error) {
      console.error('Ошибка отвязки Google:', error);
      await showAlert({
        title: 'Ошибка',
        message: error.response?.data?.error || 'Не удалось отвязать Google. Попробуйте позже.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLinkGoogle = () => {
    // Сохраняем текущий URL для возврата после OAuth
    sessionStorage.setItem('oauth_return_url', window.location.pathname);
    
    // Редирект на Google OAuth с параметром link=true
    window.location.href = '/api/auth/google?link=true';
  };

  return (
    <>
      {confirmDialog}
      {alertDialog}
      <div className={styles.settingsCard}>
        <h3 className={styles.cardTitle}>🔍 Google</h3>
        
        {isGoogleLinked ? (
          <div className={styles.linkedContainer}>
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Статус:</span>
              <span className={styles.statusLinked}>✅ Привязан</span>
            </div>
            
            {user.email && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Email:</span>
                <span className={styles.infoValue}>{user.email}</span>
              </div>
            )}

            <button 
              onClick={handleUnlinkGoogle} 
              className={styles.unlinkButton}
              disabled={loading}
            >
              {loading ? 'Отвязка...' : 'Отвязать Google'}
            </button>
          </div>
        ) : (
          <div className={styles.notLinkedContainer}>
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Статус:</span>
              <span className={styles.statusNotLinked}>❌ Не привязан</span>
            </div>

            <p className={styles.description}>
              Привяжите Google аккаунт для возможности входа через Google.
            </p>

            <button 
              onClick={handleLinkGoogle} 
              className={styles.linkButton}
              disabled={loading}
            >
              {loading ? 'Привязка...' : 'Привязать Google'}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default GoogleConnectionBlock;
