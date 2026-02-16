import React from 'react';
import styles from './Footer.module.css';

/**
 * Футер приложения, прижатый к низу страницы
 */
const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        <p className={styles.copyright}>
          © {currentYear} watchRebel. Социальная сеть для любителей кино.
        </p>
        <div className={styles.links}>
          <a href="/about" className={styles.link}>
            О проекте
          </a>
          <span className={styles.separator}>•</span>
          <a href="/privacy" className={styles.link}>
            Конфиденциальность
          </a>
          <span className={styles.separator}>•</span>
          <a href="/terms" className={styles.link}>
            Условия использования
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
