import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './MediaCard.module.css';

/**
 * Карточка медиа-контента (фильм или сериал)
 * Отображает постер, название, рейтинг и прогресс просмотра (для сериалов)
 */
const MediaCard = ({ 
  media, 
  showProgress = false, 
  progress = null,
  onAddToList, 
  onRate 
}) => {
  const navigate = useNavigate();

  // Обработка клика на карточку - переход на детальную страницу
  const handleClick = () => {
    navigate(`/media/${media.mediaType}/${media.tmdbId}`);
  };

  // Формирование URL постера
  const posterUrl = media.posterPath
    ? `https://image.tmdb.org/t/p/w342${media.posterPath}`
    : '/default-poster.png';

  // Форматирование даты релиза
  const releaseYear = media.releaseDate 
    ? new Date(media.releaseDate).getFullYear() 
    : null;

  return (
    <div className={styles.mediaCard} onClick={handleClick}>
      <div className={styles.posterContainer}>
        <img 
          src={posterUrl} 
          alt={media.title}
          className={styles.poster}
          loading="lazy"
        />
        
        {/* Рейтинг TMDb */}
        {media.voteAverage > 0 && (
          <div className={styles.rating}>
            <span className={styles.ratingValue}>
              {media.voteAverage.toFixed(1)}
            </span>
          </div>
        )}

        {/* Прогресс просмотра для сериалов */}
        {showProgress && progress && media.mediaType === 'tv' && (
          <div className={styles.progressBadge}>
            S{progress.seasonNumber}E{progress.episodeNumber}
          </div>
        )}
      </div>

      <div className={styles.info}>
        <h3 className={styles.title}>{media.title}</h3>
        
        <div className={styles.meta}>
          <span className={styles.type}>
            {media.mediaType === 'movie' ? 'Фильм' : 'Сериал'}
          </span>
          {releaseYear && (
            <>
              <span className={styles.separator}>•</span>
              <span className={styles.year}>{releaseYear}</span>
            </>
          )}
        </div>
      </div>

      {/* Кнопки действий (опционально) */}
      {(onAddToList || onRate) && (
        <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
          {onAddToList && (
            <button 
              className={styles.actionButton}
              onClick={() => onAddToList(media)}
              title="Добавить в список"
            >
              +
            </button>
          )}
          {onRate && (
            <button 
              className={styles.actionButton}
              onClick={() => onRate(media)}
              title="Оценить"
            >
              ★
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MediaCard;
