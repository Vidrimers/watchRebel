import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import Icon from '../components/Common/Icon';
import useAlert from '../hooks/useAlert.jsx';
import useConfirm from '../hooks/useConfirm.jsx';
import api from '../services/api';
import styles from './DatabaseManagementPage.module.css';

const DatabaseManagementPage = () => {
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const { alertDialog, showAlert } = useAlert();
  const { confirmDialog, showConfirm } = useConfirm();

  const [backups, setBackups] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const isAdmin = user?.isAdmin || user?.id === '137981675';

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    loadData();
  }, [isAdmin, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [backupsRes, statsRes] = await Promise.all([
        api.get('/admin/database/backups'),
        api.get('/admin/database/stats')
      ]);
      setBackups(backupsRes.data.backups);
      setStats(statsRes.data);
    } catch (error) {
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось загрузить данные',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setCreating(true);
      const res = await api.post('/admin/database/backup');
      await showAlert({
        title: 'Успех',
        message: `Резервная копия создана: ${res.data.backup.filename}`,
        type: 'success'
      });
      await loadData();
    } catch (error) {
      await showAlert({
        title: 'Ошибка',
        message: error.response?.data?.error || 'Не удалось создать резервную копию',
        type: 'error'
      });
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (filename) => {
    const confirmed = await showConfirm({
      title: 'Восстановить базу данных',
      message: `Вы уверены, что хотите восстановить базу данных из "${filename}"? Текущая база данных будет заменена. Это действие нельзя отменить.`,
      confirmText: 'Восстановить',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });
    if (!confirmed) return;

    try {
      setRestoring(true);
      await api.post('/admin/database/restore', { filename });
      await showAlert({
        title: 'Успех',
        message: 'База данных успешно восстановлена',
        type: 'success'
      });
      await loadData();
    } catch (error) {
      await showAlert({
        title: 'Ошибка',
        message: error.response?.data?.error || 'Не удалось восстановить базу данных',
        type: 'error'
      });
    } finally {
      setRestoring(false);
    }
  };

  const handleDelete = async (filename) => {
    const confirmed = await showConfirm({
      title: 'Удалить резервную копию',
      message: `Вы уверены, что хотите удалить "${filename}"?`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });
    if (!confirmed) return;

    try {
      await api.delete(`/admin/database/backups/${filename}`);
      await showAlert({
        title: 'Успех',
        message: 'Резервная копия удалена',
        type: 'success'
      });
      if (selectedBackup?.filename === filename) {
        setSelectedBackup(null);
      }
      await loadData();
    } catch (error) {
      await showAlert({
        title: 'Ошибка',
        message: error.response?.data?.error || 'Не удалось удалить резервную копию',
        type: 'error'
      });
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

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
        <h1 className={styles.title}>Управление базой данных</h1>
      </div>

      {loading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : (
        <div className={styles.content}>
          {/* Статистика */}
          {stats && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Статистика</h2>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Размер файла</span>
                  <span className={styles.statValue}>{formatSize(stats.fileSize)}</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Обновлён</span>
                  <span className={styles.statValue}>{formatDate(stats.lastModified)}</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Таблиц</span>
                  <span className={styles.statValue}>{stats.tables?.length || 0}</span>
                </div>
              </div>
              {stats.tables && stats.tables.length > 0 && (
                <div className={styles.tablesList}>
                  {stats.tables.map((table) => (
                    <div key={table.name} className={styles.tableItem}>
                      <span className={styles.tableName}>{table.name}</span>
                      <span className={styles.tableCount}>{table.count} записей</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Создание бэкапа */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Создать резервную копию</h2>
            <button
              className={styles.createButton}
              onClick={handleCreateBackup}
              disabled={creating}
            >
              {creating ? 'Создание...' : '+ Создать резервную копию'}
            </button>
          </div>

          {/* Список бэкапов */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Резервные копии ({backups.length})</h2>
            {backups.length === 0 ? (
              <p className={styles.emptyText}>Резервных копий пока нет</p>
            ) : (
              <div className={styles.backupsList}>
                {backups.map((backup) => (
                  <div
                    key={backup.filename}
                    className={`${styles.backupItem} ${selectedBackup?.filename === backup.filename ? styles.selected : ''}`}
                    onClick={() => setSelectedBackup(backup)}
                  >
                    <div className={styles.backupInfo}>
                      <span className={styles.backupName}>{backup.filename}</span>
                      <span className={styles.backupMeta}>
                        {formatDate(backup.createdAt)} · {formatSize(backup.size)}
                      </span>
                    </div>
                    <div className={styles.backupActions}>
                      <button
                        className={styles.restoreButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestore(backup.filename);
                        }}
                        disabled={restoring}
                        title="Восстановить"
                      >
                        Восстановить
                      </button>
                      <button
                        className={styles.deleteButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(backup.filename);
                        }}
                        title="Удалить"
                      >
                        <Icon name="delete" size="small" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseManagementPage;
