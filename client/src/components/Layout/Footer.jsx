import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './Footer.module.css';
import BugReportModal from '../BugReport/BugReportModal';
import Icon from '../Common/Icon';

/**
 * Футер приложения, прижатый к низу страницы
 */
const Footer = () => {
  const currentYear = new Date().getFullYear();
  const [isBugReportModalOpen, setIsBugReportModalOpen] = useState(false);

  return (
    <>
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <button
            className={styles.bugReportButton}
            onClick={() => setIsBugReportModalOpen(true)}
            aria-label="Сообщить о проблеме"
          >
            <Icon name="bug" size="small" /> Багрепорты и предложения
          </button>
          <p className={styles.copyright}>
            © {currentYear} watchRebel. Социальная сеть для любителей кино и сериалов.
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
            <span className={styles.separator}>•</span>
            <Link to="/advertising-contacts" className={styles.link}>
              Контакты для рекламы
            </Link>
          </div>
        </div>
      </footer>

      <BugReportModal
        isOpen={isBugReportModalOpen}
        onClose={() => setIsBugReportModalOpen(false)}
      />
    </>
  );
};

export default Footer;
