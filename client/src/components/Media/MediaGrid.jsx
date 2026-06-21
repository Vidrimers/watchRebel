import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../Common/Icon';
import styles from './MediaGrid.module.css';

/**
 * Компонент сетки медиа-контента
 * Отображает фильмы/сериалы в виде сетки с постерами
 * Поддерживает hover эффекты и кнопку действий
 */
const MediaGrid = ({ items, mediaType, onAddToList, onAddToWatchlist }) => {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState(null);

  /**
   * Обработка клика на карточку
   */
  const handleCardClick = (item) => {
    const type = mediaType || (item.title ? 'movie' : 'tv');
    navigate(`/media/${type}/${item.id}`);
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
  React.useEffect(() => {
    const handleClickOutside = () => {
      if (activeMenu) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeMenu]);

  /**
   * Обработка добавления в список
   */
  const handleAddToList = (e, item) => {
    e.stopPropagation();
    setActiveMenu(null);
    if (onAddToList) {
      onAddToList(item);
    }
  };

  /**
   * Обработка добавления в watchlist
   */
  const handleAddToWatchlist = (e, item) => {
    e.stopPropagation();
    setActiveMenu(null);
    if (onAddToWatchlist) {
      onAddToWatchlist(item);
    }
  };

  if (!items || items.length === 0) {
    return (
      <div className={styles.empty}>
        <p>Контент не найден</p>
      </div>
    );
  }

  return (
    <div className={styles.mediaGrid}>
      {items.map((item) => {
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
            onMouseLeave={() => setActiveMenu(null)}
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

                {/* Кнопка действий */}
                <button
                  className={styles.actionButton}
                  onClick={(e) => toggleMenu(e, item.id)}
                  title="Действия"
                >
                  ⋮
                </button>

                {/* Выпадающее меню */}
                {activeMenu === item.id && (
                  <div className={styles.actionMenu}>
                    <button
                      className={styles.menuItem}
                      onClick={(e) => handleAddToList(e, item)}
                    >
                      <Icon name="add" size="small" /> Добавить в список
                    </button>
                    <button
                      className={styles.menuItem}
                      onClick={(e) => handleAddToWatchlist(e, item)}
                    >
                      <Icon name="watchlist" size="small" /> Хочу посмотреть
                    </button>
                  </div>
                )}
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
  );
};

export default MediaGrid;
