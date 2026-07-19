import { useState, useEffect } from 'react';
import api from '../../services/api';
import styles from './NotificationSettings.module.css';

/**
 * Компонент настроек уведомлений
 * Управляет настройками Telegram и Email уведомлений отдельно
 */
function NotificationSettings({ userId }) {
  const [settings, setSettings] = useState({
    friendAddedToList: true,
    friendRatedMedia: true,
    friendPostedReview: true,
    friendReactedToPost: true,
    newMessage: true,
    newFriendRequest: true,
    adminAnnouncement: true,
    emailFriendAddedToList: true,
    emailFriendRatedMedia: true,
    emailFriendPostedReview: true,
    emailFriendReactedToPost: true,
    emailNewMessage: true,
    emailNewFriendRequest: true,
    emailAdminAnnouncement: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadSettings();
  }, [userId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/users/${userId}/notification-settings`);
      setSettings(response.data);
    } catch (err) {
      console.error('Ошибка загрузки настроек:', err);
      setError('Не удалось загрузить настройки уведомлений');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key) => {
    const previousSettings = { ...settings };
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage('');
      const response = await api.put(`/users/${userId}/notification-settings`, newSettings);
      setSettings(response.data);
      setSuccessMessage('Сохранено');
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      console.error('Ошибка сохранения настроек:', err);
      setError('Не удалось сохранить настройки');
      setSettings(previousSettings);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Загрузка настроек...</div>
      </div>
    );
  }

  // Telegram уведомления
  const telegramGroups = [
    {
      title: 'Активность друзей',
      notifications: [
        { key: 'friendAddedToList', label: 'Друг добавил фильм/сериал в список', description: 'Уведомления когда друзья добавляют контент в свои списки' },
        { key: 'friendRatedMedia', label: 'Друг поставил оценку', description: 'Уведомления когда друзья оценивают фильмы или сериалы' },
        { key: 'friendPostedReview', label: 'Друг написал отзыв', description: 'Уведомления когда друзья публикуют отзывы на контент' }
      ]
    },
    {
      title: 'Личные',
      notifications: [
        { key: 'friendReactedToPost', label: 'Реакция на ваш пост', description: 'Уведомления когда кто-то реагирует на ваши записи' },
        { key: 'newMessage', label: 'Новое личное сообщение', description: 'Уведомления о новых сообщениях от других пользователей' },
        { key: 'newFriendRequest', label: 'Новый запрос в друзья', description: 'Уведомления когда кто-то добавляет вас в друзья' }
      ]
    },
    {
      title: 'Системные',
      notifications: [
        { key: 'adminAnnouncement', label: 'Объявления от администрации', description: 'Важные объявления и новости от администраторов сайта' }
      ]
    }
  ];

  // Email уведомления (зеркало Telegram, но с префиксом email)
  const emailGroups = [
    {
      title: 'Активность друзей',
      notifications: [
        { key: 'emailFriendAddedToList', label: 'Друг добавил фильм/сериал в список', description: 'Email-уведомления когда друзья добавляют контент в свои списки' },
        { key: 'emailFriendRatedMedia', label: 'Друг поставил оценку', description: 'Email-уведомления когда друзья оценивают фильмы или сериалы' },
        { key: 'emailFriendPostedReview', label: 'Друг написал отзыв', description: 'Email-уведомления когда друзья публикуют отзывы на контент' }
      ]
    },
    {
      title: 'Личные',
      notifications: [
        { key: 'emailFriendReactedToPost', label: 'Реакция на ваш пост', description: 'Email-уведомления когда кто-то реагирует на ваши записи' },
        { key: 'emailNewMessage', label: 'Новое личное сообщение', description: 'Email-уведомления о новых сообщениях от других пользователей' },
        { key: 'emailNewFriendRequest', label: 'Новый запрос в друзья', description: 'Email-уведомления когда кто-то добавляет вас в друзья' }
      ]
    },
    {
      title: 'Системные',
      notifications: [
        { key: 'emailAdminAnnouncement', label: 'Объявления от администрации', description: 'Email-уведомления о важных объявлениях и новостях' }
      ]
    }
  ];

  const renderGroup = (group) => (
    <div className={styles.group}>
      <h4 className={styles.groupTitle}>{group.title}</h4>
      <div className={styles.notifications}>
        {group.notifications.map((notification) => (
          <div key={notification.key} className={styles.notificationItem}>
            <div className={styles.notificationInfo}>
              <div className={styles.notificationLabel}>{notification.label}</div>
              <div className={styles.notificationDescription}>{notification.description}</div>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={settings[notification.key]}
                onChange={() => handleToggle(notification.key)}
                className={styles.toggleInput}
                disabled={saving}
              />
              <span className={styles.toggleSlider}></span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={styles.container}>
      {error && <div className={styles.error}>{error}</div>}
      {successMessage && <div className={styles.success}>{successMessage}</div>}

      {/* Telegram уведомления */}
      <div className={styles.section}>
        <div className={styles.header}>
          <h3 className={styles.title}>Telegram уведомления</h3>
          <p className={styles.subtitle}>Выберите, какие уведомления вы хотите получать в Telegram</p>
        </div>
        <div className={styles.groups}>
          {telegramGroups.map((group, i) => (
            <div key={`tg-${i}`}>{renderGroup(group)}</div>
          ))}
        </div>
      </div>

      {/* Email уведомления */}
      <div className={styles.section}>
        <div className={styles.header}>
          <h3 className={styles.title}>Email уведомления</h3>
          <p className={styles.subtitle}>Выберите, какие уведомления вы хотите получать на почту</p>
        </div>
        <div className={styles.groups}>
          {emailGroups.map((group, i) => (
            <div key={`email-${i}`}>{renderGroup(group)}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default NotificationSettings;
