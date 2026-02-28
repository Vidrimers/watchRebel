import React from 'react';
import styles from './BurgerButton.module.css';

/**
 * Кнопка бургер-меню для мобильных устройств
 * Анимация превращения в крестик при открытии
 */
const BurgerButton = ({ isOpen, onClick }) => {
  return (
    <button 
      className={`${styles.burgerButton} ${isOpen ? styles.open : ''}`}
      onClick={onClick}
      aria-label={isOpen ? 'Закрыть меню' : 'Открыть меню'}
      aria-expanded={isOpen}
    >
      <span className={styles.line}></span>
      <span className={styles.line}></span>
      <span className={styles.line}></span>
    </button>
  );
};

export default BurgerButton;
