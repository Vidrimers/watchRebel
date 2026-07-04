import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import { TELEGRAM_ADMIN_ID } from '../constants';
import Icon from '../components/Common/Icon';
import useAlert from '../hooks/useAlert.jsx';
import useConfirm from '../hooks/useConfirm.jsx';
import api from '../services/api';
import styles from './ReportsPage.module.css';

const STATUS_LABELS = {
  pending: 'Ожидает',
  reviewed: 'Просмотрено',
  dismissed: 'Отклонено'
};

const STATUS_COLORS = {
  pending: 'warning',
  reviewed: 'success',
  dismissed: 'muted'
};

const ReportsPage = () => {
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const { alertDialog, showAlert } = useAlert();
  const { confirmDialog, showConfirm } = useConfirm();

  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.isAdmin || user?.id === TELEGRAM_ADMIN_ID;

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    loadReports();
  }, [isAdmin, navigate]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/reports');
      setReports(res.data.reports);
    } catch (error) {
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось загрузить жалобы',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (reportId, status) => {
    const label = status === 'reviewed' ? 'просмотрено' : 'отклонено';
    const confirmed = await showConfirm({
      title: `Отметить как "${label}"`,
      message: `Вы уверены, что хотите отметить эту жалобу как "${label}"?`,
      confirmText: status === 'reviewed' ? 'Просмотрено' : 'Отклонено',
      cancelText: 'Отмена',
      confirmButtonStyle: status === 'reviewed' ? 'success' : 'danger'
    });
    if (!confirmed) return;

    try {
      await api.put(`/admin/reports/${reportId}`, { status });
      await showAlert({
        title: 'Готово',
        message: `Жалоба отмечена как "${label}"`,
        type: 'success'
      });
      await loadReports();
    } catch (error) {
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось обновить статус',
        type: 'error'
      });
    }
  };

  const handleDelete = async (reportId) => {
    const confirmed = await showConfirm({
      title: 'Удалить жалобу',
      message: 'Вы уверены, что хотите удалить эту жалобу? Это действие необратимо.',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });
    if (!confirmed) return;

    try {
      await api.delete(`/admin/reports/${reportId}`);
      await showAlert({
        title: 'Готово',
        message: 'Жалоба удалена',
        type: 'success'
      });
      await loadReports();
    } catch (error) {
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось удалить жалобу',
        type: 'error'
      });
    }
  };

  const filteredReports = filter === 'all'
    ? reports
    : reports.filter(r => r.status === filter);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isAdmin) return null;

  return (
    <div className={styles.page}>
      {alertDialog}
      {confirmDialog}

      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate('/settings')}>
          ← Назад
        </button>
        <h1 className={styles.title}>Жалобы</h1>
      </div>

      {/* Фильтры */}
      <div className={styles.filters}>
        {['all', 'pending', 'reviewed', 'dismissed'].map((status) => {
          const count = status === 'all'
            ? reports.length
            : reports.filter(r => r.status === status).length;
          return (
            <button
              key={status}
              className={`${styles.filterBtn} ${filter === status ? styles.active : ''}`}
              onClick={() => setFilter(status)}
            >
              {status === 'all' ? 'Все' : STATUS_LABELS[status]}
              {count > 0 && (
                <span className={styles.count}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : filteredReports.length === 0 ? (
        <div className={styles.empty}>Жалоб нет</div>
      ) : (
        <div className={styles.reportsList}>
          {filteredReports.map((report) => (
            <div key={report.id} className={styles.reportCard}>
              <div className={styles.reportHeader}>
                <div className={styles.users}>
                  <span className={styles.userLabel}>От:</span>
                  <span className={styles.userName}>{report.reporter_name || 'Неизвестный'}</span>
                  <span className={styles.userLabel}>На:</span>
                  <span className={styles.userName}>{report.reported_name || 'Неизвестный'}</span>
                </div>
                <span className={`${styles.status} ${styles[STATUS_COLORS[report.status]]}`}>
                  {STATUS_LABELS[report.status]}
                </span>
              </div>

              <p className={styles.reason}>{report.reason}</p>

              <div className={styles.reportFooter}>
                <span className={styles.date}>{formatDate(report.created_at)}</span>

                <div className={styles.actions}>
                  <button
                    className={styles.profileBtn}
                    onClick={() => navigate(`/user/${report.reported_user_id}`)}
                  >
                    Профиль
                  </button>
                  {report.status === 'pending' && (
                    <>
                      <button
                        className={styles.dismissBtn}
                        onClick={() => handleStatusChange(report.id, 'dismissed')}
                      >
                        Отклонено
                      </button>
                      <button
                        className={styles.resolveBtn}
                        onClick={() => handleStatusChange(report.id, 'reviewed')}
                      >
                        Просмотрено
                      </button>
                    </>
                  )}
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(report.id)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
