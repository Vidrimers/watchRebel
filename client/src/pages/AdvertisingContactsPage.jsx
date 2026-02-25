import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Common/Icon';
import api from '../services/api';
import styles from './AdvertisingContactsPage.module.css';

/**
 * Страница с контактами для рекламодателей
 */
const AdvertisingContactsPage = () => {
  const navigate = useNavigate();
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

  // Функция для рендеринга строки с кликабельными ссылками
  const renderContactLine = (line, index) => {
    // Проверяем, содержит ли строка Email
    const emailMatch = line.match(/Email:\s*(.+)/i);
    if (emailMatch) {
      const email = emailMatch[1].trim();
      return (
        <p key={index}>
          <span className={styles.contactIcon}>
            <Icon name="email" size="small" />
          </span>
          Email: <a href={`mailto:${email}`} className={styles.contactLink}>{email}</a>
        </p>
      );
    }

    // Проверяем, содержит ли строка Telegram
    const telegramMatch = line.match(/Telegram:\s*(.+)/i);
    if (telegramMatch) {
      const telegram = telegramMatch[1].trim();
      const telegramUrl = telegram.startsWith('@') 
        ? `https://t.me/${telegram.substring(1)}` 
        : `https://t.me/${telegram}`;
      return (
        <p key={index}>
          <span className={styles.contactIcon}>
            <Icon name="telegram" size="small" />
          </span>
          Telegram: <a href={telegramUrl} className={styles.contactLink} target="_blank" rel="noopener noreferrer">{telegram}</a>
        </p>
      );
    }

    // Обычная строка
    return <p key={index}>{line || '\u00A0'}</p>;
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
        <button 
          onClick={() => navigate(-1)} 
          className={styles.backButton}
        >
          ← Назад
        </button>
        <h1 className={styles.title}>Контакты для рекламы</h1>
        <div className={styles.contactsText}>
          {contacts.split('\n').map((line, index) => renderContactLine(line, index))}
        </div>
      </div>
    </div>
  );
};

export default AdvertisingContactsPage;
