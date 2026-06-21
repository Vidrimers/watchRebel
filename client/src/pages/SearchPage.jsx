import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { searchMedia } from '../store/slices/mediaSlice';
import { fetchLists, addToList, addToWatchlist } from '../store/slices/listsSlice';
import { clearSearch } from '../store/slices/mediaSlice';
import UserPageLayout from '../components/Layout/UserPageLayout';
import Icon from '../components/Common/Icon';
import { resolveDisplayNameWithTooltip } from '../utils/nicknameResolver';
import useAlert from '../hooks/useAlert';
import ConfirmDialog from '../components/Common/ConfirmDialog';
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
  const { showAlert } = useAlert();
  
  const { searchResults, loading, error } = useAppSelector((state) => state.media);
  const { user } = useAppSelector((state) => state.auth);
  const { customLists } = useAppSelector((state) => state.lists);
  
  // Состояние для друзей
  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [sentRequests, setSentRequests] = useState([]); // ID пользователей, которым отправлены запросы
  
  const query = searchParams.get('q') || '';
  const tabParam = searchParams.get('tab') || ''; // Параметр вкладки из URL
  const [searchInput, setSearchInput] = useState(query);
  const [activeFilter, setActiveFilter] = useState('all'); // all, users, movies, tv
  const [activeMenu, setActiveMenu] = useState(null);

  // Очистка поиска при размонтировании компонента
  useEffect(() => {
    return () => {
      // При уходе со страницы очищаем результаты поиска
      dispatch(clearSearch());
    };
  }, [dispatch]);
  
  // Состояние для выбора списка
  const [showListSelector, setShowListSelector] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedListId, setSelectedListId] = useState('');
  
  // Состояние для добавления в друзья
  const [addingFriend, setAddingFriend] = useState(null); // ID пользователя, которого добавляем

  // Загрузка списков при монтировании
  useEffect(() => {
    dispatch(fetchLists());
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
   * Открытие/закрытие меню действий
   */
  const toggleMenu = (e, itemId) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === itemId ? null : itemId);
  };

  /**
   * Закрытие меню при клике вне его
   */
  useEffect(() => {
    const handleClickOutside = () => {
      if (activeMenu) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeMenu]);

  /**
   * Добавление в список
   */
  const handleAddToList = (e, result) => {
    e.stopPropagation();
    setActiveMenu(null);
    setSelectedItem(result.data);
    setShowListSelector(true);
  };

  /**
   * Подтверждение добавления в список
   */
  const handleConfirmAddToList = async () => {
    if (!selectedListId || !selectedItem) return;

    try {
      const payload = {
        listId: selectedListId,
        media: {
          tmdbId: selectedItem.tmdbId,
          mediaType: selectedItem.mediaType
        }
      };
      
      await dispatch(addToList(payload)).unwrap();
      await dispatch(fetchLists());
      
      setShowListSelector(false);
      setSelectedListId('');
      const itemTitle = selectedItem.title;
      setSelectedItem(null);
      
      await showAlert({
        title: 'Успешно!',
        message: `"${itemTitle}" добавлен в список`,
        type: 'success'
      });
    } catch (error) {
      console.error('Ошибка добавления в список:', error);
      
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
          message: error.response?.data?.error || error.error || 'Не удалось добавить в список',
          type: 'error'
        });
      }
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
  const handleAddToWatchlist = async (e, result) => {
    e.stopPropagation();
    setActiveMenu(null);
    
    try {
      await dispatch(addToWatchlist({
        tmdbId: result.data.tmdbId,
        mediaType: result.data.mediaType
      })).unwrap();
      
      await showAlert({
        title: 'Успешно!',
        message: `"${result.data.title}" добавлен в список "Хочу посмотреть"`,
        type: 'success'
      });
    } catch (error) {
      console.error('Ошибка добавления в watchlist:', error);
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось добавить в список',
        type: 'error'
      });
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

  // Фильтруем списки по типу контента для модального окна
  const relevantLists = selectedItem ? customLists.filter(list => 
    list.mediaType === selectedItem.mediaType
  ) : [];

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
                      <img
                        src={
                          result.data.avatarUrl?.startsWith('/uploads/')
                            ? `${import.meta.env.VITE_API_URL || ''}${result.data.avatarUrl}`
                            : result.data.avatarUrl || '/default-avatar.png'
                        }
                        alt={result.data.displayName}
                        className={styles.userAvatar}
                      />
                      <div className={styles.userCardInfo}>
                        <h3 className={styles.userCardName}>{resolveDisplayNameWithTooltip(result.data.id, result.data.displayName).text}</h3>
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
                            <Icon name="star" size="small" /> {result.data.voteAverage.toFixed(1)}
                          </div>
                        )}
                      </div>
                      
                      {/* Кнопка действий */}
                      <button
                        className={styles.actionButton}
                        onClick={(e) => toggleMenu(e, result.data.tmdbId)}
                        title="Действия"
                      >
                        ⋮
                      </button>

                      {/* Выпадающее меню */}
                      {activeMenu === result.data.tmdbId && (
                        <div className={styles.actionMenu}>
                          <button
                            className={styles.menuItem}
                            onClick={(e) => handleAddToList(e, result)}
                          >
                            📋 Добавить в список
                          </button>
                          <button
                            className={styles.menuItem}
                            onClick={(e) => handleAddToWatchlist(e, result)}
                          >
                            <Icon name="watchlist" size="small" /> Хочу посмотреть
                          </button>
                        </div>
                      )}
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

      {/* Модальное окно выбора списка */}
      <ConfirmDialog
        isOpen={showListSelector}
        onClose={handleCancelListSelector}
        onConfirm={handleConfirmAddToList}
        title="Добавить в список"
        confirmText="Добавить"
        cancelText="Отмена"
      >
        <div className={styles.listSelectorContent}>
          <p className={styles.listSelectorText}>
            Выберите список для добавления:
          </p>
          {relevantLists.length > 0 ? (
            <select
              className={styles.listSelect}
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
            >
              <option value="">-- Выберите список --</option>
              {relevantLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          ) : (
            <p className={styles.noListsMessage}>
              Нет доступных списков для этого типа контента.
              Создайте список в разделе "Мои списки".
            </p>
          )}
        </div>
      </ConfirmDialog>
    </UserPageLayout>
  );
};

export default SearchPage;
