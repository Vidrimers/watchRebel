import React, { useState } from 'react';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { createList, deleteList, renameList } from '../../store/slices/listsSlice';
import useConfirm from '../../hooks/useConfirm.jsx';
import styles from './CustomListManager.module.css';

/**
 * Компонент для управления пользовательскими списками
 * Позволяет создавать, переименовывать и удалять списки
 */
const CustomListManager = ({ lists, mediaType, onListSelect }) => {
  const dispatch = useAppDispatch();
  const { confirmDialog, showConfirm } = useConfirm();
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [error, setError] = useState(null);
  
  // Состояние для переименования
  const [renamingListId, setRenamingListId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

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
    const confirmed = await showConfirm({
      title: 'Удалить список?',
      message: `Список "${listName}" будет удален вместе со всеми элементами. Это действие нельзя отменить.`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });

    if (!confirmed) {
      return;
    }

    try {
      await dispatch(deleteList(listId)).unwrap();
    } catch (err) {
      setError(err.message || 'Ошибка при удалении списка');
    }
  };

  // Начать переименование списка
  const handleStartRename = (listId, currentName) => {
    setRenamingListId(listId);
    setRenameValue(currentName);
    setError(null);
  };

  // Отменить переименование
  const handleCancelRename = () => {
    setRenamingListId(null);
    setRenameValue('');
    setError(null);
  };

  // Сохранить новое название
  const handleSaveRename = async (e) => {
    e.preventDefault();
    
    if (!renameValue.trim()) {
      setError('Введите название списка');
      return;
    }

    try {
      await dispatch(renameList({ 
        listId: renamingListId, 
        name: renameValue.trim() 
      })).unwrap();
      
      setRenamingListId(null);
      setRenameValue('');
      setError(null);
    } catch (err) {
      setError(err.message || 'Ошибка при переименовании списка');
    }
  };

  // Отмена создания
  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewListName('');
    setError(null);
  };

  return (
    <>
      {confirmDialog}
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
                  <div className={styles.listActions}>
                    <button
                      className={styles.editButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartRename(list.id, list.name);
                      }}
                      title="Переименовать список"
                    >
                      ✏️
                    </button>
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

      {/* Модальное окно для переименования */}
      {renamingListId && (
        <div className={styles.modal} onClick={handleCancelRename}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Переименовать список</h3>
              <button 
                className={styles.modalClose}
                onClick={handleCancelRename}
                title="Закрыть"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSaveRename}>
              <input
                type="text"
                className={styles.input}
                placeholder="Новое название списка"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                maxLength={50}
              />
              
              <div className={styles.modalActions}>
                <button type="submit" className={styles.submitButton}>
                  Сохранить
                </button>
                <button 
                  type="button" 
                  className={styles.cancelButton}
                  onClick={handleCancelRename}
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default CustomListManager;
