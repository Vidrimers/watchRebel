import React, { useState, useEffect } from 'react';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchLists } from '../../store/slices/listsSlice';
import Icon from '../Common/Icon';
import styles from './SuggestMediaModal.module.css';

const SuggestMediaModal = ({ mediaType, onSend, onClose }) => {
  const dispatch = useAppDispatch();
  const { customLists } = useAppSelector((state) => state.lists);
  const [selectedList, setSelectedList] = useState(null);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    dispatch(fetchLists());
  }, [dispatch]);

  const allLists = customLists.filter(list => list.mediaType === mediaType);
  const watchlist = allLists.find(list => list.name === 'Хочу посмотреть');
  const sortedLists = watchlist 
    ? [watchlist, ...allLists.filter(l => l.id !== watchlist.id)]
    : allLists;

  const filteredLists = sortedLists.filter(list => 
    !searchQuery || list.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        posterPath: selectedMedia.posterPath
      });
      onClose();
    }
  };

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
              placeholder="Поиск по спискам..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {filteredLists.length === 0 ? (
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
                {listItems.map((item) => (
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
                    <span className={styles.mediaTitle}>{item.title || `Контент #${item.tmdbId}`}</span>
                  </div>
                ))}
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
