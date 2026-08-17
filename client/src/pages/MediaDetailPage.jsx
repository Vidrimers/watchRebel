import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { getMediaDetails, searchMedia, setSearchQuery, clearSearch } from '../store/slices/mediaSlice';
import { 
  fetchLists, 
  addToList, 
  addToWatchlist,
  removeFromWatchlist,
  fetchEpisodeProgress,
  markEpisodeWatched,
  fetchRatings
} from '../store/slices/listsSlice';
import { fetchUserReview, fetchReviewByPost } from '../store/slices/reviewsSlice';
import { fetchWall } from '../store/slices/wallSlice';
import { EpisodeTracker, RatingSelector, ReviewEditor, ReviewDisplay } from '../components/Media';
import Icon from '../components/Common/Icon';
import UserAvatar from '../components/User/UserAvatar';
import ShareModal from '../components/Common/ShareModal';
import NoteModal from '../components/Lists/NoteModal';
import useConfirm from '../hooks/useConfirm.jsx';
import useToast from '../hooks/useToast';
import api from '../services/api';
import styles from './MediaDetailPage.module.css';

/**
 * Детальная страница медиа-контента
 * Отображает полную информацию о фильме/сериале
 * Позволяет добавлять в списки, оценивать, отслеживать прогресс
 * Поддерживает режим просмотра отзыва другого пользователя
 */
