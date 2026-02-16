import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { fetchWatchlist, fetchLists, addToList } from '../store/slices/listsSlice';
import UserPageLayout from '../components/Layout/UserPageLayout';
import MediaCard from '../components/Media/MediaCard';
import styles from './WatchlistPage.module.css';

/**
 * Страница списка желаемого к просмотру
 * Позволяет просматривать watchlist и перемещать элементы в пользовательские списки
 */
const WatchlistPage = () => {
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const { watchlist, customLists, loading, error } = useAppSelector((state) => state.lists);
  const { episodeProgress } = useAppSelector((state) => state.lists);

  // Фильтр по типу медиа
  const filterType = searchParams.get('type') || 'all';
  
  // Состояние для модального окна перемещения в список
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);

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
          <h1 className={styles.pageTitle}>Список желаемого</h1>
          
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
              🎬 Фильмы
            </button>
            <button
              className={`${styles.filterButton} ${filterType === 'tv' ? styles.active : ''}`}
              onClick={() => handleFilterChange('tv')}
            >
              📺 Сериалы
            </button>
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
            <p>Загрузка списка желаемого...</p>
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
                <p className={styles.emptyTitle}>Список желаемого пуст</p>
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
                    <button
                      className={styles.moveButton}
                      onClick={() => handleMoveToList(item)}
                      title="Переместить в список"
                    >
                      → Переместить в список
                    </button>
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
      </div>
    </UserPageLayout>
  );
};

export default WatchlistPage;
