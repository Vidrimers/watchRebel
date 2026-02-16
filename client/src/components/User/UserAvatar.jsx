import React from 'react';
import styles from './UserAvatar.module.css';
import BanIndicator from './BanIndicator';

/**
 * Компонент аватара пользователя
 * Отображает изображение или placeholder с первой буквой имени
 * Может отображать индикатор блокировки поверх аватара
 */
const UserAvatar = ({ user, size = 'medium', className = '', showBanIndicator = false }) => {
  const sizeClass = styles[`avatar-${size}`];

  return (
    <div className={`${styles.avatarContainer} ${sizeClass} ${className}`}>
      {user?.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.displayName || 'Пользователь'}
          className={styles.avatarImage}
        />
      ) : (
        <div className={styles.avatarPlaceholder}>
          {user?.displayName?.charAt(0).toUpperCase() || '?'}
        </div>
      )}
      
      {/* Индикатор блокировки */}
      {showBanIndicator && <BanIndicator user={user} />}
    </div>
  );
};

export default UserAvatar;