const MediaDetailPage = () => {
  const { mediaType, mediaId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { confirmDialog, showConfirm } = useConfirm();
  const { toastContainer, showToast } = useToast();

  const { selectedMedia } = useAppSelector((state) => state.media);
  const { customLists, episodeProgress, ratings, watchlist } = useAppSelector((state) => state.lists);
  const { user } = useAppSelector((state) => state.auth);
  const { userReviews, currentReview } = useAppSelector((state) => state.reviews);

  const [selectedListId, setSelectedListId] = useState('');
  const [showListSelector, setShowListSelector] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);
  const [personalNote, setPersonalNote] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [topSearchQuery, setTopSearchQuery] = useState('');
  const [showSearchPreview, setShowSearchPreview] = useState(false);
  const [topSearchLoading, setTopSearchLoading] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [activeRecMenu, setActiveRecMenu] = useState(null);
  const [recSelectedItem, setRecSelectedItem] = useState(null);
  const [recScrollState, setRecScrollState] = useState({ canLeft: false, canRight: true });
  const [recMenuPos, setRecMenuPos] = useState(null);
  const topSearchRef = useRef(null);
  const topSearchDebounceRef = useRef(null);
  const recScrollRef = useRef(null);

  const { searchResults } = useAppSelector((state) => state.media);

  // Проверяем режим просмотра отзыва
  const reviewPostId = searchParams.get('reviewPost');
  const isReviewMode = !!reviewPostId;

  // Загрузка данных при монтировании
  useEffect(() => {
    if (mediaType && mediaId && user) {
      dispatch(getMediaDetails({ type: mediaType, id: mediaId }));
      dispatch(fetchLists());
      dispatch(fetchRatings(user.id));

      // Если режим просмотра отзыва - загружаем отзыв по postId
      if (reviewPostId) {
        dispatch(fetchReviewByPost(reviewPostId));
      } else {
        // Иначе загружаем отзыв текущего пользователя
        dispatch(fetchUserReview({
          userId: user.id,
          tmdbId: parseInt(mediaId),
          mediaType
        }));
      }
      
      // Для сериалов загружаем прогресс
      if (mediaType === 'tv') {
        dispatch(fetchEpisodeProgress(mediaId));
      }
    }
  }, [dispatch, mediaType, mediaId, user]);

  // Загрузка рекомендаций
  useEffect(() => {
    if (mediaType && mediaId) {
      api.get(`/media/${mediaType}/${mediaId}/recommendations`)
        .then(res => setRecommendations(res.data.results || []))
        .catch(() => {});
    }
  }, [mediaType, mediaId]);

  // Debounce для верхнего поиска
  useEffect(() => {
    if (topSearchDebounceRef.current) {
      clearTimeout(topSearchDebounceRef.current);
    }
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
    return () => {
      if (topSearchDebounceRef.current) clearTimeout(topSearchDebounceRef.current);
    };
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

  // Scroll detection для mini-хедера
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 200);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
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

  // Закрытие рекомендательного меню при клике вне
  useEffect(() => {
    if (activeRecMenu) {
      const close = () => setActiveRecMenu(null);
      document.addEventListener('click', close);
      return () => document.removeEventListener('click', close);
    }
  }, [activeRecMenu]);

  const toggleRecMenu = (e, tmdbId) => {
    e.stopPropagation();
    if (activeRecMenu === tmdbId) {
      setActiveRecMenu(null);
      setRecMenuPos(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setRecMenuPos({
        top: rect.bottom + 4,
        left: rect.right - 180
      });
      setActiveRecMenu(tmdbId);
    }
  };

  const handleRecAddToList = (e, item) => {
    e.stopPropagation();
    setActiveRecMenu(null);
    setSelectedListId('');
    setPersonalNote('');
    setRecSelectedItem({
      tmdbId: item.id,
      mediaType: item.media_type || mediaType,
      title: item.title || item.name
    });
    setShowListSelector(true);
  };

  const handleRecAddToWatchlist = async (e, item) => {
    e.stopPropagation();
    setActiveRecMenu(null);
    try {
      await dispatch(addToWatchlist({
        tmdbId: item.id,
        mediaType: item.media_type || mediaType
      })).unwrap();
      showToast('Добавлено в "Хочу посмотреть"', 'success');
    } catch {
      showToast('Не удалось добавить', 'error');
    }
  };

  const scrollRecommendations = (direction) => {
    if (recScrollRef.current) {
      const scrollAmount = recScrollRef.current.clientWidth * 0.8;
      recScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const checkRecScroll = useCallback(() => {
    const el = recScrollRef.current;
    if (!el) return;
    setRecScrollState({
      canLeft: el.scrollLeft > 10,
      canRight: el.scrollLeft + el.clientWidth < el.scrollWidth - 10
    });
  }, []);

  // Слушаем скролл рекомендаций
  useEffect(() => {
    const el = recScrollRef.current;
    if (!el || recommendations.length === 0) return;
    checkRecScroll();
    el.addEventListener('scroll', checkRecScroll, { passive: true });
    window.addEventListener('resize', checkRecScroll);
    return () => {
      el.removeEventListener('scroll', checkRecScroll);
      window.removeEventListener('resize', checkRecScroll);
    };
  }, [recommendations, checkRecScroll]);

  const handleTopSearchResultClick = useCallback((result) => {
    setShowSearchPreview(false);
    setTopSearchQuery('');
    dispatch(clearSearch());
    if (result.type === 'user') {
      navigate(`/user/${result.data.id}`);
    } else {
      navigate(`/media/${result.data.mediaType}/${result.data.tmdbId}`);
    }
  }, [navigate, dispatch]);

  // Обработка добавления в список
  const handleAddToList = async () => {
    if (!selectedListId) return;

    const mediaItem = recSelectedItem || (selectedMedia ? {
      tmdbId: selectedMedia.id,
      mediaType: selectedMedia.media_type || mediaType
    } : null);
    if (!mediaItem) return;

    try {
      await dispatch(addToList({
        listId: selectedListId,
        media: {
          tmdbId: mediaItem.tmdbId,
          mediaType: mediaItem.mediaType,
          personalNote: personalNote.trim() || null
        }
      })).unwrap();
      
      setShowListSelector(false);
      setSelectedListId('');
      setPersonalNote('');
      setRecSelectedItem(null);
      showToast('Контент добавлен в список', 'success');
    } catch (error) {
      showToast('Не удалось добавить в список', 'error');
    }
  };

  // Создание нового списка
  const handleCreateList = async (e) => {
    e.preventDefault();

    const mediaItem = recSelectedItem || (selectedMedia ? {
      tmdbId: selectedMedia.id,
      mediaType: selectedMedia.media_type || mediaType
    } : null);

    if (!newListName.trim() || !mediaItem) {
      showToast('Введите название списка', 'error');
      return;
    }

    try {
      setCreating(true);

      const response = await api.post('/lists', {
        name: newListName.trim(),
        mediaType: mediaItem.mediaType
      });

      const newList = response.data;
      
      // Добавляем медиа в новый список
      await dispatch(addToList({
        listId: newList.id,
        media: {
          tmdbId: mediaItem.tmdbId,
          mediaType: mediaItem.mediaType,
          personalNote: personalNote.trim() || null
        }
      })).unwrap();
      
      // Перезагружаем списки
      await dispatch(fetchLists());
      
      setNewListName('');
      setShowCreateForm(false);
      setShowListSelector(false);
      setPersonalNote('');
      setRecSelectedItem(null);
      
      showToast('Список создан и контент добавлен', 'success');

    } catch (err) {
      console.error('Ошибка создания списка:', err);
      showToast(err.response?.data?.error || 'Не удалось создать список', 'error');
    } finally {
      setCreating(false);
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
          
          showToast('Удалено из списка желаемого', 'success');
        }
      } else {
        await dispatch(addToWatchlist({
          tmdbId: selectedMedia.id,
          mediaType: selectedMedia.media_type || mediaType
        })).unwrap();
        
        showToast('Добавлено', 'success');
      }
    } catch (error) {
      showToast(isInWatchlist ? 'Не удалось удалить' : 'Не удалось добавить', 'error');
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

  // Сохранение заметки
  const handleSaveNote = async () => {
    if (!currentList || !currentListItem) return;
    try {
      setSavingNote(true);
      await api.put(`/lists/${currentList.id}/items/${currentListItem.id}/note`, {
        personalNote: editingNoteText.trim() || null
      });
      dispatch(fetchLists());
      setIsEditingNote(false);
      setEditingNoteText('');
    } catch (error) {
      showToast('Не удалось сохранить заметку', 'error');
    } finally {
      setSavingNote(false);
    }
  };

  // Удаление заметки
  const handleDeleteNote = async () => {
    if (!currentList || !currentListItem) return;

    const confirmed = await showConfirm({
      title: 'Удалить заметку',
      message: 'Вы уверены, что хотите удалить заметку?',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });
    if (!confirmed) return;

    try {
      setSavingNote(true);
      await api.put(`/lists/${currentList.id}/items/${currentListItem.id}/note`, {
        personalNote: null
      });
      dispatch(fetchLists());
      setIsEditingNote(false);
      setEditingNoteText('');
    } catch (error) {
      showToast('Не удалось удалить заметку', 'error');
    } finally {
      setSavingNote(false);
    }
  };

  if (!selectedMedia) {
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

  // Получаем существующий отзыв пользователя
  const reviewKey = `${mediaId}_${mediaType}`;
  const existingReview = userReviews[reviewKey] || null;

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

  // Находим текущий элемент и его заметку
  const currentListItem = currentList?.items?.find(
    item => item.tmdbId === parseInt(mediaId) && item.mediaType === (selectedMedia.media_type || mediaType)
  );
  const existingNote = currentListItem?.personalNote || '';

  return (
    <>
      {toastContainer}
      <div className={styles.mediaDetailPage}>
      {/* Верхняя навигационная полоска / Mini-хедер */}
      <div className={`${styles.topBar} ${isScrolled ? styles.topBarScrolled : ''}`}>
        {isScrolled ? (
          <>
            <button className={styles.topBarBack} onClick={() => {
              if (window.history.length > 1) navigate(-1);
              else navigate('/');
            }}>
              ←
            </button>
            <img
              src={posterUrl}
              alt={selectedMedia.title || selectedMedia.name}
              className={styles.miniPoster}
            />
            <div className={styles.miniInfo}>
              <span className={styles.miniTitle}>{selectedMedia.title || selectedMedia.name}</span>
              {releaseYear && <span className={styles.miniYear}>{releaseYear}</span>}
            </div>
            <div className={styles.miniActions}>
              <button
                className={`${styles.miniActionBtn} ${isInWatchlist ? styles.miniActionBtnActive : ''}`}
                onClick={handleToggleWatchlist}
              >
                {isInWatchlist ? '✓ Хочу посмотреть' : '+ Хочу посмотреть'}
              </button>
              <button
                className={styles.miniActionBtn}
                onClick={() => setShowListSelector(!showListSelector)}
              >
                {currentList ? `✓ ${currentList.name}` : '+ В список'}
              </button>
              <button
                className={styles.miniActionBtn}
                onClick={() => setShowShareModal(true)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
              </button>
            </div>
          </>
        ) : (
          <>
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
                  if (topSearchQuery.trim()) {
                    navigate(`/search?q=${encodeURIComponent(topSearchQuery.trim())}`);
                  } else {
                    navigate('/search');
                  }
                }}
              >
                <Icon name="search" size="small" />
              </button>

              {/* Preview результатов */}
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
                          onClick={() => {
                            setShowSearchPreview(false);
                            navigate(`/search?q=${encodeURIComponent(topSearchQuery)}`);
                          }}
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
          </>
        )}
      </div>

      {/* Фоновое изображение */}
      {backdropUrl && (
        <div 
          className={styles.backdrop}
          style={{ backgroundImage: `url(${backdropUrl})` }}
        />
      )}

      <div className={styles.content}>
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
                  onClick={() => setShowListSelector(!showListSelector)}
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
                {isInWatchlist ? '✓ Хочу посмотреть' : '+ Хочу посмотреть'}
              </button>

              <button 
                className={styles.actionButton}
                onClick={() => setShowShareModal(true)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                  <circle cx="18" cy="5" r="3"/>
                  <circle cx="6" cy="12" r="3"/>
                  <circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                Поделиться
              </button>
            </div>

            {/* Моя заметка */}
            {currentList && existingNote && !showListSelector && !isEditingNote && (
              <div className={styles.personalNoteSection}>
                <div className={styles.noteHeader}>
                  <div className={styles.noteTitleGroup}>
                    <span className={styles.noteLabel}>Моя заметка</span>
                    <span className={styles.notePrivateHint}>видно только вам</span>
                  </div>
                  <div className={styles.noteActions}>
                    <button 
                      className={styles.noteEditBtn}
                      onClick={() => {
                        setEditingNoteText(existingNote);
                        setIsEditingNote(true);
                      }}
                    >
                      Редактировать
                    </button>
                    <button 
                      className={styles.noteDeleteBtn}
                      onClick={handleDeleteNote}
                      disabled={savingNote}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
                <div className={styles.personalNoteBlock}>
                  <p className={styles.noteText}>{existingNote}</p>
                </div>
              </div>
            )}

            {/* Редактирование заметки */}
            {currentList && isEditingNote && (
              <div className={styles.personalNoteSection}>
                <div className={styles.noteHeader}>
                  <div className={styles.noteTitleGroup}>
                    <span className={styles.noteLabel}>{existingNote ? 'Редактирование заметки' : 'Добавить заметку'}</span>
                    <span className={styles.notePrivateHint}>видно только вам</span>
                  </div>
                </div>
                <div className={styles.personalNoteBlock}>
                  <textarea
                    className={styles.noteTextarea}
                    value={editingNoteText}
                    onChange={(e) => setEditingNoteText(e.target.value)}
                    placeholder="Ссылки, комментарии..."
                    rows={3}
                    maxLength={500}
                    autoFocus
                  />
                  <div className={styles.noteEditActions}>
                    <span className={styles.noteCount}>{editingNoteText.length}/500</span>
                    <div className={styles.noteEditButtons}>
                      <button 
                        className={styles.noteCancelBtn}
                        onClick={() => {
                          setIsEditingNote(false);
                          setEditingNoteText('');
                        }}
                        disabled={savingNote}
                      >
                        Отмена
                      </button>
                      <button 
                        className={styles.noteSaveBtn}
                        onClick={handleSaveNote}
                        disabled={savingNote}
                      >
                        {savingNote ? 'Сохранение...' : 'Сохранить'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Кнопка добавления заметки */}
            {currentList && !existingNote && !isEditingNote && !showListSelector && (
              <div className={styles.personalNoteSection}>
                <button 
                  className={styles.addNoteBtn}
                  onClick={() => {
                    setEditingNoteText('');
                    setIsEditingNote(true);
                  }}
                >
                  + Добавить заметку
                </button>
              </div>
            )}

            {/* Селектор списка */}
            {showListSelector && (
              <div className={styles.selector}>
                {!showCreateForm ? (
                  <>
                    <div>
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
                    <div className={styles.noteInputWrapper}>
                      <textarea
                        className={styles.noteInput}
                        placeholder="Заметка (необязательно)..."
                        value={personalNote}
                        onChange={(e) => setPersonalNote(e.target.value)}
                        rows={2}
                        maxLength={500}
                      />
                      <span className={styles.noteCount}>{personalNote.length}/500</span>
                    </div>
                    <button 
                      className={styles.createListButton}
                      onClick={() => setShowCreateForm(true)}
                    >
                      + Создать список
                    </button>
                  </>
                ) : (
                  <form onSubmit={handleCreateList} className={styles.createForm}>
                    <input
                      type="text"
                      className={styles.createInput}
                      placeholder="Название списка"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      autoFocus
                      disabled={creating}
                    />
                    <div className={styles.createButtons}>
                      <button 
                        type="submit" 
                        className={styles.submitButton}
                        disabled={creating || !newListName.trim()}
                      >
                        {creating ? 'Создание...' : 'Создать'}
                      </button>
                      <button 
                        type="button"
                        className={styles.cancelButton}
                        onClick={() => {
                          setShowCreateForm(false);
                          setNewListName('');
                        }}
                        disabled={creating}
                      >
                        Отмена
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Компонент рейтинга - скрываем в режиме просмотра отзыва */}
            {!isReviewMode && (
              <RatingSelector
                media={{
                  tmdbId: selectedMedia.id,
                  mediaType: selectedMedia.media_type || mediaType,
                  title: selectedMedia.title || selectedMedia.name
                }}
                currentRating={currentRating}
                isInList={!!currentList}
                onRatingSet={async (rating) => {
                  // Перезагружаем стену пользователя чтобы обновить пост с рейтингом
                  if (user) {
                    dispatch(fetchWall({ userId: user.id, limit: 20, offset: 0 }));
                  }
                  
                  showToast(`Оценка ${rating}/10 добавлена`, 'success');
                }}
              />
            )}

            {/* Режим просмотра отзыва другого пользователя */}
            {isReviewMode && currentReview ? (
              <ReviewDisplay
                review={currentReview}
                media={{
                  tmdbId: selectedMedia.id,
                  mediaType: selectedMedia.media_type || mediaType,
                  title: selectedMedia.title || selectedMedia.name
                }}
                onGoToMediaPage={() => {
                  // Переход на обычную страницу фильма без параметра reviewPost
                  navigate(`/media/${mediaType}/${mediaId}`);
                }}
              />
            ) : (
              /* Обычный режим - компонент отзыва текущего пользователя */
              <ReviewEditor
                media={{
                  tmdbId: selectedMedia.id,
                  mediaType: selectedMedia.media_type || mediaType,
                  title: selectedMedia.title || selectedMedia.name
                }}
                isInList={!!currentList}
                currentRating={currentRating}
                existingReview={existingReview}
                onReviewPublished={async () => {
                  // Перезагружаем отзыв для отображения на странице
                  if (user) {
                    dispatch(fetchUserReview({
                      userId: user.id,
                      tmdbId: parseInt(mediaId),
                      mediaType
                    }));
                  }
                  // Стена обновится автоматически через WebSocket
                  
                  showToast('Отзыв успешно опубликован на стене', 'success');
                }}
                onReviewDeleted={async () => {
                  // Стена обновится автоматически через WebSocket
                  // Отзыв уже удален из Redux state в reviewsSlice
                  
                  showToast('Отзыв удален', 'success');
                }}
              />
            )}
          </div>
        </div>

        {/* Трейлеры */}
        {selectedMedia.videos?.results?.length > 0 && (() => {
          const trailers = selectedMedia.videos.results.filter(v => 
            v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
          ).slice(0, 3);
          if (trailers.length === 0) return null;
          return (
            <div className={styles.trailersSection}>
              <h2 className={styles.sectionTitle}>Трейлеры</h2>
              <div className={styles.trailersGrid}>
                {trailers.map((trailer) => (
                  <div key={trailer.id} className={styles.trailerCard}>
                    <div className={styles.trailerEmbed}>
                      <iframe
                        src={`https://www.youtube.com/embed/${trailer.key}`}
                        title={trailer.name}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className={styles.trailerIframe}
                      />
                    </div>
                    <p className={styles.trailerName}>{trailer.name}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Актёры и съёмочная группа */}
        {selectedMedia.credits && (
          <div className={styles.creditsSection}>
            {/* Актёры */}
            {selectedMedia.credits.cast && selectedMedia.credits.cast.length > 0 && (
              <div className={styles.castSection}>
                <h2 className={styles.sectionTitle}>Актёры</h2>
                <div className={styles.castGrid}>
                  {selectedMedia.credits.cast.slice(0, 12).map((person) => (
                    <div
                      key={person.id}
                      className={styles.castCard}
                      onClick={() => navigate(`/person/${person.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className={styles.castPhoto}>
                        {person.profile_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
                            alt={person.name}
                            className={styles.castImage}
                          />
                        ) : (
                          <div className={styles.noPhoto}><Icon name="user" size="large" /></div>
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

        {/* Рекомендации */}
        {recommendations.length > 0 && (
          <div className={styles.recommendationsSection}>
            <h2 className={styles.sectionTitle}>Рекомендации</h2>
            <div className={styles.recommendationsWrapper}>
              {recScrollState.canLeft && (
                <button
                  className={`${styles.recArrow} ${styles.recArrowLeft}`}
                  onClick={() => scrollRecommendations('left')}
                >
                  ‹
                </button>
              )}
              <div className={styles.recommendationsScroll} ref={recScrollRef}>
                {recommendations.slice(0, 20).map((item) => (
                  <div
                    key={item.id}
                    className={styles.recommendationCard}
                  >
                    <div
                      className={styles.recommendationCardClickable}
                      onClick={() => navigate(`/media/${item.media_type || (selectedMedia.media_type || mediaType)}/${item.id}`)}
                    >
                      <img
                        src={item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : '/default-poster.png'}
                        alt={item.title || item.name}
                        className={styles.recommendationPoster}
                      />
                      <div className={styles.recommendationInfo}>
                        <span className={styles.recommendationTitle}>{item.title || item.name}</span>
                        <div className={styles.recommendationMeta}>
                          {(item.release_date || item.first_air_date) && (
                            <span>{new Date(item.release_date || item.first_air_date).getFullYear()}</span>
                          )}
                          {item.vote_average > 0 && (
                            <span className={styles.recommendationRating}>★ {item.vote_average.toFixed(1)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Кнопка действий */}
                    <button
                      className={styles.recActionBtn}
                      onClick={(e) => toggleRecMenu(e, item.id)}
                      title="Действия"
                    >
                      ⋮
                    </button>
                  </div>
                ))}
              </div>
              {recScrollState.canRight && (
                <button
                  className={`${styles.recArrow} ${styles.recArrowRight}`}
                  onClick={() => scrollRecommendations('right')}
                >
                  ›
                </button>
              )}
            </div>
          </div>
        )}

        {/* Portal для меню рекомендаций */}
        {activeRecMenu && recMenuPos && createPortal(
          <div
            className={styles.recActionMenu}
            style={{ position: 'fixed', top: recMenuPos.top, left: recMenuPos.left, zIndex: 9999 }}
          >
            <button
              className={styles.recMenuItem}
              onClick={(e) => {
                const item = recommendations.find(r => r.id === activeRecMenu);
                if (item) handleRecAddToList(e, item);
              }}
            >
              📋 Добавить в список
            </button>
            <button
              className={styles.recMenuItem}
              onClick={(e) => {
                const item = recommendations.find(r => r.id === activeRecMenu);
                if (item) handleRecAddToWatchlist(e, item);
              }}
            >
              + Хочу посмотреть
            </button>
          </div>,
          document.body
        )}

      </div>
    </div>
    {confirmDialog}
    {showShareModal && selectedMedia && (
      <ShareModal
        media={{
          id: selectedMedia.id,
          title: selectedMedia.title || selectedMedia.name,
          name: selectedMedia.name,
          mediaType: selectedMedia.media_type || mediaType,
          poster_path: selectedMedia.poster_path,
          vote_average: selectedMedia.vote_average
        }}
        onClose={() => setShowShareModal(false)}
      />
    )}
    </>
  );
};

export default MediaDetailPage;
