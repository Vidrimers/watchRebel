import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import UserPageLayout from '../components/Layout/UserPageLayout';
import BanIndicator from '../components/User/BanIndicator';
import UserModerationModal from '../components/Settings/UserModerationModal';
import api from '../services/api';
import styles from './UsersManagementPage.module.css';

/**
 * Страница управления пользователями для админа
 * Позволяет искать, просматривать и управлять пользователями
 */
const UsersManagementPage = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAppSelector((state) => state.auth);
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModerationModal, setShowModerationModal] = useState(false);
  
  const USERS_PER_PAGE = 25;

  // Проверяем, является ли пользователь админом
  const isAdmin = currentUser?.isAdmin || currentUser?.id === '137981675';

  // Если не админ, перенаправляем на главную
  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
    }
  }, [isAdmin, navigate]);

  // Загрузка пользователей
  const loadUsers = useCallback(async (query = '', pageNum = 1, append = false) => {
    try {
      if (!append) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      let response;
      if (query.trim()) {
        // Поиск пользователей
        response = await api.get('/users/search', {
          params: { q: query }
        });
        // При поиске возвращаются все результаты, пагинация не нужна
        setHasMore(false);
      } else {
        // Получение всех пользователей через админ API
        response = await api.get('/admin/users');
        // Пагинация на клиенте
        const allUsers = response.data;
        const startIndex = (pageNum - 1) * USERS_PER_PAGE;
        const endIndex = startIndex + USERS_PER_PAGE;
        const paginatedUsers = allUsers.slice(startIndex, endIndex);
        
        if (append) {
          setUsers(prev => [...prev, ...paginatedUsers]);
        } else {
          setUsers(paginatedUsers);
        }
        
        setHasMore(endIndex < allUsers.length);
        return;
      }

      if (append) {
        setUsers(prev => [...prev, ...response.data]);
      } else {
        setUsers(response.data);
      }

    } catch (err) {
      console.error('Ошибка загрузки пользователей:', err);
      setError('Не удалось загрузить пользователей');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Начальная загрузка
  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin, loadUsers]);

  // Debounce для поиска
  useEffect(() => {
    if (!isAdmin) return;

    const timer = setTimeout(() => {
      setPage(1);
      loadUsers(searchQuery, 1, false);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, isAdmin, loadUsers]);

  // Загрузить еще пользователей
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadUsers(searchQuery, nextPage, true);
  };

  // Открыть профиль пользователя
  const handleOpenProfile = (userId) => {
    navigate(`/user/${userId}`);
  };

  // Открыть модерацию (переход в профиль, где есть AdminModerationPanel)
  const handleOpenModeration = (user) => {
    setSelectedUser(user);
    setShowModerationModal(true);
  };

  // Закрыть модальное окно модерации
  const handleCloseModerationModal = () => {
    setShowModerationModal(false);
    setSelectedUser(null);
  };

  // Обновить список после действий модерации
  const handleModerationUpdate = () => {
    loadUsers(searchQuery, 1, false);
  };

  // Форматирование даты
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <UserPageLayout user={currentUser}>
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>👥 Управление пользователями</h1>

        {/* Поиск */}
        <div className={styles.searchSection}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по имени или username..."
            className={styles.searchInput}
          />
        </div>

        {/* Ошибка */}
        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        {/* Загрузка */}
        {loading && (
          <div className={styles.loading}>
            Загрузка пользователей...
          </div>
        )}

        {/* Список пользователей */}
        {!loading && users.length > 0 && (
          <div className={styles.usersList}>
            {users.map(user => (
              <div key={user.id} className={styles.userCard}>
                {/* Аватар с индикатором блокировки */}
                <div className={styles.avatarContainer}>
                  <img
                    src={
                      user.avatarUrl?.startsWith('/uploads/')
                        ? `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${user.avatarUrl}`
                        : user.avatarUrl || '/default-avatar.png'
                    }
                    alt={user.displayName}
                    className={styles.avatar}
                  />
                  {user.isBlocked && (
                    <BanIndicator
                      banReason={user.banReason}
                      postBanUntil={user.postBanUntil}
                    />
                  )}
                </div>

                {/* Информация о пользователе */}
                <div className={styles.userInfo}>
                  <div className={styles.userName}>
                    {user.displayName}
                    {user.isAdmin && (
                      <span className={styles.adminBadge}>Админ</span>
                    )}
                    {user.isBlocked && (
                      <span className={styles.blockedBadge}>Заблокирован</span>
                    )}
                  </div>
                  <div className={styles.userUsername}>
                    @{user.telegramUsername || 'нет username'}
                  </div>
                  <div className={styles.userMeta}>
                    <span>Регистрация: {formatDate(user.createdAt)}</span>
                  </div>
                </div>

                {/* Действия */}
                <div className={styles.userActions}>
                  <button
                    onClick={() => handleOpenProfile(user.id)}
                    className={styles.btnProfile}
                  >
                    👤 Профиль
                  </button>
                  <button
                    onClick={() => handleOpenModeration(user)}
                    className={styles.btnModeration}
                  >
                    ⚖️ Модерация
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Пустое состояние */}
        {!loading && users.length === 0 && (
          <div className={styles.emptyState}>
            {searchQuery ? 'Пользователи не найдены' : 'Нет пользователей'}
          </div>
        )}

        {/* Кнопка "Загрузить еще" */}
        {!loading && hasMore && !searchQuery && (
          <div className={styles.loadMoreContainer}>
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className={styles.btnLoadMore}
            >
              {loadingMore ? 'Загрузка...' : 'Загрузить еще'}
            </button>
          </div>
        )}
      </div>

      {/* Модальное окно модерации */}
      {showModerationModal && selectedUser && (
        <UserModerationModal
          user={selectedUser}
          onClose={handleCloseModerationModal}
          onUpdate={handleModerationUpdate}
        />
      )}
    </UserPageLayout>
  );
};

export default UsersManagementPage;
