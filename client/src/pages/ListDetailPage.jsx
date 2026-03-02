import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import MediaCard from '../components/Media/MediaCard';
import Icon from '../components/Common/Icon';
import styles from './ListDetailPage.module.css';

/**
 * Страница просмотра конкретного списка (любого пользователя)
 */
const ListDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchList = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/lists/${id}`);
        setList(response.data);
      } catch (err) {
        console.error('Ошибка загрузки списка:', err);
        setError(err.response?.data?.error || 'Не удалось загрузить список');
      } finally {
        setLoading(false);
      }
    };

    fetchList();
  }, [id]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p>{error}</p>
          <button onClick={() => navigate(-1)}>Назад</button>
        </div>
      </div>
    );
  }

  if (!list) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          ← Назад
        </button>
        
        <div className={styles.listInfo}>
          <h1 className={styles.listName}>{list.name}</h1>
          <div className={styles.listMeta}>
            <span 
              className={styles.ownerLink}
              onClick={() => navigate(`/user/${list.owner.id}`)}
            >
              {list.owner.avatarUrl && (
                <img 
                  src={list.owner.avatarUrl.startsWith('http') 
                    ? list.owner.avatarUrl 
                    : `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${list.owner.avatarUrl}`
                  }
                  alt={list.owner.displayName}
                  className={styles.ownerAvatar}
                />
              )}
              {list.owner.displayName}
            </span>
            <span className={styles.separator}>•</span>
            <span className={styles.mediaType}>
              <Icon name={list.mediaType === 'movie' ? 'movies' : 'tv'} size="small" />
              {list.mediaType === 'movie' ? 'Фильмы' : 'Сериалы'}
            </span>
            <span className={styles.separator}>•</span>
            <span className={styles.count}>{list.items.length} элементов</span>
          </div>
        </div>
      </div>

      {list.items.length === 0 ? (
        <div className={styles.empty}>
          <p>В этом списке пока нет элементов</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {list.items.map((item) => (
            <MediaCard
              key={item.id}
              media={{
                tmdbId: item.tmdbId,
                mediaType: item.mediaType,
                title: item.title,
                posterPath: item.posterPath,
                releaseDate: item.releaseDate,
                voteAverage: item.voteAverage
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ListDetailPage;
