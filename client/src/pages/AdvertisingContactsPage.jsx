import React, { useState, useEffect } from 'react';
import Icon from '../components/Common/Icon';
import api from '../services/api';
import styles from './AdvertisingContactsPage.module.css';

/**
 * Страница-визитка с контактами для рекламодателей
 */
const AdvertisingContactsPage = () => {
  const [contacts, setContacts] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/settings/advertising_contacts');
      setContacts(response.data.value || '');
      setError(null);
    } catch (err) {
      console.error('Ошибка загрузки контактов:', err);
      setError('Не удалось загрузить контактную информацию');
    } finally {
      setLoading(false);
    }
  };

  const renderContactLine = (line, index) => {
    if (!line.trim()) return null;
    const emailMatch = line.match(/Email:\s*(.+)/i);
    if (emailMatch) {
      const email = emailMatch[1].trim();
      return (
        <p key={index} className={styles.contactLine}>
          <span className={styles.contactIcon}><Icon name="email" size="small" /></span>
          Email: <a href={`mailto:${email}`} className={styles.contactLink}>{email}</a>
        </p>
      );
    }
    const telegramMatch = line.match(/Telegram:\s*(.+)/i);
    if (telegramMatch) {
      const telegram = telegramMatch[1].trim();
      const url = telegram.startsWith('@') ? `https://t.me/${telegram.substring(1)}` : `https://t.me/${telegram}`;
      return (
        <p key={index} className={styles.contactLine}>
          <span className={styles.contactIcon}><Icon name="telegram" size="small" /></span>
          Telegram: <a href={url} target="_blank" rel="noopener noreferrer" className={styles.contactLink}>{telegram}</a>
        </p>
      );
    }
    return <p key={index} className={styles.contactLine}>{line}</p>;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <p className={styles.loading}>Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <a href="https://watchrebel.ru" target="_blank" rel="noopener noreferrer" className={styles.logoLink}>
          <img src="/logo.svg" alt="watchRebel" className={styles.logo} />
        </a>
        <h1 className={styles.title}>Контакты для рекламы</h1>
        {error ? (
          <p className={styles.error}>{error}</p>
        ) : (
          <div className={styles.contacts}>
            {contacts.split('\n').map((line, index) => renderContactLine(line, index))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvertisingContactsPage;
