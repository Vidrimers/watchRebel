import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { fetchMyBugReports, fetchBugReportDetails, clearSelectedReport, handleBugReportDeleted } from '../store/slices/bugReportsSlice';
import { addMessageHandler, removeMessageHandler } from '../services/websocket';
import UserPageLayout from '../components/Layout/UserPageLayout';
import Icon from '../components/Common/Icon';
import styles from './MyBugReportsPage.module.css';

/**
 * Страница "Мои багрепорты"
 * Отображает список всех багрепортов пользователя с цветовой индикацией статусов
 */
const MyBugReportsPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const { myReports, myReportsLoading, myReportsError, selectedReport, selectedReportLoading } = useAppSelector((state) => state.bugReports);

  // Безопасное значение для myReports
  const safeReports = myReports || [];

  // Загрузка багрепортов
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    dispatch(fetchMyBugReports());
  }, [isAuthenticated, navigate, dispatch]);

  // Обработка WebSocket сообщений
  useEffect(() => {
    const handleWebSocketMessage = (data) => {
      // Обработка удаления багрепорта
      if (data.type === 'bug_report_deleted') {
        console.log('📨 Получено уведомление об удалении багрепорта:', data.bugReportId);
        dispatch(handleBugReportDeleted(data.bugReportId));
      }
    };

    addMessageHandler(handleWebSocketMessage);

    return () => {
      removeMessageHandler(handleWebSocketMessage);
    };
  }, [dispatch]);

  // Получение класса статуса для цветовой индикации
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

  // Получение текста статуса на русском
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
  const handleReportClick = (reportId) => {
    dispatch(fetchBugReportDetails(reportId));
  };

  // Закрытие детального просмотра
  const handleCloseDetails = () => {
    dispatch(clearSelectedReport());
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <UserPageLayout user={user}>
      <div className={styles.bugReportsPage}>
        <button 
          onClick={() => navigate('/settings')}
          className={styles.backButton}
        >
          <Icon name="arrow-left" size="medium" />
          <span>Назад</span>
        </button>

        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Мои багрепорты</h1>
          <p className={styles.pageDescription}>
            Здесь вы можете отслеживать статус ваших сообщений о проблемах
          </p>
        </div>

        {myReportsLoading && (
          <div className={styles.loadingContainer}>
            <p>Загрузка багрепортов...</p>
          </div>
        )}

        {myReportsError && (
          <div className={styles.errorMessage}>
            <p>{myReportsError.message || 'Ошибка загрузки'}</p>
          </div>
        )}

        {!myReportsLoading && !myReportsError && safeReports.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Icon name="bug" size={48} />
            </div>
            <p className={styles.emptyTitle}>У вас пока нет багрепортов</p>
            <p className={styles.emptyHint}>
              Если вы обнаружите проблему, используйте кнопку в футере для отправки багрепорта
            </p>
          </div>
        )}

        {!myReportsLoading && !myReportsError && safeReports.length > 0 && (
          <div className={styles.reportsList}>
            {safeReports.map((report) => (
              <div
                key={report.id}
                className={styles.reportCard}
                onClick={() => handleReportClick(report.id)}
              >
                <div className={styles.reportHeader}>
                  <h3 className={styles.reportTitle}>{report.title}</h3>
                  <span className={`${styles.statusBadge} ${getStatusClass(report.status)}`}>
                    {getStatusText(report.status)}
                  </span>
                </div>
                <p className={styles.reportDescription}>
                  {report.description.length > 150
                    ? `${report.description.substring(0, 150)}...`
                    : report.description}
                </p>
                <div className={styles.reportFooter}>
                  <span className={styles.reportDate}>
                    📅 {formatDate(report.created_at)}
                  </span>
                  {report.images && report.images.length > 0 && (
                    <span className={styles.reportImages}>
                      📷 {report.images.length} {report.images.length === 1 ? 'изображение' : 'изображений'}
                    </span>
                  )}
                </div>
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
              <button
                className={styles.closeButton}
                onClick={handleCloseDetails}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            <div className={styles.detailsContent}>
              <div className={styles.detailsStatus}>
                <span className={styles.detailsLabel}>Статус:</span>
                <span className={`${styles.statusBadge} ${getStatusClass(selectedReport.status)}`}>
                  {getStatusText(selectedReport.status)}
                </span>
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
            </div>
          </div>
        </div>
      )}
    </UserPageLayout>
  );
};

export default MyBugReportsPage;
