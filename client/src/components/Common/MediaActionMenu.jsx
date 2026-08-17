import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { addToList, addToWatchlist, removeFromWatchlist, removeFromList, fetchLists, fetchWatchlist } from '../../store/slices/listsSlice';
import useToast from '../../hooks/useToast';
import styles from './MediaActionMenu.module.css';

/**
 * Переиспользуемое меню действий для медиа-контента
 * Портал: ⋮ меню + модалка выбора списка
 *
 * Props:
 * - media: { tmdbId, mediaType, title }
 * - triggerRef: ref на элемент-триггер (для позиционирования меню)
 * - showStatus: показывать ли бейджи статуса (по умолчанию true)
 * - buttonClassName: CSS класс для кнопки ⋮
 * - badgeClassName: CSS класс для бейджа статуса
 * - onAction: callback после успешного действия
 */
const MediaActionMenu = ({ media, triggerRef, showStatus = true, buttonClassName, badgeClassName, onAction }) => {
  const dispatch = useAppDispatch();
  const { toastContainer, showToast } = useToast();
  const { customLists, watchlist } = useAppSelector((state) => state.lists);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState('');
  const [personalNote, setPersonalNote] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);

  const tmdbId = media?.tmdbId;
  const mediaType = media?.mediaType;
  const title = media?.title;

  const status = useCallback(() => {
    if (!tmdbId || !mediaType) return { inWatchlist: false, inList: null };
    const inWatchlist = watchlist.some(w => w.tmdbId === tmdbId && w.mediaType === mediaType);
    const inList = customLists.find(l =>
      l.items && l.items.some(i => i.tmdbId === tmdbId && i.mediaType === mediaType)
    );
    return { inWatchlist, inList };
  }, [tmdbId, mediaType, watchlist, customLists])();

  useEffect(() => {
    if (menuOpen) {
      const close = () => { setMenuOpen(false); setMenuPos(null); };
      document.addEventListener('click', close);
      return () => document.removeEventListener('click', close);
    }
  }, [menuOpen]);

  const toggleMenu = (e) => {
    e.stopPropagation();
    if (menuOpen) {
      setMenuOpen(false);
      setMenuPos(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.right - 180 });
      setMenuOpen(true);
    }
  };

  const openModal = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    setSelectedListId('');
    setPersonalNote('');
    setShowCreateForm(false);
    setNewListName('');
    setModalOpen(true);
  };

  const handleAddToWatchlist = async (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    try {
      await dispatch(addToWatchlist({ tmdbId, mediaType })).unwrap();
      showToast('Добавлено в "Хочу посмотреть"', 'success');
      onAction?.();
    } catch {
      showToast('Не удалось добавить', 'error');
    }
  };

  const handleRemoveFromWatchlist = async (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    const wlItem = watchlist.find(w => w.tmdbId === tmdbId && w.mediaType === mediaType);
    if (!wlItem) return;
    try {
      await dispatch(removeFromWatchlist(wlItem.id)).unwrap();
      showToast('Удалено из "Хочу посмотреть"', 'success');
      onAction?.();
    } catch {
      showToast('Не удалось удалить', 'error');
    }
  };

  const handleRemoveFromList = async (e, list) => {
    e.stopPropagation();
    setMenuOpen(false);
    const li = list.items?.find(i => i.tmdbId === tmdbId && i.mediaType === mediaType);
    if (!li) return;
    try {
      await dispatch(removeFromList({ listId: list.id, itemId: li.id })).unwrap();
      showToast(`Удалено из "${list.name}"`, 'success');
      onAction?.();
    } catch {
      showToast('Не удалось удалить', 'error');
    }
  };

  const handleConfirmAddToList = async () => {
    if (!selectedListId) return;
    try {
      await dispatch(addToList({
        listId: selectedListId,
        media: { tmdbId, mediaType, personalNote: personalNote.trim() || null }
      })).unwrap();
      await dispatch(fetchLists());
      showToast('Добавлено в список', 'success');
      onAction?.();
    } catch {
      showToast('Не удалось добавить', 'error');
    }
    setModalOpen(false);
  };

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    try {
      setCreating(true);
      const api = (await import('../../services/api')).default;
      const response = await api.post('/lists', { name: newListName.trim(), mediaType });
      const newList = response.data;
      await dispatch(addToList({
        listId: newList.id,
        media: { tmdbId, mediaType, personalNote: personalNote.trim() || null }
      })).unwrap();
      await dispatch(fetchLists());
      showToast('Список создан и контент добавлен', 'success');
      onAction?.();
    } catch {
      showToast('Не удалось создать список', 'error');
    } finally {
      setCreating(false);
      setModalOpen(false);
    }
  };

  if (!media) return null;

  const relevantLists = customLists.filter(l => l.mediaType === mediaType);

  return (
    <>
      {showStatus && status.inList && (
        <span className={badgeClassName || styles.badge}>{status.inList.name}</span>
      )}
      {showStatus && status.inWatchlist && (
        <span className={badgeClassName || styles.badge}>Хочу посмотреть</span>
      )}
      <button
        className={buttonClassName || styles.triggerBtn}
        onClick={toggleMenu}
        title="Действия"
      >
        ⋮
      </button>

      {menuOpen && menuPos && createPortal(
        <div className={styles.menu} style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}>
          {status.inList && (
            <button className={styles.menuStatus} onClick={(e) => handleRemoveFromList(e, status.inList)}>
              ✓ {status.inList.name} <span className={styles.menuRemove}>✕</span>
            </button>
          )}
          {status.inWatchlist && (
            <button className={styles.menuStatus} onClick={handleRemoveFromWatchlist}>
              ✓ Хочу посмотреть <span className={styles.menuRemove}>✕</span>
            </button>
          )}
          {!status.inList && (
            <button className={styles.menuItem} onClick={openModal}>
              📋 Добавить в список
            </button>
          )}
          {!status.inWatchlist && (
            <button className={styles.menuItem} onClick={handleAddToWatchlist}>
              + Хочу посмотреть
            </button>
          )}
        </div>,
        document.body
      )}

      {modalOpen && createPortal(
        <div className={styles.modalBackdrop} onClick={() => setModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Добавить в список</h3>
            <p className={styles.modalItem}>{title}</p>
            {!showCreateForm ? (
              <>
                <select value={selectedListId} onChange={(e) => setSelectedListId(e.target.value)} className={styles.modalSelect}>
                  <option value="">Выберите список</option>
                  {relevantLists.map(list => (
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
                    <button className={styles.modalCancel} onClick={() => setModalOpen(false)}>Отмена</button>
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
    </>
  );
};

export default MediaActionMenu;
