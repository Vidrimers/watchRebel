import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import UserPageLayout from '../components/Layout/UserPageLayout';
import { useAppSelector } from '../hooks/useAppSelector';
import Icon from '../components/Common/Icon';
import api from '../services/api';
import styles from './PersonPage.module.css';

const PersonPage = () => {
  const { personId } = useParams();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFullBio, setShowFullBio] = useState(false);

  useEffect(() => {
    const loadPerson = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get(`/media/person/${personId}`);
        setPerson(response.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    };
    loadPerson();
  }, [personId]);

  if (loading) {
    return (
      <UserPageLayout user={user}>
        <div className={styles.loading}>Загрузка...</div>
      </UserPageLayout>
    );
  }

  if (error || !person) {
    return (
      <UserPageLayout user={user}>
        <div className={styles.error}>{error || 'Персона не найдена'}</div>
      </UserPageLayout>
    );
  }

  const knownFor = person.combined_credits?.cast
    ?.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
    ?.slice(0, 10) || [];

  const crewCredits = person.combined_credits?.crew
    ?.filter(c => c.department === 'Directing')
    ?.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
    ?.slice(0, 5) || [];

  const biography = person.biography || 'Биография отсутствует.';
  const displayBio = showFullBio ? biography : biography.slice(0, 500);
  const needsTruncation = biography.length > 500;

  const calculateAge = (birthday, deathday) => {
    if (!birthday) return null;
    const birth = new Date(birthday);
    const end = deathday ? new Date(deathday) : new Date();
    const age = end.getFullYear() - birth.getFullYear();
    return deathday ? `${age} лет (†)` : `${age} лет`;
  };

  const age = calculateAge(person.birthday, person.deathday);

  return (
    <UserPageLayout user={user}>
      <div className={styles.personPage}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          ← Назад
        </button>

        <div className={styles.personHeader}>
          <div className={styles.photoSection}>
            {person.profile_path ? (
              <img
                src={`https://image.tmdb.org/t/p/w400${person.profile_path}`}
                alt={person.name}
                className={styles.photo}
              />
            ) : (
              <div className={styles.noPhoto}>
                <Icon name="user" size="large" />
              </div>
            )}
          </div>

          <div className={styles.infoSection}>
            <h1 className={styles.name}>{person.name}</h1>
            
            {person.also_known_as?.length > 0 && (
              <p className={styles.alsoKnownAs}>
                Также известен как: {person.also_known_as.slice(0, 3).join(', ')}
              </p>
            )}

            <div className={styles.meta}>
              {person.birthday && (
                <span className={styles.metaItem}>
                  <Icon name="user" size="small" />
                  {person.birthday}{age && ` (${age})`}
                </span>
              )}
              {person.deathday && (
                <span className={styles.metaItem}>
                  † {person.deathday}
                </span>
              )}
              {person.place_of_birth && (
                <span className={styles.metaItem}>
                  <Icon name="pin" size="small" />
                  {person.place_of_birth}
                </span>
              )}
            </div>

            <div className={styles.bioSection}>
              <h3>Биография</h3>
              <p className={styles.bio}>
                {displayBio}
                {needsTruncation && (
                  <button
                    className={styles.readMore}
                    onClick={() => setShowFullBio(!showFullBio)}
                  >
                    {showFullBio ? ' Свернуть' : '... Читать далее'}
                  </button>
                )}
              </p>
            </div>
          </div>
        </div>

        {knownFor.length > 0 && (
          <div className={styles.creditsSection}>
            <h2>Известные работы</h2>
            <div className={styles.creditsGrid}>
              {knownFor.map((credit) => (
                <div
                  key={credit.id}
                  className={styles.creditCard}
                  onClick={() => navigate(`/media/${credit.media_type}/${credit.id}`)}
                >
                  {credit.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w185${credit.poster_path}`}
                      alt={credit.title || credit.name}
                      className={styles.creditPoster}
                    />
                  ) : (
                    <div className={styles.noCreditPoster}>
                      {credit.media_type === 'movie' ? '🎬' : '📺'}
                    </div>
                  )}
                  <div className={styles.creditInfo}>
                    <p className={styles.creditTitle}>{credit.title || credit.name}</p>
                    <p className={styles.creditRole}>
                      {credit.character && `${credit.character} • `}
                      {credit.release_date?.slice(0, 4) || credit.first_air_date?.slice(0, 4)}
                    </p>
                    {credit.vote_average > 0 && (
                      <span className={styles.creditRating}>★ {credit.vote_average.toFixed(1)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {crewCredits.length > 0 && (
          <div className={styles.creditsSection}>
            <h2>Режиссёрские работы</h2>
            <div className={styles.creditsGrid}>
              {crewCredits.map((credit) => (
                <div
                  key={credit.id}
                  className={styles.creditCard}
                  onClick={() => navigate(`/media/${credit.media_type}/${credit.id}`)}
                >
                  {credit.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w185${credit.poster_path}`}
                      alt={credit.title || credit.name}
                      className={styles.creditPoster}
                    />
                  ) : (
                    <div className={styles.noCreditPoster}>🎬</div>
                  )}
                  <div className={styles.creditInfo}>
                    <p className={styles.creditTitle}>{credit.title || credit.name}</p>
                    <p className={styles.creditRole}>
                      {credit.release_date?.slice(0, 4) || credit.first_air_date?.slice(0, 4)}
                    </p>
                    {credit.vote_average > 0 && (
                      <span className={styles.creditRating}>★ {credit.vote_average.toFixed(1)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </UserPageLayout>
  );
};

export default PersonPage;
