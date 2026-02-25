import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ReactionTooltip.module.css';

/**
 * Кастомный tooltip для отображения пользователей, поставивших реакцию
 * Показывает аватарки и имена, позволяет перейти на профиль
 */
const ReactionTooltip = ({ users, position, onMouseEnter, onMouseLeave }) => {
  const navigate = useNavigate();

  const handleUserClick = (userId, e) => {
    e.stopPropagation();
    navigate(`/user/${userId}`);
  };

  return (
    <div 
      className={styles.tooltip}
      style={{
        left: position?.x || 0,
        top: position?.y || 0
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className={styles.tooltipContent}>
        {users.map((user) => (
          <div
            key={user.id}
            className={styles.userItem}
            onClick={(e) => handleUserClick(user.id, e)}
          >
            <div className={styles.avatar}>
              {user.avatarUrl ? (
                <img 
                  src={user.avatarUrl.startsWith('http') 
                    ? user.avatarUrl 
                    : `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${user.avatarUrl}`
                  }
                  alt={user.name}
                  onError={(e) => {
                    // При ошибке показываем placeholder
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = `<div class="${styles.avatarPlaceholder}">${user.name.charAt(0).toUpperCase()}</div>`;
                  }}
                />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <span className={styles.userName}>{user.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReactionTooltip;
