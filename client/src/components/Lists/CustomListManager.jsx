import React, { useState } from 'react';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { createList, deleteList } from '../../store/slices/listsSlice';
import styles from './CustomListManager.module.css';

/**
 * Компонент для управления пользовательскими списками
 * Позволяет создавать и удалять списки
 */
const CustomListManager = ({ lists, mediaType, onListSelect }) => {
  const dispatch = useAppDispatch();
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [error, setError] = useState(null);

  // Фильтруем списки по типу медиа
  const filteredLists = lists.filter(list => list.mediaType === mediaType);

  // Создание нового списка
  const handleCreateList = async (e) => {
    e.preventDefault();
    
    if (!newListName.trim()) {
      setError('Введите название списка');
      return;
    }

    try {
      await dispatch(createList({ 
        name: newListName.trim(), 
        mediaType 
      })).unwrap();
      
      setNewListName('');
      setIsCreating(false);
      setError(null);
    } catch (err) {
      setError(err.message || 'Ошибка при создании списка');
    }
  };

  // Удаление списка
  const handleDeleteList = async (listId, listName) => {
    if (!window.confirm(`Удалить список "${listName}"? Все элементы будут удалены.`)) {
      return;
    }

    try {
      await dispatch(deleteList(listId)).unwrap();
    } catch (err) {
      setError(err.message || 'Ошибка при удалении списка');
    }
  };

  // Отмена создания
  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewListName('');
    setError(null);
  };

  return (
    <div className={styles.listManager}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          {mediaType === 'movie' ? 'Списки фильмов' : 'Списки сериалов'}
        </h2>
        
        {!isCreating && (
          <button 
            className={styles.createButton}
            onClick={() => setIsCreating(true)}
            title="Создать новый список"
          >
            + Создать список
          </button>
        )}
      </div>

      {/* Форма создания нового списка */}
      {isCreating && (
        <form className={styles.createForm} onSubmit={handleCreateList}>
          <input
            type="text"
            className={styles.input}
            placeholder="Название списка (например: Отличные, Средние, Отстой)"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            autoFocus
            maxLength={50}
          />
          <div className={styles.formActions}>
            <button type="submit" className={styles.submitButton}>
              Создать
            </button>
            <button 
              type="button" 
              className={styles.cancelButton}
              onClick={handleCancelCreate}
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* Сообщение об ошибке */}
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      {/* Список существующих списков */}
      <div className={styles.listsContainer}>
        {filteredLists.length === 0 ? (
          <div className={styles.emptyState}>
            <p>У вас пока нет списков</p>
            <p className={styles.emptyHint}>
              Создайте список, чтобы организовать свою коллекцию
            </p>
          </div>
        ) : (
          <div className={styles.listGrid}>
            {filteredLists.map((list) => (
              <div 
                key={list.id} 
                className={styles.listCard}
                onClick={() => onListSelect && onListSelect(list)}
              >
                <div className={styles.listHeader}>
                  <h3 className={styles.listName}>{list.name}</h3>
                  <button
                    className={styles.deleteButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteList(list.id, list.name);
                    }}
                    title="Удалить список"
                  >
                    ×
                  </button>
                </div>
                
                <div className={styles.listInfo}>
                  <span className={styles.itemCount}>
                    {list.items?.length || 0} {' '}
                    {list.items?.length === 1 ? 'элемент' : 
                     list.items?.length > 1 && list.items?.length < 5 ? 'элемента' : 
                     'элементов'}
                  </span>
                </div>

                {/* Превью первых постеров */}
                {list.items && list.items.length > 0 && (
                  <div className={styles.previewPosters}>
                    {list.items.slice(0, 3).map((item, index) => (
                      <div key={index} className={styles.previewPoster}>
                        {item.posterPath && (
                          <img
                            src={`https://image.tmdb.org/t/p/w92${item.posterPath}`}
                            alt={item.title}
                            loading="lazy"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomListManager;
