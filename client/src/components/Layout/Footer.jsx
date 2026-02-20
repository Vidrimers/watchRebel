import React from 'react';
import { Link } from 'react-router-dom';
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
          <Link to="/about" className={styles.link}>
            О проекте
          </Link>
          <span className={styles.separator}>•</span>
          <Link to="/privacy" className={styles.link}>
            Конфиденциальность
          </Link>
          <span className={styles.separator}>•</span>
          <Link to="/terms" className={styles.link}>
            Условия использования
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
