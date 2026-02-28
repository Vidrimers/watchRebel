import React, { useState, useEffect } from 'react';
import BurgerButton from './BurgerButton';
import Sidebar from './Sidebar';
import Footer from './Footer';
import styles from './UserPageLayout.module.css';

/**
 * Основной layout для страницы пользователя
 * Содержит левый блок (Wall) и правый блок (Sidebar)
 */
const UserPageLayout = ({ children, user, narrowSidebar = false }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Блокировка скролла body при открытом сайдбаре на мобильных
  useEffect(() => {
    if (isSidebarOpen && window.innerWidth < 768) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    // Cleanup при размонтировании
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen]);

  // Закрытие сайдбара при изменении размера окна
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className={styles.pageContainer}>
      {/* Кнопка бургер-меню - видна только на мобильных */}
      <BurgerButton isOpen={isSidebarOpen} onClick={toggleSidebar} />

      <div className={styles.contentWrapper}>
        {/* Левый блок - Wall (max-width: 700px) */}
        <main className={styles.mainContent}>
          {children}
        </main>

        {/* Правый блок - Sidebar (max-width: 500px или 150px для узкого режима) */}
        <Sidebar 
          user={user} 
          narrow={narrowSidebar} 
          isOpen={isSidebarOpen}
          onClose={closeSidebar}
        />
      </div>

      {/* Footer прижат к низу */}
      <Footer />
    </div>
  );
};

export default UserPageLayout;
