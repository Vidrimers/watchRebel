import React, { useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
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
  const location = useLocation();
  
  // Проверяем, находимся ли мы на странице поиска
  const isSearchPage = location.pathname === '/search';

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
    <aside className={`${styles.sidebar} ${narrow ? styles.narrow : ''} ${isSearchPage ? styles.compactSearch : ''}`}>
      {/* Поисковая строка - скрыта в узком режиме и на странице поиска */}
      {!narrow && !isSearchPage && <SearchBar />}

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
            <UserAvatar user={user} size={isSearchPage ? "tiny" : (narrow ? "small" : "medium")} />

            {/* Имя пользователя - скрыто в узком режиме и на странице поиска */}
            {!narrow && !isSearchPage && <h2 className={styles.userName}>{user.displayName}</h2>}
          </div>
        </div>
      )}

      {/* Навигация */}
      <nav className={styles.navigation}>
        <ul className={styles.navList}>
          <li className={styles.navItem}>
            <a href="/feed" className={styles.navLink} title="Лента">
              📰 {!narrow && !isSearchPage && 'Лента'}
            </a>
          </li>
          <li className={styles.navItem}>
            <a href="/friends" className={styles.navLink} title="Друзья">
              👥 {!narrow && !isSearchPage && 'Друзья'}
            </a>
          </li>
          <li className={styles.navItem}>
            <a href="/messages" className={styles.navLink} title="Сообщения">
              💬 {!narrow && !isSearchPage && 'Сообщения'}
            </a>
          </li>
          <li className={styles.navItem}>
            <a href="/my-catalog" className={styles.navLink} title="Каталог">
              📚 {!narrow && !isSearchPage && 'Каталог'}
            </a>
          </li>
          <li className={styles.navItem}>
            <a href="/lists?type=movie" className={styles.navLink} title="Мои фильмы">
              🎬 {!narrow && !isSearchPage && 'Мои фильмы'}
            </a>
          </li>
          <li className={styles.navItem}>
            <a href="/lists?type=tv" className={styles.navLink} title="Мои сериалы">
              📺 {!narrow && !isSearchPage && 'Мои сериалы'}
            </a>
          </li>
          <li className={styles.navItem}>
            <a href="/watchlist" className={styles.navLink} title="Хочу посмотреть">
              ⭐ {!narrow && !isSearchPage && 'Хочу посмотреть'}
            </a>
          </li>
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
