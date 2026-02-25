import React, { useState } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import Icon from '../Common/Icon';
import useConfirm from '../../hooks/useConfirm.jsx';
import useAlert from '../../hooks/useAlert.jsx';
import api from '../../services/api';
import styles from './TelegramConnectionBlock.module.css'; // Используем те же стили

/**
 * Компонент для управления привязкой Discord аккаунта
 * Показывает статус привязки и кнопки для привязки/отвязки
 */
const DiscordConnectionBlock = () => {
  const { user } = useAppSelector((state) => state.auth);
  const { confirmDialog, showConfirm } = useConfirm();
  const { alertDialog, showAlert } = useAlert();
  const [loading, setLoading] = useState(false);

  // Проверяем, привязан ли Discord (по наличию discord_id в user)
  const isDiscordLinked = Boolean(user?.discordId || user?.hasDiscordLinked);

  const handleUnlinkDiscord = async () => {
    const confirmed = await showConfirm({
      title: 'Отвязать Discord',
      message: 'Вы уверены, что хотите отвязать Discord аккаунт? Вы сможете привязать его снова позже.',
      confirmText: 'Отвязать',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });

    if (!confirmed) return;

    try {
      setLoading(true);
      await api.delete('/auth/unlink-discord');

      await showAlert({
        title: 'Успешно',
        message: 'Discord аккаунт успешно отвязан',
        type: 'success'
      });

      // Перезагружаем страницу чтобы обновить данные пользователя
      window.location.reload();
    } catch (error) {
      console.error('Ошибка отвязки Discord:', error);
      await showAlert({
        title: 'Ошибка',
        message: error.response?.data?.error || 'Не удалось отвязать Discord. Попробуйте позже.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLinkDiscord = () => {
    // Сохраняем текущий URL для возврата после OAuth
    sessionStorage.setItem('oauth_return_url', window.location.pathname);
    
    // Редирект на Discord OAuth с параметром link=true
    window.location.href = '/api/auth/discord?link=true';
  };

  return (
    <>
      {confirmDialog}
      {alertDialog}
      <div className={styles.settingsCard}>
        <h3 className={styles.cardTitle}><Icon name="discord" size="medium" /> Discord</h3>
        
        {isDiscordLinked ? (
          <div className={styles.linkedContainer}>
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Статус:</span>
              <span className={styles.statusLinked}>✅ Привязан</span>
            </div>
            
            {user.discordUsername && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Username:</span>
                <span className={styles.infoValue}>{user.discordUsername}</span>
              </div>
            )}

            <button 
              onClick={handleUnlinkDiscord} 
              className={styles.unlinkButton}
              disabled={loading}
            >
              {loading ? 'Отвязка...' : 'Отвязать Discord'}
            </button>
          </div>
        ) : (
          <div className={styles.notLinkedContainer}>
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Статус:</span>
              <span className={styles.statusNotLinked}>❌ Не привязан</span>
            </div>

            <p className={styles.description}>
              Привяжите Discord аккаунт для возможности входа через Discord.
            </p>

            <button 
              onClick={handleLinkDiscord} 
              className={styles.linkButton}
              disabled={loading}
            >
              {loading ? 'Привязка...' : 'Привязать Discord'}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default DiscordConnectionBlock;
