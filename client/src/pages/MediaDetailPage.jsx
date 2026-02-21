import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { getMediaDetails } from '../store/slices/mediaSlice';
import { 
  fetchLists, 
  addToList, 
  addToWatchlist,
  removeFromWatchlist,
  fetchEpisodeProgress,
  markEpisodeWatched
} from '../store/slices/listsSlice';
import { EpisodeTracker, RatingSelector } from '../components/Media';
import useAlert from '../hooks/useAlert.jsx';
import styles from './MediaDetailPage.module.css';

/**
 * Детальная страница медиа-контента
 * Отображает полную информацию о фильме/сериале
 * Позволяет добавлять в списки, оценивать, отслеживать прогресс
 */
const MediaDetailPage = () => {
  const { mediaType, mediaId } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { alertDialog, showAlert } = useAlert();

  const { selectedMedia, loading: mediaLoading } = useAppSelector((state) => state.media);
  const { customLists, episodeProgress, ratings, watchlist } = useAppSelector((state) => state.lists);
  const { user } = useAppSelector((state) => state.auth);

  const [selectedListId, setSelectedListId] = useState('');
  const [showListSelector, setShowListSelector] = useState(false);

  // Загрузка данных при монтировании
  useEffect(() => {
    if (mediaType && mediaId) {
      dispatch(getMediaDetails({ type: mediaType, id: mediaId }));
      dispatch(fetchLists());
      
      // Для сериалов загружаем прогресс
      if (mediaType === 'tv') {
        dispatch(fetchEpisodeProgress(mediaId));
      }
    }
  }, [dispatch, mediaType, mediaId]);

  // Обработка добавления в список
  const handleAddToList = async () => {
    if (!selectedListId || !selectedMedia) return;

    try {
      await dispatch(addToList({
        listId: selectedListId,
        media: {
          tmdbId: selectedMedia.id,
          mediaType: selectedMedia.media_type || mediaType
        }
      })).unwrap();
      
      setShowListSelector(false);
      setSelectedListId('');
      await showAlert({
        title: 'Успешно!',
        message: 'Контент добавлен в список',
        type: 'success'
      });
    } catch (error) {
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось добавить в список',
        type: 'error'
      });
    }
  };

  // Обработка добавления/удаления из watchlist
  const handleToggleWatchlist = async () => {
    if (!selectedMedia) return;

    try {
      if (isInWatchlist) {
        // Находим элемент в watchlist
        const watchlistItem = watchlist.find(
          item => item.tmdbId === parseInt(mediaId) && item.mediaType === (selectedMedia.media_type || mediaType)
        );
        
        if (watchlistItem) {
          await dispatch(removeFromWatchlist(watchlistItem.id)).unwrap();
          
          await showAlert({
            title: 'Успешно!',
            message: 'Удалено из списка желаемого',
            type: 'success'
          });
        }
      } else {
        await dispatch(addToWatchlist({
          tmdbId: selectedMedia.id,
          mediaType: selectedMedia.media_type || mediaType
        })).unwrap();
        
        await showAlert({
          title: 'Успешно!',
          message: 'Добавлено в список желаемого',
          type: 'success'
        });
      }
    } catch (error) {
      await showAlert({
        title: 'Ошибка',
        message: isInWatchlist 
          ? 'Не удалось удалить из списка желаемого'
          : 'Не удалось добавить в список желаемого',
        type: 'error'
      });
    }
  };

  // Обработка отметки серии
  const handleMarkWatched = async (seasonNumber, episodeNumber) => {
    if (!selectedMedia) return;

    try {
      await dispatch(markEpisodeWatched({
        tmdbId: selectedMedia.id,
        seasonNumber,
        episodeNumber
      })).unwrap();
    } catch (error) {
      console.error('Ошибка при отметке серии:', error);
    }
  };

  if (mediaLoading || !selectedMedia) {
    return (
      <div className={styles.loading}>
        <p>Загрузка...</p>
      </div>
    );
  }

  const backdropUrl = selectedMedia.backdrop_path
    ? `https://image.tmdb.org/t/p/original${selectedMedia.backdrop_path}`
    : null;

  const posterUrl = selectedMedia.poster_path
    ? `https://image.tmdb.org/t/p/w500${selectedMedia.poster_path}`
    : '/default-poster.png';

  const releaseYear = selectedMedia.release_date || selectedMedia.first_air_date
    ? new Date(selectedMedia.release_date || selectedMedia.first_air_date).getFullYear()
    : null;

  // Фильтруем списки по типу медиа
  const relevantLists = customLists.filter(
    list => list.mediaType === (selectedMedia.media_type || mediaType)
  );

  const currentProgress = episodeProgress[mediaId] || [];
  
  // Получаем текущий рейтинг пользователя
  const currentRating = ratings[mediaId] || null;

  // Проверяем, в каком списке находится элемент
  const isInWatchlist = watchlist.some(
    item => item.tmdbId === parseInt(mediaId) && item.mediaType === (selectedMedia.media_type || mediaType)
  );

  // Находим список, в котором находится элемент
  const currentList = customLists.find(list => 
    list.items && list.items.some(
      item => item.tmdbId === parseInt(mediaId) && item.mediaType === (selectedMedia.media_type || mediaType)
    )
  );

  return (
    <>
      {alertDialog}
      <div className={styles.mediaDetailPage}>
      {/* Фоновое изображение */}
      {backdropUrl && (
        <div 
          className={styles.backdrop}
          style={{ backgroundImage: `url(${backdropUrl})` }}
        />
      )}

      <div className={styles.content}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          ← Назад
        </button>

        <div className={styles.mainInfo}>
          {/* Постер */}
          <div className={styles.posterSection}>
            <img src={posterUrl} alt={selectedMedia.title || selectedMedia.name} className={styles.poster} />
          </div>

          {/* Информация */}
          <div className={styles.infoSection}>
            <h1 className={styles.title}>
              {selectedMedia.title || selectedMedia.name}
            </h1>

            {selectedMedia.original_title && selectedMedia.original_title !== selectedMedia.title && (
              <p className={styles.originalTitle}>
                {selectedMedia.original_title || selectedMedia.original_name}
              </p>
            )}

            <div className={styles.meta}>
              <span className={styles.type}>
                {(selectedMedia.media_type || mediaType) === 'movie' ? 'Фильм' : 'Сериал'}
              </span>
              {releaseYear && (
                <>
                  <span className={styles.separator}>•</span>
                  <span>{releaseYear}</span>
                </>
              )}
              {selectedMedia.vote_average > 0 && (
                <>
                  <span className={styles.separator}>•</span>
                  <span className={styles.rating}>
                    ★ {selectedMedia.vote_average.toFixed(1)}
                  </span>
                </>
              )}
            </div>

            {selectedMedia.overview && (
              <p className={styles.overview}>{selectedMedia.overview}</p>
            )}

            {/* Действия */}
            <div className={styles.actions}>
              {currentList ? (
                <button 
                  className={`${styles.actionButton} ${styles.inList}`}
                  disabled
                >
                  ✓ В списке: {currentList.name}
                </button>
              ) : (
                <button 
                  className={styles.actionButton}
                  onClick={() => setShowListSelector(!showListSelector)}
                >
                  + Добавить в список
                </button>
              )}

              <button 
                className={`${styles.actionButton} ${isInWatchlist ? styles.inWatchlist : ''}`}
                onClick={handleToggleWatchlist}
              >
                {isInWatchlist ? '✓ В списке желаемого' : '+ В список желаемого'}
              </button>
            </div>

            {/* Селектор списка */}
            {showListSelector && (
              <div className={styles.selector}>
                <select 
                  value={selectedListId}
                  onChange={(e) => setSelectedListId(e.target.value)}
                  className={styles.select}
                >
                  <option value="">Выберите список</option>
                  {relevantLists.map(list => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </select>
                <button 
                  className={styles.confirmButton}
                  onClick={handleAddToList}
                  disabled={!selectedListId}
                >
                  Добавить
                </button>
              </div>
            )}

            {/* Компонент рейтинга */}
            <RatingSelector
              media={{
                tmdbId: selectedMedia.id,
                mediaType: selectedMedia.media_type || mediaType,
                title: selectedMedia.title || selectedMedia.name
              }}
              currentRating={currentRating}
              onRatingSet={async (rating) => {
                await showAlert({
                  title: 'Оценка сохранена!',
                  message: `Оценка ${rating}/10 добавлена на стену`,
                  type: 'success'
                });
              }}
            />
          </div>
        </div>

        {/* Актёры и съёмочная группа */}
        {selectedMedia.credits && (
          <div className={styles.creditsSection}>
            {/* Актёры */}
            {selectedMedia.credits.cast && selectedMedia.credits.cast.length > 0 && (
              <div className={styles.castSection}>
                <h2 className={styles.sectionTitle}>Актёры</h2>
                <div className={styles.castGrid}>
                  {selectedMedia.credits.cast.slice(0, 12).map((person) => (
                    <div key={person.id} className={styles.castCard}>
                      <div className={styles.castPhoto}>
                        {person.profile_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
                            alt={person.name}
                            className={styles.castImage}
                          />
                        ) : (
                          <div className={styles.noPhoto}>👤</div>
                        )}
                      </div>
                      <div className={styles.castInfo}>
                        <p className={styles.castName}>{person.name}</p>
                        <p className={styles.castCharacter}>{person.character}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Съёмочная группа */}
            {selectedMedia.credits.crew && selectedMedia.credits.crew.length > 0 && (
              <div className={styles.crewSection}>
                <h2 className={styles.sectionTitle}>Съёмочная группа</h2>
                <div className={styles.crewList}>
                  {/* Режиссёры */}
                  {selectedMedia.credits.crew
                    .filter(person => person.job === 'Director')
                    .slice(0, 3)
                    .map((person) => (
                      <div key={`director-${person.id}`} className={styles.crewItem}>
                        <span className={styles.crewRole}>Режиссёр:</span>
                        <span className={styles.crewName}>{person.name}</span>
                      </div>
                    ))}
                  
                  {/* Сценаристы */}
                  {selectedMedia.credits.crew
                    .filter(person => person.job === 'Screenplay' || person.job === 'Writer')
                    .slice(0, 3)
                    .map((person) => (
                      <div key={`writer-${person.id}`} className={styles.crewItem}>
                        <span className={styles.crewRole}>Сценарист:</span>
                        <span className={styles.crewName}>{person.name}</span>
                      </div>
                    ))}
                  
                  {/* Продюсеры */}
                  {selectedMedia.credits.crew
                    .filter(person => person.job === 'Producer')
                    .slice(0, 3)
                    .map((person) => (
                      <div key={`producer-${person.id}`} className={styles.crewItem}>
                        <span className={styles.crewRole}>Продюсер:</span>
                        <span className={styles.crewName}>{person.name}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Трекер серий для сериалов */}
        {(selectedMedia.media_type || mediaType) === 'tv' && selectedMedia.seasons && (
          <div className={styles.episodeSection}>
            <EpisodeTracker
              seriesId={selectedMedia.id}
              seasons={selectedMedia.seasons}
              currentProgress={currentProgress}
              onMarkWatched={handleMarkWatched}
            />
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default MediaDetailPage;
