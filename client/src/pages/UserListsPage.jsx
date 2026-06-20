import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { fetchUserLists } from '../store/slices/listsSlice';
import UserPageLayout from '../components/Layout/UserPageLayout';
import Icon from '../components/Common/Icon';
import styles from './UserListsPage.module.css';

/**
 * Страница списков другого пользователя
 * Отображает все списки фильмов или сериалов пользователя
 */
const UserListsPage = () => {
  const { userId, mediaType } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  
  const { user: currentUser } = useAppSelector((state) => state.auth);
  const { userLists, loading } = useAppSelector((state) => state.lists);
  
  const [profileUser, setProfileUser] = useState(null);
  const [selectedList, setSelectedList] = useState(null);

  // Загрузка данных пользователя и его списков
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Загружаем профиль пользователя
        const api = (await import('../services/api')).default;
        const response = await api.get(`/users/${userId}`);
        setProfileUser(response.data);
        
        // Загружаем списки пользователя
        dispatch(fetchUserLists(userId));
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
      }
    };

    if (userId) {
      fetchData();
    }
  }, [userId, dispatch]);

  // Преобразуем mediaType из URL (movies/tv) в формат БД (movie/tv)
  const dbMediaType = mediaType === 'movies' ? 'movie' : 'tv';
  
  // Фильтруем списки по mediaType
  const filteredLists = userLists.filter(list => list.mediaType === dbMediaType);

  // Обработчик клика на список
  const handleListClick = (list) => {
    setSelectedList(list);
  };

  // Обработчик возврата к списку списков
  const handleBackToLists = () => {
    setSelectedList(null);
  };

  // Обработчик возврата к профилю
  const handleBackToProfile = () => {
    navigate(`/user/${userId}`);
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
          {selectedList ? (
            <>
              <button onClick={handleBackToLists} className={styles.breadcrumbLink}>
                {mediaType === 'movies' ? 'Фильмы' : 'Сериалы'}
              </button>
              <span className={styles.breadcrumbSeparator}>→</span>
              <span className={styles.breadcrumbCurrent}>{selectedList.name}</span>
            </>
          ) : (
            <span className={styles.breadcrumbCurrent}>
              {mediaType === 'movies' ? 'Фильмы' : 'Сериалы'}
            </span>
          )}
        </div>

        {/* Заголовок */}
        <div className={styles.header}>
          <button onClick={selectedList ? handleBackToLists : handleBackToProfile} className={styles.backButton}>
            <Icon name="arrow-left" size={20} />
          </button>
          <h1 className={styles.title}>
            {selectedList 
              ? selectedList.name
              : `${mediaType === 'movies' ? 'Фильмы' : 'Сериалы'} ${profileUser?.displayName || ''}`
            }
          </h1>
        </div>

        {/* Контент */}
        {selectedList ? (
          // Отображение фильмов в выбранном списке
          <div className={styles.mediaGrid}>
            {selectedList.items && selectedList.items.length > 0 ? (
              selectedList.items.map((item) => (
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
              <p className={styles.emptyMessage}>Список пуст</p>
            )}
          </div>
        ) : (
          // Отображение всех списков
          <div className={styles.listsGrid}>
            {filteredLists.length > 0 ? (
              filteredLists.map((list) => (
                <div
                  key={list.id}
                  className={styles.listCard}
                  onClick={() => handleListClick(list)}
                >
                  <div className={styles.listHeader}>
                    <h2 className={styles.listName}>{list.name}</h2>
                    <span className={styles.listCount}>
                      {list.items?.length || 0} {mediaType === 'movies' ? 'фильмов' : 'сериалов'}
                    </span>
                  </div>
                  {list.items && list.items.length > 0 && (
                    <div className={styles.listPreview}>
                      <div className={styles.listPreviewTrack}>
                        {[...list.items.slice(0, 10), ...list.items.slice(0, 10)].map((item, index) => (
                          <div key={`${item.id}-${index}`} className={styles.previewPoster}>
                            {item.posterPath ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w200${item.posterPath}`}
                                alt={item.title}
                              />
                            ) : (
                              <div className={styles.noPreviewPoster}>
                                <Icon name="image" size={24} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className={styles.emptyMessage}>
                У пользователя нет списков {mediaType === 'movies' ? 'фильмов' : 'сериалов'}
              </p>
            )}
          </div>
        )}
      </div>
    </UserPageLayout>
  );
};

export default UserListsPage;
