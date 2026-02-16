import React from 'react';
import Sidebar from './Sidebar';
import Footer from './Footer';
import styles from './UserPageLayout.module.css';

/**
 * Основной layout для страницы пользователя
 * Содержит левый блок (Wall) и правый блок (Sidebar)
 */
const UserPageLayout = ({ children, user }) => {
  return (
    <div className={styles.pageContainer}>
      <div className={styles.contentWrapper}>
        {/* Левый блок - Wall (max-width: 1300px) */}
        <main className={styles.mainContent}>
          {children}
        </main>

        {/* Правый блок - Sidebar (max-width: 500px) */}
        <Sidebar user={user} />
      </div>

      {/* Footer прижат к низу */}
      <Footer />
    </div>
  );
};

export default UserPageLayout;
