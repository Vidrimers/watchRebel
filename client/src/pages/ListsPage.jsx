import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { fetchLists } from '../store/slices/listsSlice';
import UserPageLayout from '../components/Layout/UserPageLayout';
import CustomListManager from '../components/Lists/CustomListManager';
import MediaCard from '../components/Media/MediaCard';
import styles from './ListsPage.module.css';

/**
 * Страница списков фильмов и сериалов
 * Позволяет переключаться между типами медиа и просматривать содержимое списков
 */
const ListsPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const { customLists, loading, error } = useAppSelector((state) => state.lists);
  const { episodeProgress } = useAppSelector((state) => state.lists);

  // Получаем тип медиа из URL параметров (по умолчанию 'movie')
  const mediaType = searchParams.get('type') || 'movie';
  
  // Выбранный список для просмотра
  const [selectedList, setSelectedList] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchLists());
    }
  }, [isAuthenticated, dispatch]);

  // Переключение типа медиа
  const handleMediaTypeChange = (type) => {
    setSearchParams({ type });
    setSelectedList(null); // Сбрасываем выбранный список при смене типа
  };

  // Выбор списка для просмотра
  const handleListSelect = (list) => {
    setSelectedList(list);
  };

  // Возврат к списку всех списков
  const handleBackToLists = () => {
    setSelectedList(null);
  };

  if (!isAuthenticated) {
    return (
      <div className={styles.errorContainer}>
        <p>Необходимо авторизоваться</p>
      </div>
    );
  }

  return (
    <UserPageLayout user={user}>
      <div className={styles.listsPage}>
        {/* Заголовок и переключатель типов */}
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Мои списки</h1>
          
          <div className={styles.mediaTypeToggle}>
            <button
              className={`${styles.toggleButton} ${mediaType === 'movie' ? styles.active : ''}`}
              onClick={() => handleMediaTypeChange('movie')}
            >
              🎬 Фильмы
            </button>
            <button
              className={`${styles.toggleButton} ${mediaType === 'tv' ? styles.active : ''}`}
              onClick={() => handleMediaTypeChange('tv')}
            >
              📺 Сериалы
            </button>
          </div>
        </div>

        {/* Состояния загрузки и ошибок */}
        {loading && (
          <div className={styles.loadingContainer}>
            <p>Загрузка списков...</p>
          </div>
        )}

        {error && (
          <div className={styles.errorMessage}>
            <p>Ошибка загрузки: {error.message || 'Неизвестная ошибка'}</p>
          </div>
        )}

        {/* Основной контент */}
        {!loading && !error && (
          <>
            {!selectedList ? (
              // Показываем менеджер списков
              <CustomListManager
                lists={customLists}
                mediaType={mediaType}
                onListSelect={handleListSelect}
              />
            ) : (
              // Показываем содержимое выбранного списка
              <div className={styles.listContent}>
                <div className={styles.listContentHeader}>
                  <button 
                    className={styles.backButton}
                    onClick={handleBackToLists}
                  >
                    ← Назад к спискам
                  </button>
                  <h2 className={styles.listContentTitle}>{selectedList.name}</h2>
                  <p className={styles.listContentCount}>
                    {selectedList.items?.length || 0} {' '}
                    {selectedList.items?.length === 1 ? 'элемент' : 
                     selectedList.items?.length > 1 && selectedList.items?.length < 5 ? 'элемента' : 
                     'элементов'}
                  </p>
                </div>

                {selectedList.items && selectedList.items.length > 0 ? (
                  <div className={styles.mediaGrid}>
                    {selectedList.items.map((item) => (
                      <MediaCard
                        key={item.tmdbId}
                        media={item}
                        showProgress={item.mediaType === 'tv'}
                        progress={episodeProgress[item.tmdbId]?.[episodeProgress[item.tmdbId].length - 1]}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyList}>
                    <p>Список пуст</p>
                    <p className={styles.emptyHint}>
                      Добавьте {mediaType === 'movie' ? 'фильмы' : 'сериалы'} через поиск
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </UserPageLayout>
  );
};

export default ListsPage;
