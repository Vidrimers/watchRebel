import React from 'react';
import UserAvatar from '../User/UserAvatar';
import SearchBar from '../Search/SearchBar';
import { NotificationBadge } from '../Notifications';
import styles from './Sidebar.module.css';

/**
 * Правый блок управления
 * Содержит: поиск, аватар, навигацию, настройки, уведомления
 */
const Sidebar = ({ user, narrow = false }) => {
  return (
    <aside className={`${styles.sidebar} ${narrow ? styles.narrow : ''}`}>
      {/* Поисковая строка - скрыта в узком режиме */}
      {!narrow && <SearchBar />}

      {/* Информация о пользователе */}
      {user && (
        <div className={styles.userInfo}>
          {/* Аватар */}
          <UserAvatar user={user} size={narrow ? "small" : "medium"} />

          {/* Имя пользователя - скрыто в узком режиме */}
          {!narrow && <h2 className={styles.userName}>{user.displayName}</h2>}
        </div>
      )}

      {/* Навигация */}
      <nav className={styles.navigation}>
        <ul className={styles.navList}>
          <li className={styles.navItem}>
            <a href="/lists?type=movie" className={styles.navLink} title="Мои фильмы">
              🎬 {!narrow && 'Мои фильмы'}
            </a>
          </li>
          <li className={styles.navItem}>
            <a href="/lists?type=tv" className={styles.navLink} title="Мои сериалы">
              📺 {!narrow && 'Мои сериалы'}
            </a>
          </li>
          <li className={styles.navItem}>
            <a href="/watchlist" className={styles.navLink} title="Список желаемого">
              ⭐ {!narrow && 'Список желаемого'}
            </a>
          </li>
          <li className={styles.navItem}>
            <a href="/friends" className={styles.navLink} title="Друзья">
              👥 {!narrow && 'Друзья'}
            </a>
          </li>
        </ul>
      </nav>

      {/* Уведомления */}
      <div className={styles.notificationsContainer}>
        <a href="/notifications" className={styles.notificationsLink} title="Уведомления">
          🔔 {!narrow && 'Уведомления'}
          <NotificationBadge />
        </a>
      </div>

      {/* Настройки */}
      <div className={styles.settingsContainer}>
        <a href="/settings" className={styles.settingsLink} title="Настройки">
          ⚙️ {!narrow && 'Настройки'}
        </a>
      </div>
    </aside>
  );
};

export default Sidebar;
