import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import PublicHeader from '../components/Layout/PublicHeader';
import api from '../services/api';
import styles from './PublicCatalogPage.module.css';

/**
 * Публичная страница каталога для незарегистрированных пользователей
 * Отображает популярные фильмы и сериалы без возможности добавления в списки
 */
const PublicCatalogPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Состояние
  const [movies, setMovies] = useState([]);
  const [tvShows, setTVShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [genres, setGenres] = useState({ movieGenres: [], tvGenres: [] });
  
  // Параметры из URL
  const activeTab = searchParams.get('tab') || 'movies';
  const currentPage = parseInt(searchParams.get('page')) || 1;
  const selectedGenre = searchParams.get('genre') || '';
  const selectedYear = searchParams.get('year') || '';
  const sortBy = searchParams.get('sort') || 'popularity.desc';
  
  // Пагинация
  const [totalPages, setTotalPages] = useState(1);

  // Загрузка жанров при монтировании
  useEffect(() => {
    loadGenres();
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
      const response = await api.get('/media/genres');
      if (response.data) {
        setGenres(response.data);
      }
    } catch (err) {
      console.error('Ошибка загрузки жанров:', err);
    }
  };

  /**
   * Загрузка контента
   */
  const loadContent = async () => {
    setLoading(true);
    setError(null);

    try {
      const hasFilters = selectedGenre || selectedYear || sortBy !== 'popularity.desc';
      
      if (hasFilters) {
        const params = {
          type: activeTab === 'movies' ? 'movie' : 'tv',
          page: currentPage,
          sortBy
        };

        if (selectedGenre) params.genres = selectedGenre;
        if (selectedYear) params.year = selectedYear;

        const response = await api.get('/media/discover', { params });
        
        if (activeTab === 'movies') {
          setMovies(response.data.results || []);
        } else {
          setTVShows(response.data.results || []);
        }
        
        setTotalPages(response.data.total_pages || 1);
      } else {
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
   * Изменение вкладки
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
   * Обработка клика на карточку
   */
  const handleCardClick = (item) => {
    const type = activeTab === 'movies' ? 'movie' : 'tv';
    navigate(`/media/${type}/${item.id}`);
  };

  // Текущий список контента
  const currentContent = activeTab === 'movies' ? movies : tvShows;
  const currentGenres = activeTab === 'movies' ? genres.movieGenres : genres.tvGenres;

  // Генерация списка годов
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 51 }, (_, i) => currentYear - i);

  return (
    <div className={styles.publicCatalogPage}>
      {/* Header */}
      <PublicHeader />

      {/* Main Content */}
      <main className={styles.mainContent}>
        {/* Заголовок */}
        <div className={styles.pageHeader}>
          <h2 className={styles.title}>📚 Каталог фильмов и сериалов</h2>
          <p className={styles.subtitle}>
            Популярные фильмы и сериалы. Зарегистрируйтесь, чтобы добавлять в свои списки!
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
              <div className={styles.mediaGrid}>
                {currentContent.map((item) => {
                  const title = item.title || item.name;
                  const releaseDate = item.release_date || item.first_air_date;
                  const year = releaseDate ? new Date(releaseDate).getFullYear() : null;
                  const posterUrl = item.poster_path
                    ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
                    : '/default-poster.png';

                  return (
                    <div
                      key={item.id}
                      className={styles.mediaCard}
                      onClick={() => handleCardClick(item)}
                    >
                      {/* Постер */}
                      <div className={styles.posterContainer}>
                        <img
                          src={posterUrl}
                          alt={title}
                          className={styles.poster}
                          loading="lazy"
                        />
                        
                        {/* Overlay с информацией при hover */}
                        <div className={styles.overlay}>
                          <div className={styles.overlayContent}>
                            <h3 className={styles.overlayTitle}>{title}</h3>
                            {year && (
                              <p className={styles.overlayYear}>{year}</p>
                            )}
                            {item.vote_average > 0 && (
                              <div className={styles.overlayRating}>
                                ⭐ {item.vote_average.toFixed(1)}
                              </div>
                            )}
                            {item.overview && (
                              <p className={styles.overlayOverview}>
                                {item.overview.length > 100
                                  ? `${item.overview.substring(0, 100)}...`
                                  : item.overview}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Информация под постером */}
                      <div className={styles.cardInfo}>
                        <h3 className={styles.cardTitle} title={title}>
                          {title}
                        </h3>
                        {year && (
                          <p className={styles.cardYear}>{year}</p>
                        )}
                        {item.vote_average > 0 && (
                          <div className={styles.cardRating}>
                            ⭐ {item.vote_average.toFixed(1)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

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
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <p className={styles.copyright}>
            © 2026 watchRebel. Социальная сеть для любителей кино и сериалов.
          </p>
          <div className={styles.links}>
            <a href="/about" className={styles.link}>О проекте</a>
            <span className={styles.separator}>•</span>
            <a href="/privacy" className={styles.link}>Конфиденциальность</a>
            <span className={styles.separator}>•</span>
            <a href="/terms" className={styles.link}>Условия использования</a>
            <span className={styles.separator}>•</span>
            <a href="/advertising-contacts" className={styles.link}>Контакты для рекламы</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicCatalogPage;
