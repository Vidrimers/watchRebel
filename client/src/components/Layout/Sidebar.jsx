import React, { useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { updateProfile } from '../../store/slices/authSlice';
import { fetchWall } from '../../store/slices/wallSlice';
import UserAvatar from '../User/UserAvatar';
import SearchBar from '../Search/SearchBar';
import StatusEditModal from '../User/StatusEditModal';
import { NotificationBadge, NotificationDropdown } from '../Notifications';
import Icon from '../Common/Icon';
import styles from './Sidebar.module.css';

/**
 * Правый блок управления
 * Содержит: поиск, аватар, навигацию, настройки, уведомления
 */
const Sidebar = ({ narrow = false, isOpen = true, onClose }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isHoveringUserInfo, setIsHoveringUserInfo] = useState(false);
  const notificationButtonRef = useRef(null);
  const location = useLocation();
  const dispatch = useAppDispatch();
  
  // Читаем user напрямую из Redux store
  const user = useAppSelector((state) => state.auth.user);
  
  // Проверяем, находимся ли мы на странице поиска
  const isSearchPage = location.pathname === '/search';

  // Закрытие сайдбара при клике на ссылку (для мобильных)
  const handleLinkClick = () => {
    if (onClose && window.innerWidth < 768) {
      onClose();
    }
  };

  const toggleDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleUserInfoClick = (e) => {
    // Если клик был по кнопке настроек, уведомлений или dropdown, не переходим на профиль
    if (e.target.closest(`.${styles.notificationsContainer}`) || 
        e.target.closest(`.${styles.settingsContainer}`) ||
        e.target.closest(`.${styles.statusSection}`)) {
      return;
    }
    // Переход на профиль
    window.location.href = `/user/${user.id}`;
    // Закрываем сайдбар на мобильных
    handleLinkClick();
  };

  const handleStatusClick = (e) => {
    e.stopPropagation();
    setIsStatusModalOpen(true);
  };

  const handleSaveStatus = async (newStatus) => {
    await dispatch(updateProfile({ 
      userId: user.id, 
      userStatus: newStatus 
    })).unwrap();
    // Перезагружаем ленту, чтобы показать новый пост со статусом
    dispatch(fetchWall(user.id));
  };

  const handleDeleteStatus = async () => {
    await dispatch(updateProfile({ 
      userId: user.id, 
      userStatus: '' 
    })).unwrap();
  };

  return (
    <>
      {/* Overlay для мобильных устройств */}
      {isOpen && (
        <div 
          className={styles.overlay} 
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`${styles.sidebar} ${narrow ? styles.narrow : ''} ${isSearchPage ? styles.compactSearch : ''} ${isOpen ? styles.open : ''}`}>
        {/* Поисковая строка - скрыта в узком режиме и на странице поиска */}
        {!narrow && !isSearchPage && <SearchBar />}

      {/* Информация о пользователе */}
      {user && (
        <>
          <div 
            className={styles.userInfoLink} 
            onClick={handleUserInfoClick}
            onMouseEnter={() => setIsHoveringUserInfo(true)}
            onMouseLeave={() => setIsHoveringUserInfo(false)}
          >
            <div className={styles.userInfo}>
              {/* Настройки - в левом верхнем углу */}
              <div className={styles.settingsContainer}>
                <a 
                  href="/settings" 
                  className={styles.settingsButton}
                  title="Настройки"
                  onClick={handleLinkClick}
                >
                  <Icon name="settings" size="medium" />
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
                  <Icon name="notifications" size="medium" />
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
              {!narrow && !isSearchPage && (
                <>
                  <h2 className={styles.userName}>{user.displayName}</h2>
                  
                  {/* Статус пользователя */}
                  <div 
                    className={`${styles.statusSection} ${!user.userStatus && !isHoveringUserInfo ? styles.hidden : ''}`}
                    onClick={handleStatusClick}
                  >
                    {user.userStatus ? (
                      <p className={styles.userStatus}>{user.userStatus}</p>
                    ) : (
                      <p className={`${styles.setStatusHint} ${isHoveringUserInfo ? styles.visible : ''}`}>
                        Задать статус ✏️
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Модалка редактирования статуса */}
          <StatusEditModal
            isOpen={isStatusModalOpen}
            onClose={() => setIsStatusModalOpen(false)}
            currentStatus={user.userStatus}
            onSave={handleSaveStatus}
            onDelete={handleDeleteStatus}
          />
        </>
      )}

      {/* Навигация */}
      <nav className={styles.navigation}>
        <ul className={styles.navList}>
          <li className={styles.navItem}>
            <a href="/feed" className={styles.navLink} title="Лента" onClick={handleLinkClick}>
              <Icon name="feed" size="medium" /> {!narrow && !isSearchPage && 'Лента'}
            </a>
          </li>
          <li className={styles.navItem}>
            <a href="/friends" className={styles.navLink} title="Друзья" onClick={handleLinkClick}>
              <Icon name="friends" size="medium" /> {!narrow && !isSearchPage && 'Друзья'}
            </a>
          </li>
          <li className={styles.navItem}>
            <a href="/messages" className={styles.navLink} title="Сообщения" onClick={handleLinkClick}>
              <Icon name="messages" size="medium" /> {!narrow && !isSearchPage && 'Сообщения'}
            </a>
          </li>
          <li className={styles.navItem}>
            <a href="/my-catalog" className={styles.navLink} title="Каталог" onClick={handleLinkClick}>
              <Icon name="catalog" size="medium" /> {!narrow && !isSearchPage && 'Каталог'}
            </a>
          </li>
          <li className={styles.navItem}>
            <a href="/lists?type=movie" className={styles.navLink} title="Мои фильмы" onClick={handleLinkClick}>
              <Icon name="movies" size="medium" /> {!narrow && !isSearchPage && 'Мои фильмы'}
            </a>
          </li>
          <li className={styles.navItem}>
            <a href="/lists?type=tv" className={styles.navLink} title="Мои сериалы" onClick={handleLinkClick}>
              <Icon name="tv" size="medium" /> {!narrow && !isSearchPage && 'Мои сериалы'}
            </a>
          </li>
          <li className={styles.navItem}>
            <a href="/watchlist" className={styles.navLink} title="Хочу посмотреть" onClick={handleLinkClick}>
              <Icon name="watchlist" size="medium" /> {!narrow && !isSearchPage && 'Хочу посмотреть'}
            </a>
          </li>
        </ul>
      </nav>
    </aside>
    </>
  );
};

export default Sidebar;
