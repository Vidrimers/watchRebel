import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { fetchWatchlist, fetchLists, addToList, removeFromWatchlist } from '../store/slices/listsSlice';
import UserPageLayout from '../components/Layout/UserPageLayout';
import MediaCard from '../components/Media/MediaCard';
import ConfirmDialog from '../components/Common/ConfirmDialog';
import Icon from '../components/Common/Icon';
import useAlert from '../hooks/useAlert';
import styles from './WatchlistPage.module.css';

/**
 * Страница списка желаемого к просмотру
 * Позволяет просматривать watchlist и перемещать элементы в пользовательские списки
 */
const WatchlistPage = () => {
  const dispatch = useAppDispatch();
  const { showAlert } = useAlert();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const { watchlist, customLists, loading, error } = useAppSelector((state) => state.lists);
  const { episodeProgress } = useAppSelector((state) => state.lists);

  // Фильтр по типу медиа
  const filterType = searchParams.get('type') || 'all';
  
  // Состояние для модального окна перемещения в список
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  
  // Состояние для модального окна удаления
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Состояние для dropdown экспорта
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Функция экспорта
  const handleExport = async (format) => {
    setShowExportDropdown(false);
    setIsExporting(true);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/watchlist/export?format=${format}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Ошибка экспорта');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `watchrebel_watchlist_${new Date().toISOString().split('T')[0]}.${format}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      await showAlert({
        title: 'Успешно!',
        message: `Watchlist экспортирован в формате ${format.toUpperCase()}`,
        type: 'success'
      });
    } catch (error) {
      console.error('Ошибка экспорта:', error);
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось экспортировать. Попробуйте позже.',
        type: 'error'
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Закрытие dropdown при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showExportDropdown && !event.target.closest(`.${styles.exportContainer}`)) {
        setShowExportDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportDropdown]);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchWatchlist());
      dispatch(fetchLists());
    }
  }, [isAuthenticated, dispatch]);

  // Фильтрация watchlist по типу
  const filteredWatchlist = filterType === 'all' 
    ? watchlist 
    : watchlist.filter(item => item.mediaType === filterType);

  // Изменение фильтра
  const handleFilterChange = (type) => {
    setSearchParams(type === 'all' ? {} : { type });
  };

  // Открытие модального окна для перемещения
  const handleMoveToList = (media) => {
    setSelectedMedia(media);
    setMoveModalOpen(true);
  };

  // Перемещение в список
  const handleSelectList = async (listId) => {
    if (!selectedMedia) return;

    try {
      await dispatch(addToList({
        listId,
        media: {
          tmdbId: selectedMedia.tmdbId,
          mediaType: selectedMedia.mediaType
        }
      })).unwrap();

      // Закрываем модальное окно
      setMoveModalOpen(false);
      setSelectedMedia(null);

      // Обновляем watchlist
      dispatch(fetchWatchlist());
    } catch (err) {
      console.error('Ошибка при перемещении в список:', err);
    }
  };

  // Закрытие модального окна
  const handleCloseModal = () => {
    setMoveModalOpen(false);
    setSelectedMedia(null);
  };

  // Открытие диалога удаления
  const handleOpenDeleteDialog = (item) => {
    setItemToDelete(item);
    setShowDeleteDialog(true);
  };

  // Удаление из watchlist
  const handleDeleteItem = async () => {
    if (!itemToDelete) return;

    try {
      await dispatch(removeFromWatchlist(itemToDelete.id)).unwrap();

      // Закрываем диалог и очищаем состояние ПЕРЕД показом алерта
      setShowDeleteDialog(false);
      setItemToDelete(null);

      await showAlert({
        title: 'Успешно!',
        message: `"${itemToDelete.title}" удален`,
        type: 'success'
      });
    } catch (error) {
      console.error('Ошибка удаления:', error);
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось удалить. Попробуйте позже.',
        type: 'error'
      });
    }
  };

  // Получение доступных списков для выбранного медиа
  const availableLists = selectedMedia 
    ? customLists.filter(list => list.mediaType === selectedMedia.mediaType)
    : [];

  if (!isAuthenticated) {
    return (
      <div className={styles.errorContainer}>
        <p>Необходимо авторизоваться</p>
      </div>
    );
  }

  return (
    <UserPageLayout user={user}>
      <div className={styles.watchlistPage}>
        {/* Заголовок и фильтры */}
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Хочу посмотреть</h1>
          
          <div className={styles.headerActions}>
            <div className={styles.filterButtons}>
              <button
                className={`${styles.filterButton} ${filterType === 'all' ? styles.active : ''}`}
                onClick={() => handleFilterChange('all')}
              >
                Все
              </button>
              <button
                className={`${styles.filterButton} ${filterType === 'movie' ? styles.active : ''}`}
                onClick={() => handleFilterChange('movie')}
              >
                <Icon name="movies" size="small" /> Фильмы
              </button>
              <button
                className={`${styles.filterButton} ${filterType === 'tv' ? styles.active : ''}`}
                onClick={() => handleFilterChange('tv')}
              >
                <Icon name="tv" size="small" /> Сериалы
              </button>
            </div>

            {/* Кнопка экспорта */}
            <div className={styles.exportContainer}>
              <button
                className={styles.exportButton}
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                disabled={isExporting || filteredWatchlist.length === 0}
              >
                {isExporting ? '⏳ Подготовка...' : '📥 Экспорт'}
              </button>
              
              {showExportDropdown && (
                <div className={styles.exportDropdown}>
                  <button
                    className={styles.exportOption}
                    onClick={() => handleExport('json')}
                  >
                    📄 JSON
                  </button>
                  <button
                    className={styles.exportOption}
                    onClick={() => handleExport('xlsx')}
                  >
                    📊 Excel (XLSX)
                  </button>
                  <button
                    className={styles.exportOption}
                    onClick={() => handleExport('csv')}
                  >
                    📋 CSV
                  </button>
                  <button
                    className={styles.exportOption}
                    onClick={() => handleExport('pdf')}
                  >
                    📕 PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Счетчик элементов */}
        {!loading && !error && (
          <div className={styles.countInfo}>
            <p>
              {filteredWatchlist.length} {' '}
              {filteredWatchlist.length === 1 ? 'элемент' : 
               filteredWatchlist.length > 1 && filteredWatchlist.length < 5 ? 'элемента' : 
               'элементов'}
            </p>
          </div>
        )}

        {/* Состояния загрузки и ошибок */}
        {loading && (
          <div className={styles.loadingContainer}>
            <p>Загрузка...</p>
          </div>
        )}

        {error && (
          <div className={styles.errorMessage}>
            <p>Ошибка загрузки: {error.message || 'Неизвестная ошибка'}</p>
          </div>
        )}

        {/* Контент */}
        {!loading && !error && (
          <>
            {filteredWatchlist.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📋</div>
                <p className={styles.emptyTitle}>Список пуст</p>
                <p className={styles.emptyHint}>
                  Добавьте фильмы и сериалы, которые хотите посмотреть
                </p>
              </div>
            ) : (
              <div className={styles.mediaGrid}>
                {filteredWatchlist.map((item) => (
                  <div key={item.tmdbId} className={styles.mediaCardWrapper}>
                    <MediaCard
                      media={item}
                      showProgress={item.mediaType === 'tv'}
                      progress={episodeProgress[item.tmdbId]?.[episodeProgress[item.tmdbId].length - 1]}
                    />
                    <div className={styles.itemActions}>
                      <button
                        className={styles.moveButton}
                        onClick={() => handleMoveToList(item)}
                        title="Переместить в список"
                      >
                        →
                      </button>
                      <button
                        className={styles.deleteButton}
                        onClick={() => handleOpenDeleteDialog(item)}
                        title="Удалить"
                      >
                        <Icon name="delete" size="small" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Модальное окно выбора списка */}
        {moveModalOpen && selectedMedia && (
          <div className={styles.modalOverlay} onClick={handleCloseModal}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>Выберите список</h2>
                <button 
                  className={styles.modalClose}
                  onClick={handleCloseModal}
                >
                  ×
                </button>
              </div>

              <div className={styles.modalContent}>
                <p className={styles.modalSubtitle}>
                  Переместить "{selectedMedia.title}" в:
                </p>

                {availableLists.length === 0 ? (
                  <div className={styles.noLists}>
                    <p>У вас нет списков для {selectedMedia.mediaType === 'movie' ? 'фильмов' : 'сериалов'}</p>
                    <p className={styles.noListsHint}>
                      Создайте список на странице "Мои списки"
                    </p>
                  </div>
                ) : (
                  <div className={styles.listOptions}>
                    {availableLists.map((list) => (
                      <button
                        key={list.id}
                        className={styles.listOption}
                        onClick={() => handleSelectList(list.id)}
                      >
                        <span className={styles.listOptionName}>{list.name}</span>
                        <span className={styles.listOptionCount}>
                          {list.items?.length || 0} элементов
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Модалка удаления */}
        <ConfirmDialog
          isOpen={showDeleteDialog}
          title="Удалить"
          message={`Вы уверены, что хотите удалить "${itemToDelete?.title}"?`}
          onConfirm={handleDeleteItem}
          onCancel={() => {
            setShowDeleteDialog(false);
            setItemToDelete(null);
          }}
          confirmText="Удалить"
          cancelText="Отмена"
          confirmButtonStyle="danger"
        />
      </div>
    </UserPageLayout>
  );
};

export default WatchlistPage;
