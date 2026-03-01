import { useState, useEffect } from 'react';
import api from '../../services/api';
import styles from './NotificationSettings.module.css';

/**
 * Компонент настроек уведомлений в Telegram
 * Позволяет пользователю управлять типами уведомлений, которые он хочет получать
 */
function NotificationSettings({ userId }) {
  const [settings, setSettings] = useState({
    friendAddedToList: true,
    friendRatedMedia: true,
    friendPostedReview: true,
    friendReactedToPost: true,
    newMessage: true,
    newFriendRequest: true,
    adminAnnouncement: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Загружаем настройки при монтировании компонента
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
    // Сохраняем предыдущее состояние для отката при ошибке
    const previousSettings = { ...settings };
    
    const newSettings = {
      ...settings,
      [key]: !settings[key]
    };
    
    // Обновляем состояние сразу для мгновенного отклика UI
    setSettings(newSettings);
    
    // Сохраняем на сервер
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage('');

      const response = await api.put(`/users/${userId}/notification-settings`, newSettings);
      setSettings(response.data);
      setSuccessMessage('Сохранено');

      // Скрываем сообщение об успехе через 2 секунды
      setTimeout(() => {
        setSuccessMessage('');
      }, 2000);
    } catch (err) {
      console.error('Ошибка сохранения настроек:', err);
      setError('Не удалось сохранить настройки');
      // Откатываем изменение при ошибке
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

  // Группы уведомлений с описаниями
  const notificationGroups = [
    {
      title: 'Активность друзей',
      notifications: [
        {
          key: 'friendAddedToList',
          label: 'Друг добавил фильм/сериал в список',
          description: 'Уведомления когда друзья добавляют контент в свои списки'
        },
        {
          key: 'friendRatedMedia',
          label: 'Друг поставил оценку',
          description: 'Уведомления когда друзья оценивают фильмы или сериалы'
        },
        {
          key: 'friendPostedReview',
          label: 'Друг написал отзыв',
          description: 'Уведомления когда друзья публикуют отзывы на контент'
        }
      ]
    },
    {
      title: 'Личные',
      notifications: [
        {
          key: 'friendReactedToPost',
          label: 'Реакция на ваш пост',
          description: 'Уведомления когда кто-то реагирует на ваши записи'
        },
        {
          key: 'newMessage',
          label: 'Новое личное сообщение',
          description: 'Уведомления о новых сообщениях от других пользователей'
        },
        {
          key: 'newFriendRequest',
          label: 'Новый запрос в друзья',
          description: 'Уведомления когда кто-то добавляет вас в друзья'
        }
      ]
    },
    {
      title: 'Системные',
      notifications: [
        {
          key: 'adminAnnouncement',
          label: 'Объявления от администрации',
          description: 'Важные объявления и новости от администраторов сайта'
        }
      ]
    }
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Уведомления в Telegram</h3>
        <p className={styles.subtitle}>
          Выберите, какие уведомления вы хотите получать в Telegram
        </p>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {successMessage && (
        <div className={styles.success}>
          {successMessage}
        </div>
      )}

      <div className={styles.groups}>
        {notificationGroups.map((group, groupIndex) => (
          <div key={groupIndex} className={styles.group}>
            <h4 className={styles.groupTitle}>{group.title}</h4>
            <div className={styles.notifications}>
              {group.notifications.map((notification) => (
                <div key={notification.key} className={styles.notificationItem}>
                  <div className={styles.notificationInfo}>
                    <div className={styles.notificationLabel}>
                      {notification.label}
                    </div>
                    <div className={styles.notificationDescription}>
                      {notification.description}
                    </div>
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
        ))}
      </div>
    </div>
  );
}

export default NotificationSettings;
