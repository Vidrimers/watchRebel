import React, { useState } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import Icon from '../Common/Icon';
import useConfirm from '../../hooks/useConfirm.jsx';
import useAlert from '../../hooks/useAlert.jsx';
import api from '../../services/api';
import styles from './TelegramConnectionBlock.module.css';

/**
 * Компонент для управления привязкой Telegram аккаунта
 * Показывает статус привязки и кнопки для привязки/отвязки
 */
const TelegramConnectionBlock = () => {
  const { user } = useAppSelector((state) => state.auth);
  const { confirmDialog, showConfirm } = useConfirm();
  const { alertDialog, showAlert } = useAlert();
  const [loading, setLoading] = useState(false);

  const isTelegramLinked = Boolean(user?.telegramUsername);

  const handleUnlinkTelegram = async () => {
    const confirmed = await showConfirm({
      title: 'Отвязать Telegram',
      message: 'Вы уверены, что хотите отвязать Telegram аккаунт? Вы сможете привязать его снова позже.',
      confirmText: 'Отвязать',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });

    if (!confirmed) return;

    try {
      setLoading(true);
      await api.delete('/auth/unlink-telegram');

      await showAlert({
        title: 'Успешно',
        message: 'Telegram аккаунт успешно отвязан',
        type: 'success'
      });

      // Перезагружаем страницу чтобы обновить данные пользователя
      window.location.reload();
    } catch (error) {
      console.error('Ошибка отвязки Telegram:', error);
      await showAlert({
        title: 'Ошибка',
        message: error.response?.data?.error || 'Не удалось отвязать Telegram. Попробуйте позже.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLinkTelegram = async () => {
    await showAlert({
      title: 'Привязка Telegram',
      message: 'Функция привязки Telegram будет доступна в следующей версии. Пока что Telegram привязывается автоматически при первом входе через бота.',
      type: 'info'
    });
  };

  return (
    <>
      {confirmDialog}
      {alertDialog}
      <div className={styles.settingsCard}>
        <h3 className={styles.cardTitle}><Icon name="telegram" size="medium" /> Telegram</h3>
        
        {isTelegramLinked ? (
          <div className={styles.linkedContainer}>
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Статус:</span>
              <span className={styles.statusLinked}>✅ Привязан</span>
            </div>
            
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Username:</span>
              <span className={styles.infoValue}>@{user.telegramUsername}</span>
            </div>

            <button 
              onClick={handleUnlinkTelegram} 
              className={styles.unlinkButton}
              disabled={loading}
            >
              {loading ? 'Отвязка...' : 'Отвязать Telegram'}
            </button>
          </div>
        ) : (
          <div className={styles.notLinkedContainer}>
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Статус:</span>
              <span className={styles.statusNotLinked}>❌ Не привязан</span>
            </div>

            <p className={styles.description}>
              Привяжите Telegram для получения уведомлений и быстрого доступа к сайту через бота.
            </p>

            <button 
              onClick={handleLinkTelegram} 
              className={styles.linkButton}
              disabled={loading}
            >
              {loading ? 'Привязка...' : 'Привязать Telegram'}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default TelegramConnectionBlock;
