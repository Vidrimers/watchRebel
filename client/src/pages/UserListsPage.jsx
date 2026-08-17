import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { fetchUserLists, addToList, addToWatchlist, removeFromWatchlist, removeFromList, fetchLists, fetchWatchlist } from '../store/slices/listsSlice';
import useToast from '../hooks/useToast';
import UserPageLayout from '../components/Layout/UserPageLayout';
import Icon from '../components/Common/Icon';
import styles from './UserListsPage.module.css';

/**
 * Страница списков другого пользователя
 * Отображает все списки фильмов или сериалов пользователя
 */
const UserListsPage = () => {
  const { userId, mediaType } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { toastContainer, showToast } = useToast();
  
  const { user: currentUser } = useAppSelector((state) => state.auth);
  const { userLists, loading, customLists, watchlist } = useAppSelector((state) => state.lists);
  
  const [profileUser, setProfileUser] = useState(null);
  const [selectedList, setSelectedList] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const [menuPos, setMenuPos] = useState(null);
  const [showListSelector, setShowListSelector] = useState(false);
  const [selectedListId, setSelectedListId] = useState('');
  const [menuSelectedItem, setMenuSelectedItem] = useState(null);
  const [personalNote, setPersonalNote] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);

  // Загрузка данных пользователя и его списков
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Загружаем профиль пользователя
        const api = (await import('../services/api')).default;
        const response = await api.get(`/users/${userId}`);
        setProfileUser(response.data);
        
        // Загружаем списки пользователя
        dispatch(fetchUserLists(userId));
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
      }
    };

    if (userId) {
      fetchData();
    }
    if (currentUser) {
      dispatch(fetchLists());
      dispatch(fetchWatchlist());
    }
  }, [userId, dispatch, currentUser]);

  // Преобразуем mediaType из URL (movies/tv) в формат БД (movie/tv)
  const dbMediaType = mediaType === 'movies' ? 'movie' : 'tv';
  
  // Фильтруем списки по mediaType
  const filteredLists = userLists.filter(list => list.mediaType === dbMediaType);

  // Обработчик клика на список
  const handleListClick = (list) => {
    setSelectedList(list);
  };

  // Обработчик возврата к списку списков
  const handleBackToLists = () => {
    setSelectedList(null);
  };

  // Обработчик возврата к профилю
  const handleBackToProfile = () => {
    navigate(`/user/${userId}`);
  };

  // Проверка статуса элемента
  const getItemStatus = useCallback((item) => {
    const inWatchlist = watchlist.some(w => w.tmdbId === item.tmdbId && w.mediaType === item.mediaType);
    const inList = customLists.find(l =>
      l.items && l.items.some(i => i.tmdbId === item.tmdbId && i.mediaType === item.mediaType)
    );
    return { inWatchlist, inList };
  }, [watchlist, customLists]);

  // Меню действий
  const toggleMenu = (e, item) => {
    e.stopPropagation();
    if (activeMenu === item.id) {
      setActiveMenu(null);
      setMenuPos(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.right - 180 });
      setActiveMenu(item.id);
      setMenuSelectedItem(item);
    }
  };

  const handleAddToList = (e, item) => {
    e.stopPropagation();
    setActiveMenu(null);
    setSelectedListId('');
    setPersonalNote('');
    setShowCreateForm(false);
    setNewListName('');
    setMenuSelectedItem(item);
    setShowListSelector(true);
  };

  const handleConfirmAddToList = async () => {
    if (!selectedListId || !menuSelectedItem) return;
    try {
      await dispatch(addToList({
        listId: selectedListId,
        media: { tmdbId: menuSelectedItem.tmdbId, mediaType: menuSelectedItem.mediaType, personalNote: personalNote.trim() || null }
      })).unwrap();
      showToast('Добавлено в список', 'success');
    } catch {
      showToast('Не удалось добавить', 'error');
    }
    setShowListSelector(false);
    setMenuSelectedItem(null);
  };

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (!newListName.trim() || !menuSelectedItem) return;
    try {
      setCreating(true);
      const api = (await import('../services/api')).default;
      const response = await api.post('/lists', { name: newListName.trim(), mediaType: menuSelectedItem.mediaType });
      const newList = response.data;
      await dispatch(addToList({
        listId: newList.id,
        media: { tmdbId: menuSelectedItem.tmdbId, mediaType: menuSelectedItem.mediaType, personalNote: personalNote.trim() || null }
      })).unwrap();
      await dispatch(fetchLists());
      showToast('Список создан и контент добавлен', 'success');
    } catch {
      showToast('Не удалось создать список', 'error');
    } finally {
      setCreating(false);
      setShowListSelector(false);
      setMenuSelectedItem(null);
    }
  };

  const handleAddToWatchlist = async (e, item) => {
    e.stopPropagation();
    setActiveMenu(null);
    try {
      await dispatch(addToWatchlist({ tmdbId: item.tmdbId, mediaType: item.mediaType })).unwrap();
      showToast('Добавлено в "Хочу посмотреть"', 'success');
    } catch {
      showToast('Не удалось добавить', 'error');
    }
  };

  const handleRemoveFromWatchlist = async (e, item) => {
    e.stopPropagation();
    setActiveMenu(null);
    const wlItem = watchlist.find(w => w.tmdbId === item.tmdbId && w.mediaType === item.mediaType);
    if (!wlItem) return;
    try {
      await dispatch(removeFromWatchlist(wlItem.id)).unwrap();
      showToast('Удалено из "Хочу посмотреть"', 'success');
    } catch {
      showToast('Не удалось удалить', 'error');
    }
  };

  const handleRemoveFromList = async (e, item, list) => {
    e.stopPropagation();
    setActiveMenu(null);
    const li = list.items?.find(i => i.tmdbId === item.tmdbId && i.mediaType === item.mediaType);
    if (!li) return;
    try {
      await dispatch(removeFromList({ listId: list.id, itemId: li.id })).unwrap();
      showToast(`Удалено из "${list.name}"`, 'success');
    } catch {
      showToast('Не удалось удалить', 'error');
    }
  };

  // Закрытие меню
  useEffect(() => {
    if (activeMenu) {
      const close = () => { setActiveMenu(null); setMenuPos(null); };
      document.addEventListener('click', close);
      return () => document.removeEventListener('click', close);
    }
  }, [activeMenu]);

  if (loading) {
    return (
      <UserPageLayout user={currentUser}>
        <div className={styles.container}>
          <p>Загрузка...</p>
        </div>
      </UserPageLayout>
    );
  }

  return (
    <UserPageLayout user={currentUser}>
      <div className={styles.container}>
        {/* Breadcrumbs */}
        <div className={styles.breadcrumbs}>
          <button onClick={handleBackToProfile} className={styles.breadcrumbLink}>
            Профиль
          </button>
          <span className={styles.breadcrumbSeparator}>→</span>
          {selectedList ? (
            <>
              <button onClick={handleBackToLists} className={styles.breadcrumbLink}>
                {mediaType === 'movies' ? 'Фильмы' : 'Сериалы'}
              </button>
              <span className={styles.breadcrumbSeparator}>→</span>
              <span className={styles.breadcrumbCurrent}>{selectedList.name}</span>
            </>
          ) : (
            <span className={styles.breadcrumbCurrent}>
              {mediaType === 'movies' ? 'Фильмы' : 'Сериалы'}
            </span>
          )}
        </div>

        {/* Заголовок */}
        <div className={styles.header}>
          <button onClick={selectedList ? handleBackToLists : handleBackToProfile} className={styles.backButton}>
            <Icon name="arrow-left" size={20} />
          </button>
          <h1 className={styles.title}>
            {selectedList 
              ? selectedList.name
              : `${mediaType === 'movies' ? 'Фильмы' : 'Сериалы'} ${profileUser?.displayName || ''}`
            }
          </h1>
        </div>

        {/* Контент */}
        {selectedList ? (
          // Отображение фильмов в выбранном списке
          <div className={styles.mediaGrid}>
            {selectedList.items && selectedList.items.length > 0 ? (
              selectedList.items.map((item) => {
                const itemStatus = getItemStatus(item);
                return (
                <div key={item.id} className={styles.mediaCard}>
                  <div
                    className={styles.posterContainer}
                    onClick={() => navigate(`/media/${item.mediaType}/${item.tmdbId}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    {item.posterPath ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w500${item.posterPath}`}
                        alt={item.title}
                        className={styles.poster}
                      />
                    ) : (
                      <div className={styles.noPoster}>
                        <Icon name="image" size={48} />
                      </div>
                    )}
                    {itemStatus.inList && (
                      <span className={styles.statusBadge}>{itemStatus.inList.name}</span>
                    )}
                    {itemStatus.inWatchlist && (
                      <span className={styles.statusBadge}>Хочу посмотреть</span>
                    )}
                    <button
                      className={styles.actionBtn}
                      onClick={(e) => toggleMenu(e, item)}
                      title="Действия"
                    >
                      ⋮
                    </button>
                  </div>
                  <div className={styles.mediaInfo}>
                    <h3 className={styles.mediaTitle}>{item.title}</h3>
                    {item.releaseDate && (
                      <p className={styles.mediaYear}>
                        {new Date(item.releaseDate).getFullYear()}
                      </p>
                    )}
                  </div>
                </div>
                );
              })
            ) : (
              <p className={styles.emptyMessage}>Список пуст</p>
            )}
          </div>
        ) : (
          // Отображение всех списков
          <div className={styles.listsGrid}>
            {filteredLists.length > 0 ? (
              filteredLists.map((list) => (
                <div
                  key={list.id}
                  className={styles.listCard}
                  onClick={() => handleListClick(list)}
                >
                  <div className={styles.listHeader}>
                    <h2 className={styles.listName}>{list.name}</h2>
                    <span className={styles.listCount}>
                      {list.items?.length || 0} {(() => {
                        const n = list.items?.length || 0;
                        const words = mediaType === 'movies' 
                          ? ['фильм', 'фильма', 'фильмов']
                          : ['сериал', 'сериала', 'сериалов'];
                        if (n % 10 === 1 && n % 100 !== 11) return words[0];
                        if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) return words[1];
                        return words[2];
                      })()}
                    </span>
                  </div>
                  {list.items && list.items.length > 0 && (
                    <div className={styles.listPreview}>
                      <div className={styles.listPreviewTrack}>
                        {[...list.items.slice(0, 10), ...list.items.slice(0, 10)].map((item, index) => (
                          <div key={`${item.id}-${index}`} className={styles.previewPoster}>
                            {item.posterPath ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w200${item.posterPath}`}
                                alt={item.title}
                              />
                            ) : (
                              <div className={styles.noPreviewPoster}>
                                <Icon name="image" size={24} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className={styles.emptyMessage}>
                У пользователя нет списков {mediaType === 'movies' ? 'фильмов' : 'сериалов'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Portal для меню действий */}
      {activeMenu && menuPos && (() => {
        const item = menuSelectedItem;
        const status = item ? getItemStatus(item) : { inWatchlist: false, inList: null };
        return createPortal(
          <div className={styles.actionMenu} style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}>
            {status.inList && (
              <button className={styles.menuStatus} onClick={(e) => item && handleRemoveFromList(e, item, status.inList)}>
                ✓ {status.inList.name} <span className={styles.menuRemove}>✕</span>
              </button>
            )}
            {status.inWatchlist && (
              <button className={styles.menuStatus} onClick={(e) => item && handleRemoveFromWatchlist(e, item)}>
                ✓ Хочу посмотреть <span className={styles.menuRemove}>✕</span>
              </button>
            )}
            {!status.inList && (
              <button className={styles.menuItem} onClick={(e) => item && handleAddToList(e, item)}>
                📋 Добавить в список
              </button>
            )}
            {!status.inWatchlist && (
              <button className={styles.menuItem} onClick={(e) => item && handleAddToWatchlist(e, item)}>
                + Хочу посмотреть
              </button>
            )}
          </div>,
          document.body
        );
      })()}

      {/* Portal для селектора списков */}
      {showListSelector && menuSelectedItem && createPortal(
        <div className={styles.modalBackdrop} onClick={() => { setShowListSelector(false); setMenuSelectedItem(null); }}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Добавить в список</h3>
            <p className={styles.modalItem}>{menuSelectedItem.title}</p>
            {!showCreateForm ? (
              <>
                <select value={selectedListId} onChange={(e) => setSelectedListId(e.target.value)} className={styles.modalSelect}>
                  <option value="">Выберите список</option>
                  {customLists.filter(l => l.mediaType === menuSelectedItem.mediaType).map(list => (
                    <option key={list.id} value={list.id}>{list.name}</option>
                  ))}
                </select>
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
                <div className={styles.modalActions}>
                  <button className={styles.createListBtn} onClick={() => setShowCreateForm(true)}>
                    + Создать список
                  </button>
                  <div>
                    <button className={styles.modalCancel} onClick={() => { setShowListSelector(false); setMenuSelectedItem(null); }}>Отмена</button>
                    <button className={styles.modalConfirm} onClick={handleConfirmAddToList} disabled={!selectedListId}>Добавить</button>
                  </div>
                </div>
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
                <div className={styles.createActions}>
                  <button type="submit" className={styles.modalConfirm} disabled={creating || !newListName.trim()}>
                    {creating ? 'Создание...' : 'Создать и добавить'}
                  </button>
                  <button type="button" className={styles.modalCancel} onClick={() => { setShowCreateForm(false); setNewListName(''); }} disabled={creating}>
                    Назад
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {toastContainer}
    </UserPageLayout>
  );
};

export default UserListsPage;
