import React from 'react';
import styles from './Sidebar.module.css';

/**
 * Правый блок управления
 * Содержит: поиск, аватар, навигацию, настройки, уведомления
 */
const Sidebar = ({ user }) => {
  return (
    <aside className={styles.sidebar}>
      {/* Поисковая строка */}
      <div className={styles.searchContainer}>
        <input
          type="text"
          placeholder="Поиск фильмов, сериалов, пользователей..."
          className={styles.searchInput}
        />
      </div>

      {/* Информация о пользователе */}
      {user && (
        <div className={styles.userInfo}>
          {/* Аватар */}
          <div className={styles.avatarContainer}>
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className={styles.avatar}
              />
            ) : (
              <div className={styles.avatarPlaceholder}>
                {user.displayName?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Имя пользователя */}
          <h2 className={styles.userName}>{user.displayName}</h2>
        </div>
      )}

      {/* Навигация */}
      <nav className={styles.navigation}>
        <ul className={styles.navList}>
          <li className={styles.navItem}>
            <a href="/lists/movies" className={styles.navLink}>
              🎬 Мои фильмы
            </a>
          </li>
          <li className={styles.navItem}>
            <a href="/lists/tv" className={styles.navLink}>
              📺 Мои сериалы
            </a>
          </li>
          <li className={styles.navItem}>
            <a href="/watchlist" className={styles.navLink}>
              ⭐ Список желаемого
            </a>
          </li>
          <li className={styles.navItem}>
            <a href="/friends" className={styles.navLink}>
              👥 Друзья
            </a>
          </li>
        </ul>
      </nav>

      {/* Уведомления */}
      <div className={styles.notificationsContainer}>
        <a href="/notifications" className={styles.notificationsLink}>
          🔔 Уведомления
          <span className={styles.notificationBadge}>0</span>
        </a>
      </div>

      {/* Настройки */}
      <div className={styles.settingsContainer}>
        <a href="/settings" className={styles.settingsLink}>
          ⚙️ Настройки
        </a>
      </div>
    </aside>
  );
};

export default Sidebar;
