import React, { useState, useEffect } from 'react';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import api from '../../services/api';
import Icon from '../Common/Icon';
import styles from './AddToListModal.module.css';

/**
 * Модалка для добавления медиа в список пользователя
 */
const AddToListModal = ({ tmdbId, mediaType, mediaTitle, onClose }) => {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);

  // Загружаем списки пользователя
  useEffect(() => {
    const fetchLists = async () => {
      try {
        setLoading(true);
        const response = await api.get('/lists', {
          params: { mediaType }
        });
        setLists(response.data);
      } catch (err) {
        console.error('Ошибка загрузки списков:', err);
        setError('Не удалось загрузить списки');
      } finally {
        setLoading(false);
      }
    };

    fetchLists();
  }, [mediaType]);

  // Добавление в список
  const handleAddToList = async (listId) => {
    try {
      setAdding(listId);
      setError(null);
      
      await api.post(`/lists/${listId}/items`, {
        tmdbId,
        mediaType
      });

      setSuccess(`Добавлено в список!`);
      
      // Закрываем модалку через 1 секунду
      setTimeout(() => {
        onClose();
      }, 1000);

    } catch (err) {
      console.error('Ошибка добавления в список:', err);
      setError(err.response?.data?.error || 'Не удалось добавить в список');
    } finally {
      setAdding(null);
    }
  };

  // Создание нового списка
  const handleCreateList = async (e) => {
    e.preventDefault();
    
    if (!newListName.trim()) {
      setError('Введите название списка');
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const response = await api.post('/lists', {
        name: newListName.trim(),
        mediaType
      });

      // Добавляем новый список в массив
      const newList = response.data;
      setLists([newList, ...lists]);
      
      // Сразу добавляем медиа в новый список
      await handleAddToList(newList.id);
      
      setNewListName('');
      setShowCreateForm(false);

    } catch (err) {
      console.error('Ошибка создания списка:', err);
      setError(err.response?.data?.error || 'Не удалось создать список');
    } finally {
      setCreating(false);
    }
  };

  // Закрытие по клику на backdrop
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className={styles.backdrop} 
      onClick={handleBackdropClick}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Добавить в список</h3>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {mediaTitle && (
            <p className={styles.mediaTitle}>
              <Icon name={mediaType === 'movie' ? 'movies' : 'tv'} size="small" />
              {mediaTitle}
            </p>
          )}

          {loading && <p className={styles.loading}>Загрузка списков...</p>}

          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>{success}</p>}

          {!loading && lists.length === 0 && !showCreateForm && (
            <div className={styles.noLists}>
              <p>У вас пока нет списков для {mediaType === 'movie' ? 'фильмов' : 'сериалов'}</p>
              <button 
                className={styles.createButton}
                onClick={() => setShowCreateForm(true)}
              >
                <Icon name="add" size="small" />
                Создать список
              </button>
            </div>
          )}

          {showCreateForm && (
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
                    setError(null);
                  }}
                  disabled={creating}
                >
                  Отмена
                </button>
              </div>
            </form>
          )}

          {!loading && lists.length > 0 && (
            <>
              {!showCreateForm && (
                <button 
                  className={styles.createListButton}
                  onClick={() => setShowCreateForm(true)}
                >
                  <Icon name="add" size="small" />
                  Создать новый список
                </button>
              )}
              
              <div className={styles.listsList}>
              {lists.map((list) => (
                <button
                  key={list.id}
                  className={styles.listItem}
                  onClick={() => handleAddToList(list.id)}
                  disabled={adding === list.id}
                >
                  <span className={styles.listName}>{list.name}</span>
                  <span className={styles.listCount}>
                    {list.items?.length || 0} {mediaType === 'movie' ? 'фильмов' : 'сериалов'}
                  </span>
                  {adding === list.id && <span className={styles.spinner}>⏳</span>}
                </button>
              ))}
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddToListModal;
