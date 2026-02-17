import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { searchMedia } from '../store/slices/mediaSlice';
import UserPageLayout from '../components/Layout/UserPageLayout';
import styles from './SearchPage.module.css';

/**
 * Страница поиска с фильтрами
 * Отображает полные результаты поиска с возможностью фильтрации
 */
const SearchPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const { searchResults, loading, error } = useAppSelector((state) => state.media);
  const { user } = useAppSelector((state) => state.auth);
  
  const query = searchParams.get('q') || '';
  const [activeFilter, setActiveFilter] = useState('all'); // all, users, movies, tv

  // Выполняем поиск при загрузке страницы или изменении query
  useEffect(() => {
    if (query.trim()) {
      dispatch(searchMedia({ query, filters: {} }));
    }
  }, [query, dispatch]);

  // Фильтруем результаты по активному фильтру
  const filteredResults = searchResults.filter((result) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'users') return result.type === 'user';
    if (activeFilter === 'movies') return result.type === 'movie';
    if (activeFilter === 'tv') return result.type === 'tv';
    return true;
  });

  // Обработка клика на результат
  const handleResultClick = (result) => {
    if (result.type === 'user') {
      navigate(`/user/${result.data.id}`);
    } else {
      navigate(`/media/${result.data.mediaType}/${result.data.tmdbId}`);
    }
  };

  // Подсчет результатов по типам
  const counts = {
    all: searchResults.length,
    users: searchResults.filter((r) => r.type === 'user').length,
    movies: searchResults.filter((r) => r.type === 'movie').length,
    tv: searchResults.filter((r) => r.type === 'tv').length
  };

  return (
    <UserPageLayout user={user} narrowSidebar={true}>
      <div className={styles.searchPage}>
        {/* Заголовок */}
        <div className={styles.header}>
          <h1 className={styles.title}>
            Результаты поиска: <span className={styles.query}>"{query}"</span>
          </h1>
          <p className={styles.subtitle}>
            Найдено результатов: {filteredResults.length}
          </p>
        </div>

        {/* Фильтры */}
        <div className={styles.filters}>
          <button
            className={`${styles.filterButton} ${activeFilter === 'all' ? styles.active : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            Все ({counts.all})
          </button>
          <button
            className={`${styles.filterButton} ${activeFilter === 'users' ? styles.active : ''}`}
            onClick={() => setActiveFilter('users')}
          >
            Пользователи ({counts.users})
          </button>
          <button
            className={`${styles.filterButton} ${activeFilter === 'movies' ? styles.active : ''}`}
            onClick={() => setActiveFilter('movies')}
          >
            Фильмы ({counts.movies})
          </button>
          <button
            className={`${styles.filterButton} ${activeFilter === 'tv' ? styles.active : ''}`}
            onClick={() => setActiveFilter('tv')}
          >
            Сериалы ({counts.tv})
          </button>
        </div>

        {/* Результаты */}
        <div className={styles.results}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Поиск...</p>
            </div>
          ) : error ? (
            <div className={styles.error}>
              <p>Произошла ошибка при поиске</p>
              <p className={styles.errorMessage}>{error.message || 'Попробуйте еще раз'}</p>
            </div>
          ) : filteredResults.length > 0 ? (
            <div className={styles.resultsList}>
              {filteredResults.map((result, index) => (
                <div
                  key={`${result.type}-${result.data.id || result.data.tmdbId}-${index}`}
                  className={styles.resultCard}
                  onClick={() => handleResultClick(result)}
                >
                  {result.type === 'user' ? (
                    // Карточка пользователя
                    <div className={styles.userCard}>
                      <img
                        src={result.data.avatarUrl || '/default-avatar.png'}
                        alt={result.data.displayName}
                        className={styles.userAvatar}
                      />
                      <div className={styles.userCardInfo}>
                        <h3 className={styles.userCardName}>{result.data.displayName}</h3>
                        <p className={styles.userCardType}>Пользователь</p>
                        {result.data.telegramUsername && (
                          <p className={styles.userCardUsername}>@{result.data.telegramUsername}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Карточка медиа
                    <div className={styles.mediaCard}>
                      <img
                        src={
                          result.data.posterPath
                            ? `https://image.tmdb.org/t/p/w185${result.data.posterPath}`
                            : '/default-poster.png'
                        }
                        alt={result.data.title}
                        className={styles.mediaPoster}
                      />
                      <div className={styles.mediaCardInfo}>
                        <h3 className={styles.mediaCardTitle}>{result.data.title}</h3>
                        <p className={styles.mediaCardType}>
                          {result.data.mediaType === 'movie' ? '🎬 Фильм' : '📺 Сериал'}
                        </p>
                        {result.data.releaseDate && (
                          <p className={styles.mediaCardYear}>
                            {new Date(result.data.releaseDate).getFullYear()}
                          </p>
                        )}
                        {result.data.overview && (
                          <p className={styles.mediaCardOverview}>
                            {result.data.overview.length > 150
                              ? `${result.data.overview.substring(0, 150)}...`
                              : result.data.overview}
                          </p>
                        )}
                        {result.data.voteAverage > 0 && (
                          <div className={styles.mediaCardRating}>
                            ⭐ {result.data.voteAverage.toFixed(1)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <p>Ничего не найдено</p>
              <p className={styles.emptyHint}>Попробуйте изменить запрос или фильтры</p>
            </div>
          )}
        </div>
      </div>
    </UserPageLayout>
  );
};

export default SearchPage;
