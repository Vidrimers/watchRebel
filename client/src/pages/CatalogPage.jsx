import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import UserPageLayout from '../components/Layout/UserPageLayout';
import { MediaGrid } from '../components/Media';
import { fetchLists, addToList, addToWatchlist } from '../store/slices/listsSlice';
import useAlert from '../hooks/useAlert';
import ConfirmDialog from '../components/Common/ConfirmDialog';
import api from '../services/api';
import styles from './CatalogPage.module.css';

/**
 * Страница каталога с популярными фильмами и сериалами
 * Отображает контент из TMDb с возможностью фильтрации и пагинации
 */
const CatalogPage = () => {
  console.log('🎬 CatalogPage рендерится');
  
  const dispatch = useAppDispatch();
  const { showAlert } = useAlert();
  const { user } = useAppSelector((state) => state.auth);
  const { customLists } = useAppSelector((state) => state.lists);
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Состояние
  const [movies, setMovies] = useState([]);
  const [tvShows, setTVShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [genres, setGenres] = useState({ movieGenres: [], tvGenres: [] });
  
  // Состояние для выбора списка
  const [showListSelector, setShowListSelector] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedListId, setSelectedListId] = useState('');
  
  // Параметры из URL
  const activeTab = searchParams.get('tab') || 'movies'; // movies | tv
  const currentPage = parseInt(searchParams.get('page')) || 1;
  const selectedGenre = searchParams.get('genre') || '';
  const selectedYear = searchParams.get('year') || '';
  const sortBy = searchParams.get('sort') || 'popularity.desc';
  
  // Пагинация
  const [totalPages, setTotalPages] = useState(1);

  // Загрузка списков при монтировании
  useEffect(() => {
    dispatch(fetchLists());
  }, [dispatch]);

  // Загрузка жанров при монтировании
  useEffect(() => {
    console.log('🚀 useEffect для жанров запущен');
    loadGenres();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Загрузка контента при изменении параметров
  useEffect(() => {
    loadContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentPage, selectedGenre, selectedYear, sortBy]);

  /**
   * Загрузка списка жанров
   */
  const loadGenres = async () => {
    try {
      console.log('🎬 Загрузка жанров...');
      const response = await api.get('/media/genres');
      console.log('📦 Ответ от API:', response.data);
      
      if (response.data) {
        console.log('🎭 Жанры фильмов:', response.data.movieGenres?.length || 0);
        console.log('📺 Жанры сериалов:', response.data.tvGenres?.length || 0);
        setGenres(response.data);
      } else {
        console.warn('⚠️ Пустой ответ от API');
      }
    } catch (err) {
      console.error('❌ Ошибка загрузки жанров:', err);
      console.error('Детали ошибки:', err.response?.data || err.message);
    }
  };

  /**
   * Загрузка контента (популярные или с фильтрами)
   */
  const loadContent = async () => {
    setLoading(true);
    setError(null);

    try {
      // Если есть фильтры, используем discover, иначе popular
      const hasFilters = selectedGenre || selectedYear || sortBy !== 'popularity.desc';
      
      if (hasFilters) {
        // Discover с фильтрами
        const params = {
          type: activeTab === 'movies' ? 'movie' : 'tv',
          page: currentPage,
          sortBy
        };

        if (selectedGenre) {
          params.genres = selectedGenre;
        }

        if (selectedYear) {
          params.year = selectedYear;
        }

        const response = await api.get('/media/discover', { params });
        
        if (activeTab === 'movies') {
          setMovies(response.data.results || []);
        } else {
          setTVShows(response.data.results || []);
        }
        
        setTotalPages(response.data.total_pages || 1);
      } else {
        // Популярные
        const response = await api.get('/media/popular', {
          params: {
            type: activeTab === 'movies' ? 'movie' : 'tv',
            page: currentPage
          }
        });

        if (activeTab === 'movies') {
          setMovies(response.data.movies || []);
          setTotalPages(response.data.totalMoviePages || 1);
        } else {
          setTVShows(response.data.tv || []);
          setTotalPages(response.data.totalTVPages || 1);
        }
      }
    } catch (err) {
      console.error('Ошибка загрузки контента:', err);
      setError('Не удалось загрузить контент. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Изменение вкладки (фильмы/сериалы)
   */
  const handleTabChange = (tab) => {
    setSearchParams({ tab, page: 1 });
  };

  /**
   * Изменение страницы
   */
  const handlePageChange = (page) => {
    const params = { tab: activeTab, page };
    if (selectedGenre) params.genre = selectedGenre;
    if (selectedYear) params.year = selectedYear;
    if (sortBy !== 'popularity.desc') params.sort = sortBy;
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * Изменение фильтров
   */
  const handleFilterChange = (filterType, value) => {
    const params = { tab: activeTab, page: 1 };
    
    if (filterType === 'genre') {
      if (value) params.genre = value;
      if (selectedYear) params.year = selectedYear;
      if (sortBy !== 'popularity.desc') params.sort = sortBy;
    } else if (filterType === 'year') {
      if (selectedGenre) params.genre = selectedGenre;
      if (value) params.year = value;
      if (sortBy !== 'popularity.desc') params.sort = sortBy;
    } else if (filterType === 'sort') {
      if (selectedGenre) params.genre = selectedGenre;
      if (selectedYear) params.year = selectedYear;
      if (value !== 'popularity.desc') params.sort = value;
    }
    
    setSearchParams(params);
  };

  /**
   * Сброс фильтров
   */
  const handleResetFilters = () => {
    setSearchParams({ tab: activeTab, page: 1 });
  };

  /**
   * Добавление в список
   */
  const handleAddToList = (item) => {
    setSelectedItem(item);
    setShowListSelector(true);
  };

  /**
   * Подтверждение добавления в список
   */
  const handleConfirmAddToList = async () => {
    if (!selectedListId || !selectedItem) return;

    try {
      const mediaType = activeTab === 'movies' ? 'movie' : 'tv';
      const payload = {
        listId: selectedListId,
        media: {
          tmdbId: selectedItem.id,
          mediaType
        }
      };
      
      console.log('📤 Отправка данных:', payload);
      console.log('📝 Тип tmdbId:', typeof selectedItem.id);
      
      await dispatch(addToList(payload)).unwrap();
      
      // Обновляем список после добавления
      await dispatch(fetchLists());
      
      // Закрываем модалку и очищаем состояние ПЕРЕД показом алерта
      setShowListSelector(false);
      setSelectedListId('');
      const itemTitle = selectedItem.title || selectedItem.name;
      setSelectedItem(null);
      
      await showAlert({
        title: 'Успешно!',
        message: `"${itemTitle}" добавлен в список`,
        type: 'success'
      });
    } catch (error) {
      console.error('❌ Ошибка добавления в список:', error);
      console.error('📋 Детали ошибки:', error.response?.data || error);
      
      // Обработка специфичной ошибки "уже в списке"
      if (error.code === 'ALREADY_IN_LIST' || error.response?.data?.code === 'ALREADY_IN_LIST') {
        const errorData = error.response?.data || error;
        await showAlert({
          title: 'Уже в списке',
          message: `Этот контент уже находится в списке "${errorData.existingListName}". Контент может быть только в одном списке одновременно.`,
          type: 'warning'
        });
      } else {
        await showAlert({
          title: 'Ошибка',
          message: error.response?.data?.error || error.error || 'Не удалось добавить в список. Попробуйте позже.',
          type: 'error'
        });
      }
      // Не закрываем модалку при ошибке, чтобы пользователь мог попробовать снова
    }
  };

  /**
   * Отмена выбора списка
   */
  const handleCancelListSelector = () => {
    setShowListSelector(false);
    setSelectedListId('');
    setSelectedItem(null);
  };

  /**
   * Добавление в watchlist
   */
  const handleAddToWatchlist = async (item) => {
    try {
      const mediaType = activeTab === 'movies' ? 'movie' : 'tv';
      await dispatch(addToWatchlist({
        tmdbId: item.id,
        mediaType
      })).unwrap();
      
      await showAlert({
        title: 'Успешно!',
        message: `"${item.title || item.name}" добавлен в список "Хочу посмотреть"`,
        type: 'success'
      });
    } catch (error) {
      console.error('Ошибка добавления в watchlist:', error);
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось добавить в список. Попробуйте позже.',
        type: 'error'
      });
    }
  };

  // Текущий список контента
  const currentContent = activeTab === 'movies' ? movies : tvShows;
  const currentGenres = activeTab === 'movies' ? genres.movieGenres : genres.tvGenres;
  
  // Отладка жанров
  console.log('🎯 Текущая вкладка:', activeTab);
  console.log('📚 Все жанры:', genres);
  console.log('🎭 Текущие жанры:', currentGenres);
  
  // Фильтруем списки по типу контента
  const relevantLists = customLists.filter(list => 
    list.mediaType === (activeTab === 'movies' ? 'movie' : 'tv')
  );

  // Генерация списка годов (текущий год - 50 лет назад)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 51 }, (_, i) => currentYear - i);

  return (
    <UserPageLayout user={user}>
      <div className={styles.catalogPage}>
        {/* Заголовок */}
        <div className={styles.header}>
          <h1 className={styles.title}>📚 Каталог</h1>
          <p className={styles.subtitle}>
            Популярные фильмы и сериалы
          </p>
        </div>

        {/* Вкладки */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'movies' ? styles.active : ''}`}
            onClick={() => handleTabChange('movies')}
          >
            🎬 Фильмы
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'tv' ? styles.active : ''}`}
            onClick={() => handleTabChange('tv')}
          >
            📺 Сериалы
          </button>
        </div>

        {/* Фильтры */}
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Жанр:</label>
            <select
              className={styles.filterSelect}
              value={selectedGenre}
              onChange={(e) => handleFilterChange('genre', e.target.value)}
            >
              <option value="">Все жанры</option>
              {currentGenres && currentGenres.length > 0 ? (
                currentGenres.map((genre) => (
                  <option key={genre.id} value={genre.id}>
                    {genre.name}
                  </option>
                ))
              ) : (
                <option disabled>Загрузка жанров...</option>
              )}
            </select>
            {/* Отладка */}
            {currentGenres && currentGenres.length === 0 && (
              <small style={{ color: 'red', fontSize: '0.75rem' }}>
                Жанры не загружены. Проверьте консоль.
              </small>
            )}
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Год:</label>
            <select
              className={styles.filterSelect}
              value={selectedYear}
              onChange={(e) => handleFilterChange('year', e.target.value)}
            >
              <option value="">Все годы</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Сортировка:</label>
            <select
              className={styles.filterSelect}
              value={sortBy}
              onChange={(e) => handleFilterChange('sort', e.target.value)}
            >
              <option value="popularity.desc">Популярность ↓</option>
              <option value="popularity.asc">Популярность ↑</option>
              <option value="vote_average.desc">Рейтинг ↓</option>
              <option value="vote_average.asc">Рейтинг ↑</option>
              <option value="release_date.desc">Дата выхода ↓</option>
              <option value="release_date.asc">Дата выхода ↑</option>
            </select>
          </div>

          {(selectedGenre || selectedYear || sortBy !== 'popularity.desc') && (
            <button
              className={styles.resetButton}
              onClick={handleResetFilters}
            >
              Сбросить фильтры
            </button>
          )}
        </div>

        {/* Контент */}
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Загрузка...</p>
            </div>
          ) : error ? (
            <div className={styles.error}>
              <p>{error}</p>
              <button onClick={loadContent} className={styles.retryButton}>
                Попробовать снова
              </button>
            </div>
          ) : currentContent.length > 0 ? (
            <>
              {/* Сетка медиа-контента */}
              <MediaGrid
                items={currentContent}
                mediaType={activeTab === 'movies' ? 'movie' : 'tv'}
                onAddToList={handleAddToList}
                onAddToWatchlist={handleAddToWatchlist}
              />

              {/* Пагинация */}
              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageButton}
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    ← Назад
                  </button>
                  
                  <span className={styles.pageInfo}>
                    Страница {currentPage} из {totalPages}
                  </span>
                  
                  <button
                    className={styles.pageButton}
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                  >
                    Вперед →
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className={styles.empty}>
              <p>Контент не найден</p>
              <p className={styles.emptyHint}>Попробуйте изменить фильтры</p>
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно выбора списка */}
      <ConfirmDialog
        isOpen={showListSelector}
        title="Выберите список"
        message={
          <div className={styles.listSelectorContent}>
            <p className={styles.listSelectorText}>
              Добавить "{selectedItem?.title || selectedItem?.name}" в список:
            </p>
            <select 
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
              className={styles.listSelect}
            >
              <option value="">Выберите список</option>
              {relevantLists.map(list => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
            {relevantLists.length === 0 && (
              <p className={styles.noListsMessage}>
                У вас пока нет списков. Создайте список на странице "Мои {activeTab === 'movies' ? 'фильмы' : 'сериалы'}".
              </p>
            )}
          </div>
        }
        onConfirm={handleConfirmAddToList}
        onCancel={handleCancelListSelector}
        confirmText="Добавить"
        cancelText="Отмена"
        confirmButtonStyle="primary"
        confirmDisabled={!selectedListId}
      />
    </UserPageLayout>
  );
};

export default CatalogPage;
