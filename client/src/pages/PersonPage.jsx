import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { searchMedia, clearSearch } from '../store/slices/mediaSlice';
import Icon from '../components/Common/Icon';
import UserAvatar from '../components/User/UserAvatar';
import api from '../services/api';
import styles from './PersonPage.module.css';

const PersonPage = () => {
  const { personId } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { searchResults } = useAppSelector((state) => state.media);
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFullBio, setShowFullBio] = useState(false);
  const [showAllCredits, setShowAllCredits] = useState(false);

  const [topSearchQuery, setTopSearchQuery] = useState('');
  const [showSearchPreview, setShowSearchPreview] = useState(false);
  const [topSearchLoading, setTopSearchLoading] = useState(false);
  const topSearchRef = useRef(null);
  const topSearchDebounceRef = useRef(null);

  // Debounce для поиска
  useEffect(() => {
    if (topSearchDebounceRef.current) clearTimeout(topSearchDebounceRef.current);
    if (topSearchQuery.trim().length > 0) {
      topSearchDebounceRef.current = setTimeout(() => {
        setTopSearchLoading(true);
        dispatch(searchMedia({ query: topSearchQuery, filters: {} }))
          .finally(() => setTopSearchLoading(false));
        setShowSearchPreview(true);
      }, 300);
    } else {
      setShowSearchPreview(false);
      setTopSearchLoading(false);
    }
    return () => { if (topSearchDebounceRef.current) clearTimeout(topSearchDebounceRef.current); };
  }, [topSearchQuery, dispatch]);

  // Закрытие preview при клике вне
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (topSearchRef.current && !topSearchRef.current.contains(e.target)) {
        setShowSearchPreview(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Escape для возврата
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (window.history.length > 1) navigate(-1);
        else navigate('/');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const handleTopSearchResultClick = useCallback((result) => {
    setShowSearchPreview(false);
    setTopSearchQuery('');
    dispatch(clearSearch());
    if (result.type === 'user') navigate(`/user/${result.data.id}`);
    else navigate(`/media/${result.data.mediaType}/${result.data.tmdbId}`);
  }, [navigate, dispatch]);

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
    return <div className={styles.loading}>Загрузка...</div>;
  }

  if (error || !person) {
    return <div className={styles.error}>{error || 'Персона не найдена'}</div>;
  }

  const castCredits = person.combined_credits?.cast
    ?.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0)) || [];

  const crewCredits = person.combined_credits?.crew || [];

  const directingCredits = crewCredits
    .filter(c => c.department === 'Directing')
    .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));

  const writingCredits = crewCredits
    .filter(c => c.department === 'Writing')
    .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));

  const productionCredits = crewCredits
    .filter(c => c.department === 'Production')
    .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));

  const displayedCast = showAllCredits ? castCredits : castCredits.slice(0, 10);
  const displayedDirecting = showAllCredits ? directingCredits : directingCredits.slice(0, 5);

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

  const renderCreditCard = (credit) => (
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
  );

  return (
    <>
      {/* Верхняя навигационная полоска */}
      <div className={styles.topBar}>
        <button className={styles.topBarBack} onClick={() => {
          if (window.history.length > 1) navigate(-1);
          else navigate('/');
        }}>
          ← Назад
        </button>
        <div className={styles.topBarSearch} ref={topSearchRef}>
          <input
            type="text"
            placeholder="Поиск"
            className={styles.topBarSearchInput}
            value={topSearchQuery}
            onChange={(e) => setTopSearchQuery(e.target.value)}
            onFocus={() => topSearchQuery.trim() && setShowSearchPreview(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && topSearchQuery.trim()) {
                setShowSearchPreview(false);
                navigate(`/search?q=${encodeURIComponent(topSearchQuery.trim())}`);
              }
            }}
          />
          <button
            className={styles.topBarSearchBtn}
            onClick={() => {
              setShowSearchPreview(false);
              navigate(topSearchQuery.trim() ? `/search?q=${encodeURIComponent(topSearchQuery.trim())}` : '/search');
            }}
          >
            <Icon name="search" size="small" />
          </button>

          {showSearchPreview && topSearchQuery.trim() && (
            <div className={styles.topSearchPreview}>
              {topSearchLoading ? (
                <div className={styles.topSearchPreviewLoading}>Поиск...</div>
              ) : Array.isArray(searchResults) && searchResults.length > 0 ? (
                <>
                  <ul className={styles.topSearchPreviewList}>
                    {searchResults.slice(0, 5).map((result, index) => (
                      <li
                        key={`${result.type}-${result.data.id || result.data.tmdbId}-${index}`}
                        className={styles.topSearchPreviewItem}
                        onClick={() => handleTopSearchResultClick(result)}
                      >
                        {result.type === 'user' ? (
                          <div className={styles.topSearchUserResult}>
                            <UserAvatar user={result.data} size="small" />
                            <span className={styles.topSearchUserName}>{result.data.displayName}</span>
                            <span className={styles.topSearchUserType}>Пользователь</span>
                          </div>
                        ) : (
                          <div className={styles.topSearchMediaResult}>
                            <img
                              src={result.data.posterPath ? `https://image.tmdb.org/t/p/w92${result.data.posterPath}` : '/default-poster.png'}
                              alt={result.data.title}
                              className={styles.topSearchMediaPoster}
                            />
                            <div className={styles.topSearchMediaInfo}>
                              <span className={styles.topSearchMediaTitle}>{result.data.title}</span>
                              <span className={styles.topSearchMediaType}>
                                {result.data.mediaType === 'movie' ? 'Фильм' : 'Сериал'}
                              </span>
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  {searchResults.length > 5 && (
                    <div
                      className={styles.topSearchPreviewFooter}
                      onClick={() => { setShowSearchPreview(false); navigate(`/search?q=${encodeURIComponent(topSearchQuery)}`); }}
                    >
                      Показать все результаты ({searchResults.length})
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.topSearchPreviewEmpty}>Ничего не найдено</div>
              )}
            </div>
          )}
        </div>
        <button className={styles.topBarProfile} onClick={() => navigate('/profile')}>
          <Icon name="user" size="medium" />
        </button>
      </div>

      <div className={styles.personPage}>
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

      {/* Известные работы (топ-10) */}
      {castCredits.length > 0 && (
        <div className={styles.creditsSection}>
          <h2>Известные работы</h2>
          <div className={styles.creditsGrid}>
            {castCredits.slice(0, 10).map(renderCreditCard)}
          </div>
        </div>
      )}

      {/* Полная фильмография */}
      {castCredits.length > 10 && (
        <div className={styles.creditsSection}>
          <h2>Фильмография ({castCredits.length})</h2>
          <div className={styles.creditsGrid}>
            {displayedCast.map(renderCreditCard)}
          </div>
          {!showAllCredits && (
            <button className={styles.showAllBtn} onClick={() => setShowAllCredits(true)}>
              Показать все ({castCredits.length})
            </button>
          )}
        </div>
      )}

      {/* Режиссёрские работы */}
      {directingCredits.length > 0 && (
        <div className={styles.creditsSection}>
          <h2>Режиссёрские работы ({directingCredits.length})</h2>
          <div className={styles.creditsGrid}>
            {(showAllCredits ? directingCredits : directingCredits.slice(0, 5)).map(renderCreditCard)}
          </div>
        </div>
      )}

      {/* Сценарии */}
      {writingCredits.length > 0 && (
        <div className={styles.creditsSection}>
          <h2>Сценарии ({writingCredits.length})</h2>
          <div className={styles.creditsGrid}>
            {writingCredits.slice(0, 10).map(renderCreditCard)}
          </div>
        </div>
      )}

      {/* Продюсирование */}
      {productionCredits.length > 0 && (
        <div className={styles.creditsSection}>
          <h2>Продюсирование ({productionCredits.length})</h2>
          <div className={styles.creditsGrid}>
            {productionCredits.slice(0, 10).map(renderCreditCard)}
          </div>
        </div>
      )}

      {showAllCredits && (
        <button className={styles.showAllBtn} onClick={() => setShowAllCredits(false)}>
          Свернуть
        </button>
      )}
      </div>
    </>
  );
};

export default PersonPage;
