import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const [showWidget, setShowWidget] = useState(false);
  const widgetContainerRef = useRef(null);
  const scriptRef = useRef(null);

  const isTelegramLinked = Boolean(user?.telegramUsername);

  const handleTelegramAuth = useCallback(async (telegramUser) => {
    try {
      setLoading(true);
      await api.post('/auth/link-telegram', {
        telegramId: telegramUser.id,
        telegramUsername: telegramUser.username
      });

      await showAlert({
        title: 'Успешно',
        message: 'Telegram успешно привязан!',
        type: 'success'
      });

      window.location.reload();
    } catch (error) {
      console.error('Ошибка привязки Telegram:', error);
      await showAlert({
        title: 'Ошибка',
        message: error.response?.data?.error || 'Не удалось привязать Telegram.',
        type: 'error'
      });
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    if (!showWidget || isTelegramLinked) return;

    // Создаем callback функцию
    window.onTelegramLink = handleTelegramAuth;

    // Загружаем скрипт Telegram Widget
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'watchRebel_bot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-onauth', 'onTelegramLink(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;

    const container = widgetContainerRef.current;
    if (container) {
      container.appendChild(script);
      scriptRef.current = script;
    }

    return () => {
      if (container && scriptRef.current?.parentNode === container) {
        container.removeChild(scriptRef.current);
      }
      delete window.onTelegramLink;
    };
  }, [showWidget, isTelegramLinked, handleTelegramAuth]);

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

            {!showWidget ? (
              <button
                onClick={() => setShowWidget(true)}
                className={styles.linkButton}
                disabled={loading}
              >
                Привязать Telegram
              </button>
            ) : (
              <div className={styles.telegramWidgetContainer}>
                {loading && <p className={styles.description}>Привязка...</p>}
                <div ref={widgetContainerRef} />
                <button
                  onClick={() => setShowWidget(false)}
                  className={styles.cancelButton}
                  disabled={loading}
                >
                  Отмена
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default TelegramConnectionBlock;
