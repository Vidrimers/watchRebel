import React, { useState, useEffect, useMemo } from 'react';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchLists, fetchWatchlist } from '../../store/slices/listsSlice';
import Icon from '../Common/Icon';
import styles from './SuggestMediaModal.module.css';

const SuggestMediaModal = ({ mediaType, onSend, onClose }) => {
  const dispatch = useAppDispatch();
  const { customLists, watchlist } = useAppSelector((state) => state.lists);
  const [selectedList, setSelectedList] = useState(null);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    dispatch(fetchLists());
    dispatch(fetchWatchlist());
  }, [dispatch]);

  const allLists = customLists.filter(list => list.mediaType === mediaType);

  const watchlistItems = (watchlist || []).filter(item => item.mediaType === mediaType);
  const hasWatchlist = watchlistItems.length > 0;

  const sortedLists = [
    ...(hasWatchlist ? [{ id: '__watchlist', name: 'Хочу посмотреть', items: watchlistItems }] : []),
    ...allLists.filter(l => l.name !== 'Хочу посмотреть')
  ];

  const filteredLists = sortedLists.filter(list =>
    !searchQuery || list.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allItems = useMemo(() => {
    const items = [];
    const seen = new Set();
    const allSourceLists = [...allLists];
    if (hasWatchlist) allSourceLists.push({ id: '__watchlist', items: watchlistItems });
    for (const list of allSourceLists) {
      for (const item of (list.items || [])) {
        if (!seen.has(item.tmdbId)) {
          seen.add(item.tmdbId);
          items.push(item);
        }
      }
    }
    return items;
  }, [allLists, watchlistItems, hasWatchlist]);

  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return allItems.filter(item =>
      (item.title || `Контент #${item.tmdbId}`).toLowerCase().includes(q)
    ).slice(0, 20);
  }, [allItems, searchQuery]);

  const showSearchResults = searchQuery && !selectedList;

  const listItems = selectedList
    ? (selectedList.items || []).filter(item =>
        !searchQuery || (item.title || `Контент #${item.tmdbId}`).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleSend = () => {
    if (selectedMedia) {
      onSend({
        type: 'suggest',
        mediaType,
        tmdbId: selectedMedia.tmdbId,
        title: selectedMedia.title || `Контент #${selectedMedia.tmdbId}`,
        posterPath: selectedMedia.posterPath,
        voteAverage: selectedMedia.voteAverage
      });
      onClose();
    }
  };

  const renderMediaItem = (item) => (
    <div
      key={item.tmdbId}
      className={`${styles.mediaItem} ${selectedMedia?.tmdbId === item.tmdbId ? styles.selected : ''}`}
      onClick={() => setSelectedMedia(item)}
    >
      {item.posterPath ? (
        <img
          src={`https://image.tmdb.org/t/p/w92${item.posterPath}`}
          alt={item.title}
          className={styles.poster}
        />
      ) : (
        <div className={styles.posterPlaceholder}>🎬</div>
      )}
      <div className={styles.mediaItemInfo}>
        <span className={styles.mediaTitle}>{item.title || `Контент #${item.tmdbId}`}</span>
        {item.voteAverage > 0 && (
          <span className={styles.mediaRating}>★ {item.voteAverage.toFixed(1)}</span>
        )}
      </div>
    </div>
  );

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>
            Предложить {mediaType === 'movie' ? 'фильм' : 'сериал'}
          </h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>

        {!selectedList ? (
          <div className={styles.section}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Поиск по фильмам и спискам..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {showSearchResults ? (
              searchResults.length === 0 ? (
                <p className={styles.empty}>Ничего не найдено</p>
              ) : (
                <div className={styles.mediaList}>
                  {searchResults.map(renderMediaItem)}
                </div>
              )
            ) : (
              filteredLists.length === 0 ? (
                <p className={styles.empty}>Нет списков</p>
              ) : (
                <div className={styles.listGrid}>
                  {filteredLists.map((list) => (
                    <button
                      key={list.id}
                      className={styles.listCard}
                      onClick={() => setSelectedList(list)}
                    >
                      <span className={styles.listName}>{list.name}</span>
                      <span className={styles.listCount}>{list.items?.length || 0}</span>
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
        ) : (
          <div className={styles.section}>
            <div className={styles.breadcrumb}>
              <button className={styles.backBtn} onClick={() => { setSelectedList(null); setSelectedMedia(null); setSearchQuery(''); }}>
                ← Назад
              </button>
              <span className={styles.breadcrumbText}>{selectedList.name}</span>
            </div>

            <input
              type="text"
              className={styles.searchInput}
              placeholder={`Поиск в ${selectedList.name}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />

            {listItems.length === 0 ? (
              <p className={styles.empty}>Список пуст</p>
            ) : (
              <div className={styles.mediaList}>
                {listItems.map(renderMediaItem)}
              </div>
            )}
          </div>
        )}

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose}>Отмена</button>
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={!selectedMedia}
          >
            Отправить
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuggestMediaModal;
