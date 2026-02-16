import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { searchMedia, setSearchQuery } from '../../store/slices/mediaSlice';
import styles from './SearchBar.module.css';

/**
 * Компонент поисковой строки с preview
 * Отображает быстрый предпросмотр результатов при вводе
 */
const SearchBar = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { searchResults, loading } = useAppSelector((state) => state.media);
  
  const [query, setQuery] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  
  const searchRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Debounce для поиска - задержка 300ms
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);

  // Выполняем поиск когда debouncedQuery изменяется
  useEffect(() => {
    if (debouncedQuery.trim().length > 0) {
      dispatch(searchMedia({ query: debouncedQuery, filters: {} }));
      setShowPreview(true);
    } else {
      setShowPreview(false);
    }
  }, [debouncedQuery, dispatch]);

  // Закрываем preview при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowPreview(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Обработка изменения текста в поле
  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    dispatch(setSearchQuery(value));
  };

  // Обработка нажатия Enter - переход на полную страницу поиска
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      setShowPreview(false);
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  // Обработка клика на результат в preview
  const handleResultClick = (result) => {
    setShowPreview(false);
    
    if (result.type === 'user') {
      navigate(`/user/${result.data.id}`);
    } else {
      navigate(`/media/${result.data.mediaType}/${result.data.tmdbId}`);
    }
  };

  // Получаем первые 5 результатов для preview
  const previewResults = searchResults.slice(0, 5);

  return (
    <div className={styles.searchContainer} ref={searchRef}>
      <input
        type="text"
        placeholder="Поиск фильмов, сериалов, пользователей..."
        className={styles.searchInput}
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => query.trim() && setShowPreview(true)}
      />

      {/* Preview результатов */}
      {showPreview && query.trim() && (
        <div className={styles.searchPreview}>
          {loading ? (
            <div className={styles.previewLoading}>
              <span>Поиск...</span>
            </div>
          ) : previewResults.length > 0 ? (
            <>
              <ul className={styles.previewList}>
                {previewResults.map((result, index) => (
                  <li
                    key={`${result.type}-${result.data.id || result.data.tmdbId}-${index}`}
                    className={styles.previewItem}
                    onClick={() => handleResultClick(result)}
                  >
                    {result.type === 'user' ? (
                      <div className={styles.userResult}>
                        <img
                          src={result.data.avatarUrl || '/default-avatar.png'}
                          alt={result.data.displayName}
                          className={styles.userAvatar}
                        />
                        <div className={styles.userInfo}>
                          <span className={styles.userName}>{result.data.displayName}</span>
                          <span className={styles.userType}>Пользователь</span>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.mediaResult}>
                        <img
                          src={
                            result.data.posterPath
                              ? `https://image.tmdb.org/t/p/w92${result.data.posterPath}`
                              : '/default-poster.png'
                          }
                          alt={result.data.title}
                          className={styles.mediaPoster}
                        />
                        <div className={styles.mediaInfo}>
                          <span className={styles.mediaTitle}>{result.data.title}</span>
                          <span className={styles.mediaType}>
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
                  className={styles.previewFooter}
                  onClick={() => {
                    setShowPreview(false);
                    navigate(`/search?q=${encodeURIComponent(query)}`);
                  }}
                >
                  Показать все результаты ({searchResults.length})
                </div>
              )}
            </>
          ) : (
            <div className={styles.previewEmpty}>
              <span>Ничего не найдено</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
