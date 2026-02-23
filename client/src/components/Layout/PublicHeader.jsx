import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './PublicHeader.module.css';

/**
 * Публичный header для незарегистрированных пользователей
 * Отображает логотип и кнопки "Войти" и "Регистрация"
 */
const PublicHeader = () => {
  const navigate = useNavigate();

  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <div className={styles.logo} onClick={() => navigate('/catalog')}>
          <img src="/images/logo5.png" alt="watchRebel" className={styles.logoImage} />
        </div>
        <div className={styles.headerActions}>
          <button 
            className={styles.loginButton}
            onClick={() => navigate('/login')}
          >
            Войти
          </button>
          <button 
            className={styles.registerButton}
            onClick={() => navigate('/register')}
          >
            Регистрация
          </button>
        </div>
      </div>
    </header>
  );
};

export default PublicHeader;
