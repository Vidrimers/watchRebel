import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { getMediaDetails } from '../store/slices/mediaSlice';
import { 
  fetchLists, 
  addToList, 
  addToWatchlist,
  fetchEpisodeProgress,
  markEpisodeWatched,
  addRating
} from '../store/slices/listsSlice';
import EpisodeTracker from '../components/Media/EpisodeTracker';
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

  const { selectedMedia, loading: mediaLoading } = useAppSelector((state) => state.media);
  const { customLists, episodeProgress, ratings } = useAppSelector((state) => state.lists);
  const { user } = useAppSelector((state) => state.auth);

  const [selectedListId, setSelectedListId] = useState('');
  const [userRating, setUserRating] = useState(0);
  const [showListSelector, setShowListSelector] = useState(false);
  const [showRatingSelector, setShowRatingSelector] = useState(false);

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

  // Установка текущего рейтинга пользователя
  useEffect(() => {
    if (ratings[mediaId]) {
      setUserRating(ratings[mediaId]);
    }
  }, [ratings, mediaId]);

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
      alert('Добавлено в список!');
    } catch (error) {
      alert('Ошибка при добавлении в список');
    }
  };

  // Обработка добавления в watchlist
  const handleAddToWatchlist = async () => {
    if (!selectedMedia) return;

    try {
      await dispatch(addToWatchlist({
        tmdbId: selectedMedia.id,
        mediaType: selectedMedia.media_type || mediaType
      })).unwrap();
      
      alert('Добавлено в список желаемого!');
    } catch (error) {
      alert('Ошибка при добавлении в watchlist');
    }
  };

  // Обработка оценки
  const handleRating = async (rating) => {
    if (!selectedMedia) return;

    try {
      await dispatch(addRating({
        tmdbId: selectedMedia.id,
        mediaType: selectedMedia.media_type || mediaType,
        rating
      })).unwrap();
      
      setUserRating(rating);
      setShowRatingSelector(false);
      alert(`Оценка ${rating}/10 сохранена!`);
    } catch (error) {
      alert('Ошибка при сохранении оценки');
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

  return (
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
              <button 
                className={styles.actionButton}
                onClick={() => setShowListSelector(!showListSelector)}
              >
                + Добавить в список
              </button>

              <button 
                className={styles.actionButton}
                onClick={handleAddToWatchlist}
              >
                + В список желаемого
              </button>

              <button 
                className={`${styles.actionButton} ${userRating > 0 ? styles.rated : ''}`}
                onClick={() => setShowRatingSelector(!showRatingSelector)}
              >
                {userRating > 0 ? `★ ${userRating}/10` : '★ Оценить'}
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

            {/* Селектор рейтинга */}
            {showRatingSelector && (
              <div className={styles.ratingSelector}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(rating => (
                  <button
                    key={rating}
                    className={`${styles.ratingButton} ${userRating === rating ? styles.selected : ''}`}
                    onClick={() => handleRating(rating)}
                  >
                    {rating}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

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
  );
};

export default MediaDetailPage;
