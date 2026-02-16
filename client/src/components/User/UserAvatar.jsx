import React from 'react';
import styles from './UserAvatar.module.css';

/**
 * Компонент аватара пользователя
 * Отображает изображение или placeholder с первой буквой имени
 */
const UserAvatar = ({ user, size = 'medium', className = '' }) => {
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
    </div>
  );
};

export default UserAvatar;
