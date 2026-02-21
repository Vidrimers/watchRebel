import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import useAlert from '../../hooks/useAlert.jsx';
import useConfirm from '../../hooks/useConfirm.jsx';
import styles from './AdminPanel.module.css';

/**
 * Админ-панель для управления пользователями и системой
 * Доступна только для администратора (TELEGRAM_ADMIN_ID=137981675)
 */
const AdminPanel = () => {
  const navigate = useNavigate();
  const { alertDialog, showAlert } = useAlert();
  const { confirmDialog, showConfirm } = useConfirm();
  
  const [announcement, setAnnouncement] = useState('');
  
  // Состояние для контактов
  const [contactsLoading, setContactsLoading] = useState(true);
  const [isEditingContacts, setIsEditingContacts] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [contactTelegram, setContactTelegram] = useState('');
  const [contactText, setContactText] = useState('');
  const [contactsSaving, setContactsSaving] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setContactsLoading(true);
      const response = await api.get('/settings/advertising_contacts');
      const value = response.data.value || '';
      
      // Парсим контакты
      const lines = value.split('\n');
      let email = 'admin@watchrebel.com';
      let telegram = '@watchrebel_admin';
      let text = '';
      
      lines.forEach(line => {
        const emailMatch = line.match(/Email:\s*(.+)/i);
        const telegramMatch = line.match(/Telegram:\s*(.+)/i);
        
        if (emailMatch) {
          email = emailMatch[1].trim();
        } else if (telegramMatch) {
          telegram = telegramMatch[1].trim();
        } else if (line.trim() && !line.includes('Email:') && !line.includes('Telegram:')) {
          text += (text ? '\n' : '') + line;
        }
      });
      
      setContactEmail(email);
      setContactTelegram(telegram);
      setContactText(text);
    } catch (err) {
      console.error('Ошибка загрузки контактов:', err);
      setContactEmail('admin@watchrebel.com');
      setContactTelegram('@watchrebel_admin');
      setContactText('Для размещения рекламы свяжитесь с нами:');
    } finally {
      setContactsLoading(false);
    }
  };

  const handleSaveContacts = async () => {
    try {
      setContactsSaving(true);
      
      // Формируем текст контактов
      const contactsValue = `${contactText}\n\nEmail: ${contactEmail}\nTelegram: ${contactTelegram}`;
      
      await api.put('/settings/advertising_contacts', { value: contactsValue });
      
      setIsEditingContacts(false);
      await showAlert({
        title: 'Успешно',
        message: 'Контакты для рекламы обновлены',
        type: 'success'
      });
    } catch (err) {
      console.error('Ошибка сохранения контактов:', err);
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось сохранить контакты',
        type: 'error'
      });
    } finally {
      setContactsSaving(false);
    }
  };

  const handleCancelEditContacts = () => {
    setIsEditingContacts(false);
    loadContacts(); // Перезагружаем оригинальные значения
  };

  const handleCreateAnnouncement = async () => {
    if (!announcement.trim()) {
      await showAlert({
        title: 'Ошибка',
        message: 'Введите текст объявления',
        type: 'warning'
      });
      return;
    }

    try {
      await api.post('/admin/announcements', { content: announcement });
      setAnnouncement('');
      await showAlert({
        title: 'Успешно',
        message: 'Объявление создано и отправлено всем пользователям',
        type: 'success'
      });
    } catch (err) {
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось создать объявление',
        type: 'error'
      });
      console.error(err);
    }
  };

  const handleBackup = async () => {
    try {
      const response = await api.post('/admin/backup');
      await showAlert({
        title: 'Успешно',
        message: `Бэкап создан: ${response.data.backupPath}`,
        type: 'success'
      });
    } catch (err) {
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось создать бэкап',
        type: 'error'
      });
      console.error(err);
    }
  };

  return (
    <>
      {alertDialog}
      {confirmDialog}
      <div className={styles.adminCard}>
      <h3 className={styles.cardTitle}>Админ-панель</h3>

      {/* Навигация */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Управление</h4>
        <div className={styles.navigationButtons}>
          <button
            onClick={() => navigate('/admin/users')}
            className={styles.btnNavigation}
          >
            👥 Пользователи
          </button>
        </div>
      </div>
      {/* Контакты для рекламы */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h4 className={styles.sectionTitle}>Контакты для рекламы</h4>
          {!isEditingContacts && (
            <button 
              onClick={() => setIsEditingContacts(true)} 
              className={styles.btnEdit}
            >
              Редактировать
            </button>
          )}
        </div>
        
        {contactsLoading ? (
          <p>Загрузка...</p>
        ) : isEditingContacts ? (
          <div className={styles.editContactsForm}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Текст:</label>
              <textarea
                value={contactText}
                onChange={(e) => setContactText(e.target.value)}
                className={styles.textarea}
                rows={3}
                placeholder="Введите текст (например: Для размещения рекламы свяжитесь с нами:)"
              />
            </div>
            
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Email:</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className={styles.input}
                placeholder="admin@watchrebel.com"
              />
            </div>
            
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Telegram:</label>
              <input
                type="text"
                value={contactTelegram}
                onChange={(e) => setContactTelegram(e.target.value)}
                className={styles.input}
                placeholder="@watchrebel_admin"
              />
            </div>
            
            <div className={styles.formButtons}>
              <button 
                onClick={handleSaveContacts} 
                className={styles.btnSave}
                disabled={contactsSaving}
              >
                {contactsSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button 
                onClick={handleCancelEditContacts} 
                className={styles.btnCancel}
                disabled={contactsSaving}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.contactsDisplay}>
            {contactText && <p className={styles.contactText}>{contactText}</p>}
            <p className={styles.contactItem}>
              <span className={styles.contactIcon}>📧</span>
              Email: {contactEmail}
            </p>
            <p className={styles.contactItem}>
              <span className={styles.contactIcon}>💬</span>
              Telegram: {contactTelegram}
            </p>
          </div>
        )}
      </div>

      {/* Объявления */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Создать объявление</h4>
        <textarea
          value={announcement}
          onChange={(e) => setAnnouncement(e.target.value)}
          placeholder="Текст объявления для всех пользователей"
          className={styles.textarea}
          rows={4}
        />
        <button onClick={handleCreateAnnouncement} className={styles.btnPrimary}>
          Отправить объявление
        </button>
      </div>

      {/* Бэкап */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Резервное копирование</h4>
        <button onClick={handleBackup} className={styles.btnPrimary}>
          Создать бэкап базы данных
        </button>
      </div>
    </div>
    </>
  );
};

export default AdminPanel;
