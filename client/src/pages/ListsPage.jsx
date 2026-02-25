import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { fetchLists, removeFromList, moveToList } from '../store/slices/listsSlice';
import UserPageLayout from '../components/Layout/UserPageLayout';
import CustomListManager from '../components/Lists/CustomListManager';
import MediaCard from '../components/Media/MediaCard';
import ConfirmDialog from '../components/Common/ConfirmDialog';
import Icon from '../components/Common/Icon';
import useAlert from '../hooks/useAlert';
import styles from './ListsPage.module.css';

/**
 * Страница списков фильмов и сериалов
 * Позволяет переключаться между типами медиа и просматривать содержимое списков
 */
const ListsPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const { customLists, loading, error } = useAppSelector((state) => state.lists);
  const { episodeProgress } = useAppSelector((state) => state.lists);

  // Получаем тип медиа из URL параметров (по умолчанию 'movie')
  const mediaType = searchParams.get('type') || 'movie';
  
  // Выбранный список для просмотра
  const [selectedListId, setSelectedListId] = useState(null);
  
  // Получаем актуальный список из Redux по ID
  const selectedList = selectedListId 
    ? customLists.find(list => list.id === selectedListId)
    : null;
  
  // Состояние для модалок
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [targetListId, setTargetListId] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchLists());
    }
  }, [isAuthenticated, dispatch]);

  // Переключение типа медиа
  const handleMediaTypeChange = (type) => {
    setSearchParams({ type });
    setSelectedListId(null); // Сбрасываем выбранный список при смене типа
  };

  // Выбор списка для просмотра
  const handleListSelect = (list) => {
    setSelectedListId(list.id);
  };

  // Возврат к списку всех списков
  const handleBackToLists = () => {
    setSelectedListId(null);
  };

  // Открытие диалога перемещения
  const handleOpenMoveDialog = (item) => {
    setSelectedItem(item);
    setShowMoveDialog(true);
  };

  // Открытие диалога удаления
  const handleOpenDeleteDialog = (item) => {
    setSelectedItem(item);
    setShowDeleteDialog(true);
  };

  // Перемещение в другой список
  const handleMoveItem = async () => {
    if (!selectedItem || !targetListId || !selectedList) return;

    try {
      await dispatch(moveToList({
        fromListId: selectedList.id,
        itemId: selectedItem.id,
        toListId: targetListId,
        media: {
          tmdbId: selectedItem.tmdbId,
          mediaType: selectedItem.mediaType
        }
      })).unwrap();

      // Закрываем модалку и очищаем состояние ПЕРЕД показом алерта
      setShowMoveDialog(false);
      setTargetListId('');
      setSelectedItem(null);

      await showAlert({
        title: 'Успешно!',
        message: `"${selectedItem.title}" перемещен в другой список`,
        type: 'success'
      });
    } catch (error) {
      console.error('Ошибка перемещения:', error);
      await showAlert({
        title: 'Ошибка',
        message: error.error || 'Не удалось переместить. Попробуйте позже.',
        type: 'error'
      });
    }
  };

  // Удаление из списка
  const handleDeleteItem = async () => {
    if (!selectedItem || !selectedList) return;

    try {
      await dispatch(removeFromList({
        listId: selectedList.id,
        itemId: selectedItem.id
      })).unwrap();

      // Закрываем модалку и очищаем состояние ПЕРЕД показом алерта
      setShowDeleteDialog(false);
      setSelectedItem(null);

      await showAlert({
        title: 'Успешно!',
        message: `"${selectedItem.title}" удален из списка`,
        type: 'success'
      });
    } catch (error) {
      console.error('Ошибка удаления:', error);
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось удалить. Попробуйте позже.',
        type: 'error'
      });
    }
  };

  // Получение доступных списков для перемещения (исключая текущий)
  const availableListsForMove = selectedListId
    ? customLists.filter(list => 
        list.id !== selectedListId && 
        list.mediaType === selectedList?.mediaType
      )
    : [];

  // Состояние для dropdown экспорта
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Функция экспорта
  const handleExport = async (format) => {
    setShowExportDropdown(false);
    setIsExporting(true);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/lists/export?format=${format}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Ошибка экспорта');
      }

      // Получаем blob из ответа
      const blob = await response.blob();
      
      // Создаем ссылку для скачивания
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Получаем имя файла из заголовка Content-Disposition или генерируем
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `watchrebel_lists_${new Date().toISOString().split('T')[0]}.${format}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Очистка
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      await showAlert({
        title: 'Успешно!',
        message: `Списки экспортированы в формате ${format.toUpperCase()}`,
        type: 'success'
      });
    } catch (error) {
      console.error('Ошибка экспорта:', error);
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось экспортировать списки. Попробуйте позже.',
        type: 'error'
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Закрытие dropdown при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showExportDropdown && !event.target.closest(`.${styles.exportContainer}`)) {
        setShowExportDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportDropdown]);

  if (!isAuthenticated) {
    return (
      <div className={styles.errorContainer}>
        <p>Необходимо авторизоваться</p>
      </div>
    );
  }

  return (
    <UserPageLayout user={user}>
      <div className={styles.listsPage}>
        {/* Заголовок и переключатель типов */}
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Мои списки</h1>
          
          <div className={styles.headerActions}>
            <div className={styles.mediaTypeToggle}>
              <button
                className={`${styles.toggleButton} ${mediaType === 'movie' ? styles.active : ''}`}
                onClick={() => handleMediaTypeChange('movie')}
              >
                <Icon name="movies" size="small" /> Фильмы
              </button>
              <button
                className={`${styles.toggleButton} ${mediaType === 'tv' ? styles.active : ''}`}
                onClick={() => handleMediaTypeChange('tv')}
              >
                <Icon name="tv" size="small" /> Сериалы
              </button>
            </div>

            {/* Кнопка экспорта */}
            <div className={styles.exportContainer}>
              <button
                className={styles.exportButton}
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                disabled={isExporting}
              >
                {isExporting ? '⏳ Подготовка...' : '📥 Экспортировать'}
              </button>
              
              {showExportDropdown && (
                <div className={styles.exportDropdown}>
                  <button
                    className={styles.exportOption}
                    onClick={() => handleExport('json')}
                  >
                    📄 JSON
                  </button>
                  <button
                    className={styles.exportOption}
                    onClick={() => handleExport('xlsx')}
                  >
                    📊 Excel (XLSX)
                  </button>
                  <button
                    className={styles.exportOption}
                    onClick={() => handleExport('csv')}
                  >
                    📋 CSV
                  </button>
                  <button
                    className={styles.exportOption}
                    onClick={() => handleExport('pdf')}
                  >
                    📕 PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Состояния загрузки и ошибок */}
        {loading && (
          <div className={styles.loadingContainer}>
            <p>Загрузка списков...</p>
          </div>
        )}

        {error && (
          <div className={styles.errorMessage}>
            <p>Ошибка загрузки: {error.message || 'Неизвестная ошибка'}</p>
          </div>
        )}

        {/* Основной контент */}
        {!loading && !error && (
          <>
            {!selectedList ? (
              // Показываем менеджер списков
              <CustomListManager
                lists={customLists}
                mediaType={mediaType}
                onListSelect={handleListSelect}
              />
            ) : (
              // Показываем содержимое выбранного списка
              <div className={styles.listContent}>
                <div className={styles.listContentHeader}>
                  <button 
                    className={styles.backButton}
                    onClick={handleBackToLists}
                  >
                    ← Назад к спискам
                  </button>
                  <h2 className={styles.listContentTitle}>{selectedList.name}</h2>
                  <p className={styles.listContentCount}>
                    {selectedList.items?.length || 0} {' '}
                    {selectedList.items?.length === 1 ? 'элемент' : 
                     selectedList.items?.length > 1 && selectedList.items?.length < 5 ? 'элемента' : 
                     'элементов'}
                  </p>
                </div>

                {selectedList.items && selectedList.items.length > 0 ? (
                  <div className={styles.mediaGrid}>
                    {selectedList.items.map((item) => (
                      <div key={item.tmdbId} className={styles.mediaCardWrapper}>
                        <MediaCard
                          media={item}
                          showProgress={item.mediaType === 'tv'}
                          progress={episodeProgress[item.tmdbId]?.[episodeProgress[item.tmdbId].length - 1]}
                        />
                        <div className={styles.itemActions}>
                          <button
                            className={styles.moveButton}
                            onClick={() => handleOpenMoveDialog(item)}
                            title="Переместить в другой список"
                          >
                            →
                          </button>
                          <button
                            className={styles.deleteButton}
                            onClick={() => handleOpenDeleteDialog(item)}
                            title="Удалить из списка"
                          >
                            <Icon name="delete" size="small" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyList}>
                    <p>Список пуст</p>
                    <p className={styles.emptyHint}>
                      Добавьте {mediaType === 'movie' ? 'фильмы' : 'сериалы'} через{' '}
                      <a href="/my-catalog" className={styles.searchLink}>каталог</a>
                      {' '}или{' '}
                      <a href="/search" className={styles.searchLink}>поиск</a>
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Модалка перемещения */}
      <ConfirmDialog
        isOpen={showMoveDialog}
        title="Переместить в другой список"
        message={
          <div className={styles.dialogContent}>
            <p>Переместить "{selectedItem?.title}" в:</p>
            <select
              value={targetListId}
              onChange={(e) => setTargetListId(e.target.value)}
              className={styles.listSelect}
            >
              <option value="">Выберите список</option>
              {availableListsForMove.map(list => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
            {availableListsForMove.length === 0 && (
              <p className={styles.noListsMessage}>
                Нет других списков для {mediaType === 'movie' ? 'фильмов' : 'сериалов'}
              </p>
            )}
          </div>
        }
        onConfirm={handleMoveItem}
        onCancel={() => {
          setShowMoveDialog(false);
          setTargetListId('');
          setSelectedItem(null);
        }}
        confirmText="Переместить"
        cancelText="Отмена"
        confirmButtonStyle="primary"
        confirmDisabled={!targetListId}
      />

      {/* Модалка удаления */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Удалить из списка"
        message={`Вы уверены, что хотите удалить "${selectedItem?.title}" из списка "${selectedList?.name}"?`}
        onConfirm={handleDeleteItem}
        onCancel={() => {
          setShowDeleteDialog(false);
          setSelectedItem(null);
        }}
        confirmText="Удалить"
        cancelText="Отмена"
        confirmButtonStyle="danger"
      />
    </UserPageLayout>
  );
};

export default ListsPage;
