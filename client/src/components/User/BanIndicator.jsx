import React from 'react';
import Icon from '../Common/Icon';
import styles from './BanIndicator.module.css';

/**
 * Компонент индикатора блокировки пользователя
 * Отображает красную табличку поверх аватарки с информацией о блокировке
 */
function BanIndicator({ user }) {
  // Если пользователь не заблокирован, не показываем индикатор
  if (!user) {
    return null;
  }

  const isPermanentBan = user.isBlocked;
  const isPostBan = user.postBanUntil && new Date(user.postBanUntil) > new Date();

  // Если нет активных блокировок, не показываем индикатор
  if (!isPermanentBan && !isPostBan) {
    return null;
  }

  /**
   * Форматирование даты окончания блокировки
   */
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date - now;

    // Если меньше часа
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `через ${minutes} мин`;
    }

    // Если меньше суток
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `через ${hours} ч`;
    }

    // Если меньше недели
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `через ${days} дн`;
    }

    // Полная дата
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={styles.banIndicator}>
      <div className={`${styles.badge} ${isPermanentBan ? styles.permanentBan : styles.postBan}`}>
        {isPermanentBan ? (
          <>
            <Icon name="ban" size="small" /> ЗАБАНЕН
          </>
        ) : (
          <>
            <Icon name="block" size="small" /> ПОСТЫ ЗАПРЕЩЕНЫ
          </>
        )}
      </div>
      
      {user.banReason && (
        <div className={styles.details}>
          <div className={styles.reason}>
            <strong>Причина:</strong> {user.banReason}
          </div>
          
          {isPostBan && !isPermanentBan && user.postBanUntil && (
            <div className={styles.expires}>
              <strong>До:</strong> {formatDate(user.postBanUntil)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BanIndicator;
