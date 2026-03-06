import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { fetchUserWatchlist } from '../store/slices/listsSlice';
import UserPageLayout from '../components/Layout/UserPageLayout';
import MediaTypeToggle from '../components/Common/MediaTypeToggle';
import Icon from '../components/Common/Icon';
import styles from './UserWatchlistPage.module.css';

/**
 * Страница watchlist другого пользователя
 * Отображает список "Хочу посмотреть" с переключателем фильмы/сериалы
 */
const UserWatchlistPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  
  const { user: currentUser } = useAppSelector((state) => state.auth);
  const { userWatchlist, loading } = useAppSelector((state) => state.lists);
  
  const [profileUser, setProfileUser] = useState(null);
  const [mediaType, setMediaType] = useState('movie');

  // Загрузка данных пользователя и его watchlist
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Загружаем профиль пользователя
        const api = (await import('../services/api')).default;
        const response = await api.get(`/users/${userId}`);
        setProfileUser(response.data);
        
        // Загружаем watchlist пользователя
        dispatch(fetchUserWatchlist(userId));
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
      }
    };

    if (userId) {
      fetchData();
    }
  }, [userId, dispatch]);

  // Фильтруем watchlist по mediaType
  const filteredWatchlist = userWatchlist.filter(item => item.mediaType === mediaType);

  // Обработчик возврата к профилю
  const handleBackToProfile = () => {
    navigate(`/user/${userId}`);
  };

  // Обработчик изменения типа медиа
  const handleMediaTypeChange = (newMediaType) => {
    setMediaType(newMediaType);
  };

  if (loading) {
    return (
      <UserPageLayout user={currentUser}>
        <div className={styles.container}>
          <p>Загрузка...</p>
        </div>
      </UserPageLayout>
    );
  }

  return (
    <UserPageLayout user={currentUser}>
      <div className={styles.container}>
        {/* Breadcrumbs */}
        <div className={styles.breadcrumbs}>
          <button onClick={handleBackToProfile} className={styles.breadcrumbLink}>
            Профиль
          </button>
          <span className={styles.breadcrumbSeparator}>→</span>
          <span className={styles.breadcrumbCurrent}>Хочу посмотреть</span>
        </div>

        {/* Заголовок */}
        <div className={styles.header}>
          <button onClick={handleBackToProfile} className={styles.backButton}>
            <Icon name="arrow-left" size={20} />
          </button>
          <h1 className={styles.title}>
            Хочу посмотреть {profileUser?.displayName || ''}
          </h1>
        </div>

        {/* Переключатель типа медиа */}
        <MediaTypeToggle 
          mediaType={mediaType} 
          onChange={handleMediaTypeChange} 
        />

        {/* Сетка фильмов/сериалов */}
        <div className={styles.mediaGrid}>
          {filteredWatchlist.length > 0 ? (
            filteredWatchlist.map((item) => (
              <div key={item.id} className={styles.mediaCard}>
                <div className={styles.posterContainer}>
                  {item.posterPath ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w500${item.posterPath}`}
                      alt={item.title}
                      className={styles.poster}
                    />
                  ) : (
                    <div className={styles.noPoster}>
                      <Icon name="image" size={48} />
                    </div>
                  )}
                  <div className={styles.overlay}>
                    <button
                      className={styles.addButton}
                      onClick={() => {/* TODO: Открыть AddToListModal */}}
                      title="Добавить в свой список"
                    >
                      <Icon name="plus" size={20} />
                      Добавить в свой список
                    </button>
                  </div>
                </div>
                <div className={styles.mediaInfo}>
                  <h3 className={styles.mediaTitle}>{item.title}</h3>
                  {item.releaseDate && (
                    <p className={styles.mediaYear}>
                      {new Date(item.releaseDate).getFullYear()}
                    </p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className={styles.emptyMessage}>
              Список пуст
            </p>
          )}
        </div>
      </div>
    </UserPageLayout>
  );
};

export default UserWatchlistPage;
