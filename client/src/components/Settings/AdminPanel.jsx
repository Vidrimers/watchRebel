import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../Common/Icon';
import api from '../../services/api';
import useAlert from '../../hooks/useAlert.jsx';
import useConfirm from '../../hooks/useConfirm.jsx';
import { addMessageHandler, removeMessageHandler } from '../../services/websocket';
import styles from './AdminPanel.module.css';

/**
 * Админ-панель для управления пользователями и системой
 * Доступна только для администратора (TELEGRAM_ADMIN_ID=137981675)
 */
const AdminPanel = () => {
  const navigate = useNavigate();
  const { alertDialog, showAlert } = useAlert();
  const { confirmDialog, showConfirm } = useConfirm();
  
  // Состояние для контактов
  const [contactsLoading, setContactsLoading] = useState(true);
  const [isEditingContacts, setIsEditingContacts] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [contactTelegram, setContactTelegram] = useState('');
  const [contactText, setContactText] = useState('');
  const [contactsSaving, setContactsSaving] = useState(false);

  // Состояние для багрепортов
  const [newBugReportsCount, setNewBugReportsCount] = useState(0);

  useEffect(() => {
    loadContacts();
    loadBugReportsStats();

    // Обработчик WebSocket сообщений для обновления счетчика багрепортов
    const handleWebSocketMessage = (data) => {
      // Если пришло уведомление о новом багрепорте - обновляем статистику
      if (data.type === 'notification' && data.notification?.type === 'new_bug_report') {
        loadBugReportsStats();
      }
    };

    // Подписываемся на WebSocket сообщения
    addMessageHandler(handleWebSocketMessage);

    // Очищаем при размонтировании
    return () => {
      removeMessageHandler(handleWebSocketMessage);
    };
  }, []);

  // Загрузка статистики багрепортов
  const loadBugReportsStats = async () => {
    try {
      const response = await api.get('/bug-reports/admin/stats');
      setNewBugReportsCount(response.data?.new || 0);
    } catch (err) {
      // Ошибка загрузки статистики
    }
  };

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
            <Icon name="friends" size="small" /> Пользователи
          </button>
          <button
            onClick={() => navigate('/admin/announcements')}
            className={styles.btnNavigation}
          >
            <Icon name="announcement" size="small" /> Объявления
          </button>
          <button
            onClick={() => navigate('/admin/bug-reports')}
            className={styles.btnNavigation}
          >
            <Icon name="bug" size="small" /> Багрепорты
            {newBugReportsCount > 0 && (
              <span className={styles.badge}>{newBugReportsCount}</span>
            )}
          </button>
          <button
            onClick={() => navigate('/admin/database')}
            className={styles.btnNavigation}
          >
            <Icon name="refresh" size="small" /> База данных
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
              <span className={styles.contactIcon}><Icon name="email" size="small" /></span>
              Email: {contactEmail}
            </p>
            <p className={styles.contactItem}>
              <span className={styles.contactIcon}><Icon name="telegram" size="small" /></span>
              Telegram: {contactTelegram}
            </p>
          </div>
        )}
      </div>

    </div>
    </>
  );
};

export default AdminPanel;
