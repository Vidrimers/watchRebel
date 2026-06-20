import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { getMediaDetails } from '../store/slices/mediaSlice';
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
import { fetchWall, createPost } from '../store/slices/wallSlice';
import { EpisodeTracker, RatingSelector, ReviewEditor, ReviewDisplay } from '../components/Media';
import Icon from '../components/Common/Icon';
import NoteModal from '../components/Lists/NoteModal';
import useAlert from '../hooks/useAlert.jsx';
import useConfirm from '../hooks/useConfirm.jsx';
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
  const { alertDialog, showAlert } = useAlert();
  const { confirmDialog, showConfirm } = useConfirm();

  const { selectedMedia, loading: mediaLoading } = useAppSelector((state) => state.media);
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
  const [sharing, setSharing] = useState(false);

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

  // Обработка добавления в список
  const handleAddToList = async () => {
    if (!selectedListId || !selectedMedia) return;

    try {
      await dispatch(addToList({
        listId: selectedListId,
        media: {
          tmdbId: selectedMedia.id,
          mediaType: selectedMedia.media_type || mediaType,
          personalNote: personalNote.trim() || null
        }
      })).unwrap();
      
      setShowListSelector(false);
      setSelectedListId('');
      setPersonalNote('');
      await showAlert({
        title: 'Успешно!',
        message: 'Контент добавлен в список',
        type: 'success'
      });
    } catch (error) {
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось добавить в список',
        type: 'error'
      });
    }
  };

  // Создание нового списка
  const handleCreateList = async (e) => {
    e.preventDefault();
    
    if (!newListName.trim() || !selectedMedia) {
      await showAlert({
        title: 'Ошибка',
        message: 'Введите название списка',
        type: 'error'
      });
      return;
    }

    try {
      setCreating(true);

      const response = await api.post('/lists', {
        name: newListName.trim(),
        mediaType: selectedMedia.media_type || mediaType
      });

      const newList = response.data;
      
      // Добавляем медиа в новый список
      await dispatch(addToList({
        listId: newList.id,
        media: {
          tmdbId: selectedMedia.id,
          mediaType: selectedMedia.media_type || mediaType,
          personalNote: personalNote.trim() || null
        }
      })).unwrap();
      
      // Перезагружаем списки
      await dispatch(fetchLists());
      
      setNewListName('');
      setShowCreateForm(false);
      setShowListSelector(false);
      setPersonalNote('');
      
      await showAlert({
        title: 'Успешно!',
        message: 'Список создан и контент добавлен',
        type: 'success'
      });

    } catch (err) {
      console.error('Ошибка создания списка:', err);
      await showAlert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось создать список',
        type: 'error'
      });
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
          
          await showAlert({
            title: 'Успешно!',
            message: 'Удалено из списка желаемого',
            type: 'success'
          });
        }
      } else {
        await dispatch(addToWatchlist({
          tmdbId: selectedMedia.id,
          mediaType: selectedMedia.media_type || mediaType
        })).unwrap();
        
        await showAlert({
          title: 'Успешно!',
          message: 'Добавлено',
          type: 'success'
        });
      }
    } catch (error) {
      await showAlert({
        title: 'Ошибка',
        message: isInWatchlist 
          ? 'Не удалось удалить'
          : 'Не удалось добавить',
        type: 'error'
      });
    }
  };

  // Поделиться фильмом/сериалом на стене
  const handleShare = async () => {
    if (!selectedMedia || sharing) return;
    setSharing(true);
    try {
      await dispatch(createPost({
        postType: 'media_shared',
        content: `Рекомендую к просмотру!`,
        tmdbId: selectedMedia.id,
        mediaType: selectedMedia.media_type || mediaType,
        posterPath: selectedMedia.poster_path
      })).unwrap();

      await showAlert({
        title: 'Опубликовано!',
        message: 'Пост добавлен на вашу стену',
        type: 'success'
      });
    } catch (error) {
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось опубликовать',
        type: 'error'
      });
    } finally {
      setSharing(false);
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
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось сохранить заметку',
        type: 'error'
      });
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
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось удалить заметку',
        type: 'error'
      });
    } finally {
      setSavingNote(false);
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
      {alertDialog}
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
                onClick={handleShare}
                disabled={sharing}
              >
                {sharing ? '...' : '🔗 Поделиться'}
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
                  
                  await showAlert({
                    title: 'Оценка сохранена!',
                    message: `Оценка ${rating}/10 добавлена`,
                    type: 'success'
                  });
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
                  
                  await showAlert({
                    title: 'Отзыв опубликован!',
                    message: 'Ваш отзыв успешно опубликован на стене',
                    type: 'success'
                  });
                }}
                onReviewDeleted={async () => {
                  // Стена обновится автоматически через WebSocket
                  // Отзыв уже удален из Redux state в reviewsSlice
                  
                  await showAlert({
                    title: 'Отзыв удален',
                    message: 'Ваш отзыв успешно удален',
                    type: 'success'
                  });
                }}
              />
            )}
          </div>
        </div>

        {/* Актёры и съёмочная группа */}
        {selectedMedia.credits && (
          <div className={styles.creditsSection}>
            {/* Актёры */}
            {selectedMedia.credits.cast && selectedMedia.credits.cast.length > 0 && (
              <div className={styles.castSection}>
                <h2 className={styles.sectionTitle}>Актёры</h2>
                <div className={styles.castGrid}>
                  {selectedMedia.credits.cast.slice(0, 12).map((person) => (
                    <div key={person.id} className={styles.castCard}>
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
      </div>
    </div>
    {confirmDialog}
    </>
  );
};

export default MediaDetailPage;
