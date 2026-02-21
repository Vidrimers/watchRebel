import React, { useState } from 'react';
import styles from './EpisodeTracker.module.css';

/**
 * Компонент для отслеживания просмотренных серий сериала
 * Позволяет отмечать сезоны и серии как просмотренные
 */
const EpisodeTracker = ({ 
  seriesId, 
  seasons = [], 
  currentProgress = [], 
  onMarkWatched 
}) => {
  const [expandedSeason, setExpandedSeason] = useState(null);

  // Проверка, просмотрена ли серия
  const isEpisodeWatched = (seasonNumber, episodeNumber) => {
    return currentProgress.some(
      p => p.seasonNumber === seasonNumber && p.episodeNumber === episodeNumber
    );
  };

  // Получение последней просмотренной серии в сезоне
  const getLastWatchedEpisode = (seasonNumber) => {
    const seasonProgress = currentProgress
      .filter(p => p.seasonNumber === seasonNumber)
      .sort((a, b) => b.episodeNumber - a.episodeNumber);
    
    return seasonProgress.length > 0 ? seasonProgress[0].episodeNumber : 0;
  };

  // Подсчет просмотренных серий в сезоне
  const getWatchedCount = (seasonNumber) => {
    return currentProgress.filter(p => p.seasonNumber === seasonNumber).length;
  };

  // Переключение раскрытия сезона
  const toggleSeason = (seasonNumber) => {
    setExpandedSeason(expandedSeason === seasonNumber ? null : seasonNumber);
  };

  // Обработка клика на серию
  const handleEpisodeClick = (seasonNumber, episodeNumber) => {
    if (onMarkWatched) {
      onMarkWatched(seasonNumber, episodeNumber);
    }
  };

  // Отметить все серии сезона как просмотренные
  const markSeasonWatched = (season) => {
    if (!onMarkWatched) return;
    
    for (let ep = 1; ep <= season.episodeCount; ep++) {
      if (!isEpisodeWatched(season.seasonNumber, ep)) {
        onMarkWatched(season.seasonNumber, ep);
      }
    }
  };

  if (!seasons || seasons.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>Информация о сезонах недоступна</p>
      </div>
    );
  }

  return (
    <div className={styles.episodeTracker}>
      <h3 className={styles.title}>Прогресс просмотра</h3>
      
      <div className={styles.seasonsList}>
        {seasons.map((season, index) => {
          const watchedCount = getWatchedCount(season.seasonNumber);
          const isExpanded = expandedSeason === season.seasonNumber;
          const lastWatched = getLastWatchedEpisode(season.seasonNumber);
          const progress = (watchedCount / season.episodeCount) * 100;

          return (
            <div key={`season-${season.id || season.seasonNumber || index}`} className={styles.seasonItem}>
              <div 
                className={styles.seasonHeader}
                onClick={() => toggleSeason(season.seasonNumber)}
              >
                <div className={styles.seasonInfo}>
                  <h4 className={styles.seasonTitle}>
                    {season.name || `Сезон ${season.seasonNumber}`}
                  </h4>
                  <span className={styles.seasonProgress}>
                    {watchedCount} / {season.episodeCount} серий
                  </span>
                </div>
                
                <div className={styles.seasonActions}>
                  {watchedCount < season.episodeCount && (
                    <button
                      className={styles.markAllButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        markSeasonWatched(season);
                      }}
                      title="Отметить все серии"
                    >
                      ✓ Все
                    </button>
                  )}
                  <span className={styles.expandIcon}>
                    {isExpanded ? '▼' : '▶'}
                  </span>
                </div>
              </div>

              {/* Прогресс-бар */}
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill}
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Список серий */}
              {isExpanded && (
                <div className={styles.episodesList}>
                  {Array.from({ length: season.episodeCount }, (_, i) => i + 1).map((episodeNumber) => {
                    const watched = isEpisodeWatched(season.seasonNumber, episodeNumber);
                    
                    return (
                      <button
                        key={episodeNumber}
                        className={`${styles.episodeButton} ${watched ? styles.watched : ''}`}
                        onClick={() => handleEpisodeClick(season.seasonNumber, episodeNumber)}
                        title={`Серия ${episodeNumber}`}
                      >
                        <span className={styles.episodeNumber}>{episodeNumber}</span>
                        {watched && <span className={styles.checkmark}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Информация о последней просмотренной серии */}
              {!isExpanded && lastWatched > 0 && (
                <div className={styles.lastWatched}>
                  Последняя: серия {lastWatched}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EpisodeTracker;
