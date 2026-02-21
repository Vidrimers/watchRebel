import React, { useState, useEffect } from 'react';
import api from '../services/api';
import styles from './AdvertisingContactsPage.module.css';

/**
 * Страница с контактами для рекламодателей
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

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <h1 className={styles.title}>Контакты для рекламы</h1>
          <p className={styles.loading}>Загрузка...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <h1 className={styles.title}>Контакты для рекламы</h1>
          <p className={styles.error}>{error}</p>
          <div className={styles.fallback}>
            <h2>Свяжитесь с нами</h2>
            <p>Для размещения рекламы на платформе watchRebel, пожалуйста, свяжитесь с администрацией.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>Контакты для рекламы</h1>
        <div className={styles.contactsText}>
          {contacts.split('\n').map((line, index) => (
            <p key={index}>{line || '\u00A0'}</p>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdvertisingContactsPage;
