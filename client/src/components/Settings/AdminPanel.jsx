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

  // Состояние для багрепортов
  const [newBugReportsCount, setNewBugReportsCount] = useState(0);

  // Состояние для жалоб
  const [newReportsCount, setNewReportsCount] = useState(0);

  useEffect(() => {
    loadBugReportsStats();
    loadReportsStats();

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

  // Загрузка статистики жалоб
  const loadReportsStats = async () => {
    try {
      const response = await api.get('/admin/reports/unread-count');
      setNewReportsCount(response.data?.count || 0);
    } catch (err) {
      // Ошибка загрузки статистики
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
            <Icon name="friends" size="small" /> Пользователи
          </button>
          <button
            onClick={() => navigate('/admin/announcements')}
            className={styles.btnNavigation}
          >
            <Icon name="announcement" size="small" /> Объявления
          </button>
          <button
            onClick={() => navigate('/admin/advertising')}
            className={styles.btnNavigation}
          >
            <Icon name="advertising" size="small" /> Реклама
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
            <Icon name="database" size="small" /> База данных
          </button>
          <button
            onClick={() => navigate('/admin/reports')}
            className={styles.btnNavigation}
          >
            <Icon name="report" size="small" /> Жалобы
            {newReportsCount > 0 && (
              <span className={styles.badge}>{newReportsCount}</span>
            )}
          </button>
        </div>
      </div>
    </div>
    </>
  );
};

export default AdminPanel;
