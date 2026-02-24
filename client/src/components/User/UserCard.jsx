import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../hooks/useAppSelector';
import UserAvatar from './UserAvatar';
import styles from './UserCard.module.css';

/**
 * Карточка пользователя для отображения в поиске
 * Показывает аватар, имя, любимые жанры, общие фильмы и watchlist
 */
const UserCard = ({ 
  user, 
  commonMovies = [], 
  commonWatchlist = [], 
  genrePreferences = [] 
}) => {
  const navigate = useNavigate();
  const { user: currentUser } = useAppSelector((state) => state.auth);
  
  // Проверяем, это карточка текущего пользователя или нет
  const isOwnCard = currentUser?.id === user.id;

  const handleClick = () => {
    navigate(`/user/${user.id}`);
  };

  return (
    <div className={styles.userCard} onClick={handleClick}>
      {/* Аватар */}
      <UserAvatar user={user} size="medium" className={styles.avatar} />

      {/* Информация о пользователе */}
      <div className={styles.userInfo}>
        <h3 className={styles.userName}>
          {user.displayName}
          {user.userStatus && (
            <span className={styles.userStatus}> | {user.userStatus}</span>
          )}
        </h3>
        
        {/* Telegram username показываем только для своей карточки */}
        {isOwnCard && user.telegramUsername && (
          <p className={styles.username}>@{user.telegramUsername}</p>
        )}

        {/* Любимые жанры */}
        {genrePreferences.length > 0 && (
          <div className={styles.genres}>
            <p className={styles.sectionTitle}>Любимые жанры:</p>
            <div className={styles.genreList}>
              {genrePreferences.slice(0, 3).map((genre) => (
                <span key={genre.genreId} className={styles.genreTag}>
                  {genre.genreName} ({genre.percentage}%)
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Общие просмотренные фильмы */}
        {commonMovies.length > 0 && (
          <div className={styles.commonSection}>
            <p className={styles.commonText}>
              🎬 Общих фильмов: <strong>{commonMovies.length}</strong>
            </p>
          </div>
        )}

        {/* Общие фильмы из Watchlist */}
        {commonWatchlist.length > 0 && (
          <div className={styles.commonSection}>
            <p className={styles.commonText}>
              ⭐ Общих в списке желаемого: <strong>{commonWatchlist.length}</strong>
            </p>
          </div>
        )}
      </div>

      {/* Кнопка добавить в друзья */}
      <button 
        className={styles.addFriendButton}
        onClick={(e) => {
          e.stopPropagation();
          // TODO: Реализовать добавление в друзья
          console.log('Добавить в друзья:', user.id);
        }}
      >
        👥 Добавить в друзья
      </button>
    </div>
  );
};

export default UserCard;
