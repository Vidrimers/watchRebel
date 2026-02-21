import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import useAlert from '../../hooks/useAlert.jsx';
import useConfirm from '../../hooks/useConfirm.jsx';
import styles from './AdminPanel.module.css';

/**
 * Админ-панель для управления пользователями и системой
 * Доступна только для администратора (TELEGRAM_ADMIN_ID=137981675)
 */
const AdminPanel = () => {
  const { alertDialog, showAlert } = useAlert();
  const { confirmDialog, showConfirm } = useConfirm();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [newName, setNewName] = useState('');
  
  // Состояние для контактов
  const [contactsLoading, setContactsLoading] = useState(true);
  const [isEditingContacts, setIsEditingContacts] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [contactTelegram, setContactTelegram] = useState('');
  const [contactText, setContactText] = useState('');
  const [contactsSaving, setContactsSaving] = useState(false);

  useEffect(() => {
    loadUsers();
    loadContacts();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/users');
      setUsers(response.data);
      setError(null);
    } catch (err) {
      setError('Ошибка загрузки пользователей');
      console.error(err);
    } finally {
      setLoading(false);
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

  const handleDeleteUser = async (userId) => {
    const confirmed = await showConfirm({
      title: 'Удалить пользователя?',
      message: 'Вы уверены, что хотите удалить этого пользователя? Все его данные будут удалены безвозвратно.',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers(users.filter(u => u.id !== userId));
      await showAlert({
        title: 'Успешно',
        message: 'Пользователь удален',
        type: 'success'
      });
    } catch (err) {
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось удалить пользователя',
        type: 'error'
      });
      console.error(err);
    }
  };

  const handleRenameUser = async (userId) => {
    if (!newName.trim()) {
      await showAlert({
        title: 'Ошибка',
        message: 'Введите новое имя',
        type: 'warning'
      });
      return;
    }

    try {
      await api.put(`/admin/users/${userId}`, { displayName: newName });
      setUsers(users.map(u => u.id === userId ? { ...u, displayName: newName } : u));
      setEditingUser(null);
      setNewName('');
      await showAlert({
        title: 'Успешно',
        message: 'Пользователь переименован',
        type: 'success'
      });
    } catch (err) {
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось переименовать пользователя',
        type: 'error'
      });
      console.error(err);
    }
  };

  const handleBlockUser = async (userId, isBlocked) => {
    try {
      await api.post(`/admin/users/${userId}/block`, { blocked: !isBlocked });
      setUsers(users.map(u => u.id === userId ? { ...u, isBlocked: !isBlocked } : u));
      await showAlert({
        title: 'Успешно',
        message: isBlocked ? 'Пользователь разблокирован' : 'Пользователь заблокирован',
        type: 'success'
      });
    } catch (err) {
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось изменить статус блокировки',
        type: 'error'
      });
      console.error(err);
    }
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

  if (loading) {
    return (
      <div className={styles.adminCard}>
        <h3 className={styles.cardTitle}>Админ-панель</h3>
        <p>Загрузка...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.adminCard}>
        <h3 className={styles.cardTitle}>Админ-панель</h3>
        <p className={styles.error}>{error}</p>
      </div>
    );
  }

  return (
    <>
      {alertDialog}
      {confirmDialog}
      <div className={styles.adminCard}>
      <h3 className={styles.cardTitle}>Админ-панель</h3>

      {/* Список пользователей */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Управление пользователями</h4>
        <div className={styles.usersList}>
          {users.map(user => (
            <div key={user.id} className={styles.userItem}>
              <div className={styles.userInfo}>
                <span className={styles.userName}>
                  {user.displayName}
                  {user.isBlocked && <span className={styles.blockedBadge}>Заблокирован</span>}
                </span>
                <span className={styles.userUsername}>@{user.telegramUsername}</span>
              </div>
              
              {editingUser === user.id ? (
                <div className={styles.editForm}>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Новое имя"
                    className={styles.input}
                  />
                  <button onClick={() => handleRenameUser(user.id)} className={styles.btnSave}>
                    Сохранить
                  </button>
                  <button onClick={() => setEditingUser(null)} className={styles.btnCancel}>
                    Отмена
                  </button>
                </div>
              ) : (
                <div className={styles.userActions}>
                  <button
                    onClick={() => {
                      setEditingUser(user.id);
                      setNewName(user.displayName);
                    }}
                    className={styles.btnEdit}
                  >
                    Переименовать
                  </button>
                  <button
                    onClick={() => handleBlockUser(user.id, user.isBlocked)}
                    className={user.isBlocked ? styles.btnUnblock : styles.btnBlock}
                  >
                    {user.isBlocked ? 'Разблокировать' : 'Заблокировать'}
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className={styles.btnDelete}
                  >
                    Удалить
                  </button>
                </div>
              )}
            </div>
          ))}
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
