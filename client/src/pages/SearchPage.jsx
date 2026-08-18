import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { searchMedia } from '../store/slices/mediaSlice';
import { fetchLists, fetchWatchlist } from '../store/slices/listsSlice';
import { clearSearch } from '../store/slices/mediaSlice';
import UserPageLayout from '../components/Layout/UserPageLayout';
import UserAvatar from '../components/User/UserAvatar';
import Icon from '../components/Common/Icon';
import MediaActionMenu from '../components/Common/MediaActionMenu';
import { resolveDisplayNameWithTooltip } from '../utils/nicknameResolver';
import api from '../services/api';
import styles from './SearchPage.module.css';

/**
 * Страница поиска с фильтрами
 * Отображает полные результаты поиска с возможностью фильтрации
 */
const SearchPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const { searchResults, loading, error } = useAppSelector((state) => state.media);
  const { user } = useAppSelector((state) => state.auth);
  const { customLists, watchlist } = useAppSelector((state) => state.lists);
  
  // Состояние для друзей
  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [sentRequests, setSentRequests] = useState([]);
  
  const query = searchParams.get('q') || '';
  const tabParam = searchParams.get('tab') || '';
  const [searchInput, setSearchInput] = useState(query);
  const [activeFilter, setActiveFilter] = useState('all');

  // Очистка поиска при размонтировании компонента
  useEffect(() => {
    return () => {
      dispatch(clearSearch());
    };
  }, [dispatch]);
  
  // Состояние для добавления в друзья
  const [addingFriend, setAddingFriend] = useState(null);

  // Загрузка списков при монтировании
  useEffect(() => {
    dispatch(fetchLists());
    dispatch(fetchWatchlist());
  }, [dispatch]);

  // Загрузка списка друзей при монтировании
  useEffect(() => {
    const loadFriends = async () => {
      if (!user?.id) return;
      
      setFriendsLoading(true);
      try {
        const response = await api.get(`/users/${user.id}/friends`);
        setFriends(response.data || []);
        
        // Загружаем исходящие запросы в друзья
        const requestsResponse = await api.get('/friend-requests/sent');
        setSentRequests(requestsResponse.data.map(req => req.to_user_id));
      } catch (error) {
        console.error('Ошибка загрузки друзей:', error);
      } finally {
        setFriendsLoading(false);
      }
    };
    
    loadFriends();
  }, [user?.id]);

  // Синхронизируем локальный инпут с URL параметром
  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  // Устанавливаем активный фильтр на основе параметра tab из URL
  useEffect(() => {
    if (tabParam === 'users') {
      setActiveFilter('users');
    } else if (tabParam === 'movies') {
      setActiveFilter('movies');
    } else if (tabParam === 'tv') {
      setActiveFilter('tv');
    }
  }, [tabParam]);

  // Выполняем поиск при загрузке страницы или изменении query или фильтра
  useEffect(() => {
    if (query.trim()) {
      dispatch(searchMedia({ query, filters: { searchType: activeFilter } }));
    }
  }, [query, activeFilter, dispatch]);

  // Обработка отправки формы поиска
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSearchParams({ q: searchInput.trim() });
    }
  };

  // Очистка поля поиска
  const handleClearSearch = () => {
    setSearchInput('');
    setSearchParams({});
    dispatch(clearSearch());
  };

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

  /**
   * Проверка, является ли пользователь другом
   */
  const isFriend = (userId) => {
    return friends.some(friend => friend.id === userId);
  };

  /**
   * Проверка, отправлен ли запрос в друзья
   */
  const isRequestSent = (userId) => {
    return sentRequests.includes(userId);
  };

  /**
   * Отправка запроса в друзья
   */
  const handleAddFriend = async (e, userId, userName) => {
    e.stopPropagation();
    
    // Нельзя добавить самого себя
    if (user?.id === userId) {
      await showAlert({
        title: 'Ошибка',
        message: 'Нельзя добавить самого себя в друзья',
        type: 'error'
      });
      return;
    }
    
    setAddingFriend(userId);
    
    try {
      // Отправляем запрос в друзья
      await api.post('/friend-requests', { toUserId: userId });
      
      // Добавляем в список отправленных запросов
      setSentRequests(prev => [...prev, userId]);
      
      await showAlert({
        title: 'Запрос отправлен!',
        message: `Запрос в друзья отправлен пользователю ${userName}`,
        type: 'success'
      });
    } catch (error) {
      console.error('Ошибка отправки запроса в друзья:', error);
      
      if (error.response?.data?.code === 'ALREADY_FRIENDS') {
        await showAlert({
          title: 'Уже в друзьях',
          message: `${userName} уже в вашем списке друзей`,
          type: 'info'
        });
      } else if (error.response?.data?.code === 'REQUEST_ALREADY_SENT') {
        await showAlert({
          title: 'Запрос уже отправлен',
          message: `Вы уже отправили запрос в друзья пользователю ${userName}`,
          type: 'info'
        });
      } else {
        await showAlert({
          title: 'Ошибка',
          message: error.response?.data?.error || 'Не удалось отправить запрос в друзья',
          type: 'error'
        });
      }
    } finally {
      setAddingFriend(null);
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
    <UserPageLayout user={user}>
      <div className={styles.searchPage}>
        {/* Заголовок и поисковая форма */}
        <div className={styles.header}>
          <h1 className={styles.title}>Поиск</h1>
          
          <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
            <div className={styles.searchInputWrapper}>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Поиск фильмов, сериалов и пользователей..."
                className={styles.searchInput}
                autoFocus
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className={styles.clearButton}
                  title="Очистить"
                >
                  <Icon name="close" size="small" />
                </button>
              )}
            </div>
            <button type="submit" className={styles.searchButton}>
              <Icon name="search" size="small" /> Найти
            </button>
          </form>

          {query && (
            <p className={styles.subtitle}>
              Результаты для: <span className={styles.query}>"{query}"</span> — найдено: {filteredResults.length}
            </p>
          )}
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
          ) : !query.trim() ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>🔍</span>
              <p>Начните вводить запрос для поиска</p>
              <p className={styles.emptyHint}>Фильмы, сериалы, пользователи</p>
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
                      <UserAvatar user={result.data} size="medium" />
                      <div className={styles.userCardInfo}>
                        <h3 className={`${styles.userCardName} ${resolveDisplayNameWithTooltip(result.data.id, result.data.displayName).isNickname ? 'displayNameNickname' : ''}`} title={resolveDisplayNameWithTooltip(result.data.id, result.data.displayName).tooltip}>{resolveDisplayNameWithTooltip(result.data.id, result.data.displayName).text}</h3>
                        <p className={styles.userCardType}>Пользователь</p>
                        {/* Telegram username скрыт для других пользователей */}
                        {user?.id === result.data.id && result.data.telegramUsername && (
                          <p className={styles.userCardUsername}>@{result.data.telegramUsername}</p>
                        )}
                      </div>
                      
                      {/* Кнопка добавить в друзья (не показываем для самого себя) */}
                      {user?.id !== result.data.id && (
                        isFriend(result.data.id) ? (
                          <button
                            className={`${styles.addFriendButton} ${styles.alreadyFriend}`}
                            disabled
                            title="Уже в друзьях"
                          >
                            ✓
                          </button>
                        ) : isRequestSent(result.data.id) ? (
                          <button
                            className={`${styles.addFriendButton} ${styles.requestSent}`}
                            disabled
                            title="Запрос отправлен"
                          >
                            ⏱
                          </button>
                        ) : (
                          <button
                            className={styles.addFriendButton}
                            onClick={(e) => handleAddFriend(e, result.data.id, result.data.displayName)}
                            disabled={addingFriend === result.data.id}
                            title="Отправить запрос в друзья"
                          >
                            {addingFriend === result.data.id ? '...' : '+'}
                          </button>
                        )
                      )}
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
                          {result.data.mediaType === 'movie' ? (
                            <><Icon name="movies" size="small" /> Фильм</>
                          ) : (
                            <><Icon name="tv" size="small" /> Сериал</>
                          )}
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
                            <span><Icon name="star" size="small" /> {result.data.voteAverage.toFixed(1)}</span>
                            {(() => {
                              const inList = customLists.find(l =>
                                l.items && l.items.some(i => i.tmdbId === result.data.tmdbId && i.mediaType === result.data.mediaType)
                              );
                              const inWatchlist = watchlist.some(w => w.tmdbId === result.data.tmdbId && w.mediaType === result.data.mediaType);
                              if (!inList && !inWatchlist) return null;
                              return (
                                <>
                                  {inList && <span className={styles.statusBadge}>✓ {inList.name}</span>}
                                  {inWatchlist && <span className={styles.statusBadge}>✓ Хочу посмотреть</span>}
                                </>
                              );
                            })()}
                          </div>
                        )}
                        {/* Статус без рейтинга */}
                        {(!result.data.voteAverage || result.data.voteAverage === 0) && (() => {
                          const inList = customLists.find(l =>
                            l.items && l.items.some(i => i.tmdbId === result.data.tmdbId && i.mediaType === result.data.mediaType)
                          );
                          const inWatchlist = watchlist.some(w => w.tmdbId === result.data.tmdbId && w.mediaType === result.data.mediaType);
                          if (!inList && !inWatchlist) return null;
                          return (
                            <div className={styles.mediaCardRating}>
                              {inList && <span className={styles.statusBadge}>✓ {inList.name}</span>}
                              {inWatchlist && <span className={styles.statusBadge}>✓ Хочу посмотреть</span>}
                            </div>
                          );
                        })()}
                      </div>
                      
                      {/* Меню действий */}
                      <MediaActionMenu
                        media={{
                          tmdbId: result.data.tmdbId,
                          mediaType: result.data.mediaType,
                          title: result.data.title
                        }}
                        showStatus={false}
                      />
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
