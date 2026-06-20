import React, { useState, useEffect } from 'react';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchLists } from '../../store/slices/listsSlice';
import Icon from '../Common/Icon';
import styles from './SuggestMediaModal.module.css';

const SuggestMediaModal = ({ mediaType, conversationId, onSend, onClose }) => {
  const dispatch = useAppDispatch();
  const { customLists } = useAppSelector((state) => state.lists);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(null);

  useEffect(() => {
    dispatch(fetchLists());
  }, [dispatch]);

  const filteredLists = customLists.filter(list => 
    list.mediaType === mediaType && 
    list.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allItems = customLists
    .filter(list => list.mediaType === mediaType)
    .flatMap(list => (list.items || []).map(item => ({ ...item, listName: list.name })))
    .filter((item, index, self) => 
      self.findIndex(i => i.tmdbId === item.tmdbId) === index
    )
    .filter(item => 
      !searchQuery || 
      (item.title || `Контент #${item.tmdbId}`).toLowerCase().includes(searchQuery.toLowerCase())
    );

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

        <input
          type="text"
          className={styles.searchInput}
          placeholder="Поиск по вашим спискам..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />

        <div className={styles.mediaList}>
          {allItems.length === 0 ? (
            <p className={styles.empty}>Нет {mediaType === 'movie' ? 'фильмов' : 'сериалов'} в списках</p>
          ) : (
            allItems.map((item) => (
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
                <div className={styles.mediaInfo}>
                  <span className={styles.mediaTitle}>{item.title || `Контент #${item.tmdbId}`}</span>
                  <span className={styles.mediaListName}>{item.listName}</span>
                </div>
              </div>
            ))
          )}
        </div>

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
