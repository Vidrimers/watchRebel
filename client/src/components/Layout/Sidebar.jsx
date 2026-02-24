import React, { useState, useRef } from 'react';
import UserAvatar from '../User/UserAvatar';
import SearchBar from '../Search/SearchBar';
import { NotificationBadge, NotificationDropdown } from '../Notifications';
import styles from './Sidebar.module.css';

/**
 * Правый блок управления
 * Содержит: поиск, аватар, навигацию, настройки, уведомления
 */
const Sidebar = ({ user, narrow = false }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const notificationButtonRef = useRef(null);

  const toggleDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleUserInfoClick = (e) => {
    // Если клик был по кнопке настроек, уведомлений или dropdown, не переходим на профиль
    if (e.target.closest(`.${styles.notificationsContainer}`) || 
        e.target.closest(`.${styles.settingsContainer}`)) {
      return;
    }
    // Переход на профиль
    window.location.href = `/user/${user.id}`;
  };

  return (
    <aside className={`${styles.sidebar} ${narrow ? styles.narrow : ''}`}>
      {/* Поисковая строка - скрыта в узком режиме */}
      {!narrow && <SearchBar />}

      {/* Информация о пользователе */}
      {user && (
        <div className={styles.userInfoLink} onClick={handleUserInfoClick}>
          <div className={styles.userInfo}>
            {/* Настройки - в левом верхнем углу */}
            <div className={styles.settingsContainer}>
              <a 
                href="/settings" 
                className={styles.settingsButton}
                title="Настройки"
              >
                ⚙️
              </a>
            </div>

            {/* Уведомления - в правом верхнем углу */}
            <div className={styles.notificationsContainer}>
              <button 
                ref={notificationButtonRef}
                className={`${styles.notificationsButton} notificationsButton`}
                title="Уведомления"
                onClick={toggleDropdown}
              >
                🔔
                <NotificationBadge />
              </button>
              <NotificationDropdown 
                isOpen={isDropdownOpen} 
                onClose={() => setIsDropdownOpen(false)}
                buttonRef={notificationButtonRef}
              />
            </div>

            {/* Аватар */}
            <UserAvatar user={user} size={narrow ? "small" : "medium"} />

            {/* Имя пользователя - скрыто в узком режиме */}
            {!narrow && <h2 className={styles.userName}>{user.displayName}</h2>}
          </div>
        </div>
      )}

      {/* Навигация */}
      <nav className={styles.navigation}>
        <ul className={styles.navList}>
          <li className={styles.navItem}>
            <a href="/feed" className={styles.navLink} title="Лента">
              📰 {!narrow && 'Лента'}
            </a>
          </li>
          <li className={styles.navItem}>
            <a href="/friends" className={styles.navLink} title="Друзья">
              👥 {!narrow && 'Друзья'}
            </a>
          </li>
          <li className={styles.navItem}>
            <a href="/messages" className={styles.navLink} title="Сообщения">
              💬 {!narrow && 'Сообщения'}
            </a>
          </li>
          <li className={styles.navItem}>
            <a href="/my-catalog" className={styles.navLink} title="Каталог">
              📚 {!narrow && 'Каталог'}
            </a>
          </li>
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
            <a href="/watchlist" className={styles.navLink} title="Хочу посмотреть">
              ⭐ {!narrow && 'Хочу посмотреть'}
            </a>
          </li>
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
