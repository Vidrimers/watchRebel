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

  // Функция для получения правильного URL аватарки
  const getAvatarUrl = () => {
    if (!user?.avatarUrl) return null;
    
    // Если аватарка загружена на сервер (начинается с /uploads/)
    if (user.avatarUrl.startsWith('/uploads/')) {
      return `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${user.avatarUrl}`;
    }
    
    // Если аватарка из Telegram или другой внешний URL
    return user.avatarUrl;
  };

  const avatarUrl = getAvatarUrl();

  return (
    <div className={`${styles.avatarContainer} ${sizeClass} ${className}`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
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
