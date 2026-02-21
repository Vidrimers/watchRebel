import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { logout, updateProfile } from '../store/slices/authSlice';
import UserPageLayout from '../components/Layout/UserPageLayout';
import ThemeDropdown from '../components/Settings/ThemeDropdown';
import AdminPanel from '../components/Settings/AdminPanel';
import AvatarUpload from '../components/Settings/AvatarUpload';
import useConfirm from '../hooks/useConfirm.jsx';
import useAlert from '../hooks/useAlert.jsx';
import api from '../services/api';
import styles from './SettingsPage.module.css';

/**
 * Страница настроек пользователя
 * Отображает настройки в виде отдельных карточек
 */
const SettingsPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated, loading } = useAppSelector((state) => state.auth);
  const { confirmDialog, showConfirm } = useConfirm();
  const { alertDialog, showAlert } = useAlert();
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(user?.displayName || '');
  const [saveError, setSaveError] = useState(null);

  // Проверяем, является ли пользователь админом
  const isAdmin = user?.isAdmin || user?.id === '137981675';

  const handleLogout = async () => {
    const confirmed = await showConfirm({
      title: 'Выход из аккаунта',
      message: 'Вы уверены, что хотите выйти?',
      confirmText: 'Выйти',
      cancelText: 'Отмена',
      confirmButtonStyle: 'primary'
    });

    if (confirmed) {
      await dispatch(logout());
      navigate('/login');
    }
  };
  
  const handleSaveName = async () => {
    if (!newDisplayName || newDisplayName.trim().length < 2) {
      setSaveError('Имя должно содержать минимум 2 символа');
      return;
    }
    
    if (newDisplayName.trim().length > 50) {
      setSaveError('Имя не должно превышать 50 символов');
      return;
    }
    
    try {
      setSaveError(null);
      await dispatch(updateProfile({ 
        userId: user.id, 
        displayName: newDisplayName.trim() 
      })).unwrap();
      setIsEditingName(false);
    } catch (error) {
      setSaveError(error.message || 'Ошибка сохранения имени');
    }
  };
  
  const handleCancelEdit = () => {
    setNewDisplayName(user?.displayName || '');
    setIsEditingName(false);
    setSaveError(null);
  };

  if (!isAuthenticated) {
    return (
      <div className={styles.errorContainer}>
        <p>Необходимо авторизоваться</p>
      </div>
    );
  }

  return (
    <>
      {confirmDialog}
      {alertDialog}
      <UserPageLayout user={user}>
      <div className={styles.settingsContainer}>
        <h1 className={styles.pageTitle}>⚙️ Настройки</h1>

        {/* Карточка с темой */}
        <ThemeDropdown />

        {/* Карточка с аватаркой */}
        <div className={styles.settingsCard}>
          <h3 className={styles.cardTitle}>Аватарка</h3>
          <AvatarUpload user={user} />
        </div>

        {/* Карточка с информацией о профиле */}
        <div className={styles.settingsCard}>
          <h3 className={styles.cardTitle}>Профиль</h3>
          <div className={styles.profileInfo}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Имя:</span>
              {isEditingName ? (
                <div className={styles.editNameContainer}>
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    className={styles.nameInput}
                    placeholder="Введите новое имя"
                    maxLength={50}
                  />
                  <div className={styles.editButtons}>
                    <button 
                      onClick={handleSaveName} 
                      className={styles.saveButton}
                      disabled={loading}
                    >
                      {loading ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    <button 
                      onClick={handleCancelEdit} 
                      className={styles.cancelButton}
                      disabled={loading}
                    >
                      Отмена
                    </button>
                  </div>
                  {saveError && (
                    <div className={styles.errorMessage}>{saveError}</div>
                  )}
                </div>
              ) : (
                <div className={styles.nameDisplay}>
                  <span className={styles.infoValue}>{user.displayName}</span>
                  <button 
                    onClick={() => setIsEditingName(true)} 
                    className={styles.editButton}
                  >
                    ✏️ Изменить
                  </button>
                </div>
              )}
            </div>
            {user.telegramUsername && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Telegram:</span>
                <span className={styles.infoValue}>@{user.telegramUsername}</span>
              </div>
            )}
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>ID:</span>
              <span className={styles.infoValue}>{user.id}</span>
            </div>
          </div>
        </div>

        {/* Карточка с выходом */}
        <div className={styles.settingsCard}>
          <h3 className={styles.cardTitle}>Сессия</h3>
          <button onClick={handleLogout} className={styles.logoutButton}>
            Выйти из аккаунта
          </button>
        </div>

        {/* Админ-панель (только для админа) */}
        {isAdmin && <AdminPanel />}
      </div>
    </UserPageLayout>
    </>
  );
};

export default SettingsPage;
