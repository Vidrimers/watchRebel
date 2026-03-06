import React, { useEffect, useState } from 'react';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchAllBugReports, fetchBugReportStats, fetchBugReportDetails, updateBugReportStatus, deleteBugReport, clearSelectedReport } from '../../store/slices/bugReportsSlice';
import useAlert from '../../hooks/useAlert';
import useConfirm from '../../hooks/useConfirm';
import Icon from '../Common/Icon';
import styles from './BugReportsManager.module.css';

/**
 * Компонент управления багрепортами для админ-панели
 * Позволяет просматривать, фильтровать и изменять статусы багрепортов
 */
const BugReportsManager = () => {
  const dispatch = useAppDispatch();
  const { alertDialog, showAlert } = useAlert();
  const { confirmDialog, showConfirm } = useConfirm();
  const { allReports, allReportsLoading, allReportsError, stats, selectedReport, updateLoading } = useAppSelector((state) => state.bugReports);
  
  const [activeFilter, setActiveFilter] = useState('all');
  const [newStatus, setNewStatus] = useState('');

  // Загрузка багрепортов и статистики
  useEffect(() => {
    dispatch(fetchAllBugReports());
    dispatch(fetchBugReportStats());
  }, [dispatch]);

  // Безопасные значения с дефолтами
  const safeReports = allReports || [];
  const safeStats = stats || { new: 0, in_progress: 0, resolved: 0, rejected: 0 };

  // Фильтрация багрепортов
  const filteredReports = activeFilter === 'all'
    ? safeReports
    : safeReports.filter(report => report.status === activeFilter);

  // Получение класса статуса
  const getStatusClass = (status) => {
    switch (status) {
      case 'new':
        return styles.statusNew;
      case 'in_progress':
        return styles.statusInProgress;
      case 'resolved':
        return styles.statusResolved;
      case 'rejected':
        return styles.statusRejected;
      default:
        return '';
    }
  };

  // Получение текста статуса
  const getStatusText = (status) => {
    switch (status) {
      case 'new':
        return 'Новый';
      case 'in_progress':
        return 'В работе';
      case 'resolved':
        return 'Решено';
      case 'rejected':
        return 'Отклонено';
      default:
        return status;
    }
  };

  // Форматирование даты
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Открытие детального просмотра
  const handleReportClick = (report) => {
    dispatch(fetchBugReportDetails(report.id));
    setNewStatus(report.status);
  };

  // Закрытие детального просмотра
  const handleCloseDetails = () => {
    dispatch(clearSelectedReport());
    setNewStatus('');
  };

  // Изменение статуса
  const handleUpdateStatus = async () => {
    if (!selectedReport || !newStatus || newStatus === selectedReport.status) {
      return;
    }

    try {
      await dispatch(updateBugReportStatus({
        reportId: selectedReport.id,
        status: newStatus
      })).unwrap();
      
      // Перезагружаем статистику
      dispatch(fetchBugReportStats());
      
      handleCloseDetails();
      
      await showAlert({
        title: 'Успешно',
        message: 'Статус багрепорта обновлён',
        type: 'success'
      });
    } catch (err) {
      await showAlert({
        title: 'Ошибка',
        message: err.message || 'Не удалось обновить статус',
        type: 'error'
      });
    }
  };

  // Удаление багрепорта
  const handleDeleteReport = async () => {
    if (!selectedReport) return;

    const confirmed = await showConfirm({
      title: 'Удалить багрепорт?',
      message: `Вы уверены, что хотите удалить багрепорт "${selectedReport.title}"? Это действие нельзя отменить.`,
      confirmText: 'Удалить',
      cancelText: 'Отмена'
    });

    if (!confirmed) return;

    try {
      await dispatch(deleteBugReport(selectedReport.id)).unwrap();
      
      // Перезагружаем статистику
      dispatch(fetchBugReportStats());
      
      await showAlert({
        title: 'Успешно',
        message: 'Багрепорт удалён',
        type: 'success'
      });
    } catch (err) {
      await showAlert({
        title: 'Ошибка',
        message: err.message || 'Не удалось удалить багрепорт',
        type: 'error'
      });
    }
  };

  return (
    <>
      {alertDialog}
      {confirmDialog}
      <div className={styles.bugReportsManager}>
        <div className={styles.header}>
          <h3 className={styles.title}>Управление багрепортами</h3>
        </div>

        {/* Фильтры со счётчиками */}
        <div className={styles.filters}>
          <button
            className={`${styles.filterButton} ${activeFilter === 'all' ? styles.active : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            Все ({safeReports.length})
          </button>
          <button
            className={`${styles.filterButton} ${activeFilter === 'new' ? styles.active : ''}`}
            onClick={() => setActiveFilter('new')}
          >
            Новые ({safeStats.new})
          </button>
          <button
            className={`${styles.filterButton} ${activeFilter === 'in_progress' ? styles.active : ''}`}
            onClick={() => setActiveFilter('in_progress')}
          >
            В работе ({safeStats.in_progress})
          </button>
          <button
            className={`${styles.filterButton} ${activeFilter === 'resolved' ? styles.active : ''}`}
            onClick={() => setActiveFilter('resolved')}
          >
            Решено ({safeStats.resolved})
          </button>
          <button
            className={`${styles.filterButton} ${activeFilter === 'rejected' ? styles.active : ''}`}
            onClick={() => setActiveFilter('rejected')}
          >
            Отклонено ({safeStats.rejected})
          </button>
        </div>

        {/* Список багрепортов */}
        {allReportsLoading && (
          <div className={styles.loadingContainer}>
            <p>Загрузка багрепортов...</p>
          </div>
        )}

        {allReportsError && (
          <div className={styles.errorMessage}>
            <p>{allReportsError.message || 'Ошибка загрузки'}</p>
          </div>
        )}

        {!allReportsLoading && !allReportsError && filteredReports.length === 0 && (
          <div className={styles.emptyState}>
            <p>Багрепортов не найдено</p>
          </div>
        )}

        {!allReportsLoading && !allReportsError && filteredReports.length > 0 && (
          <div className={styles.reportsList}>
            {filteredReports.map((report) => (
              <div
                key={report.id}
                className={styles.reportCard}
                onClick={() => handleReportClick(report)}
              >
                <div className={styles.reportHeader}>
                  <div className={styles.reportInfo}>
                    <h4 className={styles.reportTitle}>{report.title}</h4>
                    <p className={styles.reportAuthor}>
                      Автор: {report.userName || 'Неизвестно'}
                    </p>
                  </div>
                  <span className={`${styles.statusBadge} ${getStatusClass(report.status)}`}>
                    {getStatusText(report.status)}
                  </span>
                </div>
                <p className={styles.reportDate}>
                  📅 {formatDate(report.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модальное окно детального просмотра */}
      {selectedReport && (
        <div className={styles.detailsOverlay} onClick={handleCloseDetails}>
          <div className={styles.detailsModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.detailsHeader}>
              <h2>{selectedReport.title}</h2>
              <div className={styles.headerButtons}>
                <button
                  className={styles.deleteButton}
                  onClick={handleDeleteReport}
                  disabled={updateLoading}
                  aria-label="Удалить багрепорт"
                  title="Удалить багрепорт"
                >
                  <Icon name="delete" size="medium" />
                </button>
                <button
                  className={styles.closeButton}
                  onClick={handleCloseDetails}
                  aria-label="Закрыть"
                >
                  ×
                </button>
              </div>
            </div>

            <div className={styles.detailsContent}>
              <div className={styles.detailsSection}>
                <span className={styles.detailsLabel}>Автор:</span>
                <p className={styles.detailsText}>
                  {selectedReport.userName || 'Неизвестно'}
                </p>
              </div>

              <div className={styles.detailsSection}>
                <span className={styles.detailsLabel}>Описание:</span>
                <p className={styles.detailsText}>{selectedReport.description}</p>
              </div>

              <div className={styles.detailsSection}>
                <span className={styles.detailsLabel}>Дата создания:</span>
                <p className={styles.detailsText}>{formatDate(selectedReport.created_at)}</p>
              </div>

              {selectedReport.updated_at && selectedReport.updated_at !== selectedReport.created_at && (
                <div className={styles.detailsSection}>
                  <span className={styles.detailsLabel}>Последнее обновление:</span>
                  <p className={styles.detailsText}>{formatDate(selectedReport.updated_at)}</p>
                </div>
              )}

              {selectedReport.images && selectedReport.images.length > 0 && (
                <div className={styles.detailsSection}>
                  <span className={styles.detailsLabel}>Изображения:</span>
                  <div className={styles.imagesGallery}>
                    {selectedReport.images.map((image, index) => (
                      <a
                        key={index}
                        href={image.image_path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.imageLink}
                      >
                        <img
                          src={image.image_path}
                          alt={`Скриншот ${index + 1}`}
                          className={styles.galleryImage}
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Изменение статуса */}
              <div className={styles.detailsSection}>
                <span className={styles.detailsLabel}>Изменить статус:</span>
                <div className={styles.statusControl}>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className={styles.statusSelect}
                    disabled={updateLoading}
                  >
                    <option value="new">Новый</option>
                    <option value="in_progress">В работе</option>
                    <option value="resolved">Решено</option>
                    <option value="rejected">Отклонено</option>
                  </select>
                  <button
                    className={styles.updateButton}
                    onClick={handleUpdateStatus}
                    disabled={updateLoading || newStatus === selectedReport.status}
                  >
                    {updateLoading ? 'Сохранение...' : 'Сохранить'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BugReportsManager;
