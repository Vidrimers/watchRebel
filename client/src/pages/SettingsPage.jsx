import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { logout, updateProfile } from '../store/slices/authSlice';
import UserPageLayout from '../components/Layout/UserPageLayout';
import ThemeDropdown from '../components/Settings/ThemeDropdown';
import AdminPanel from '../components/Settings/AdminPanel';
import AvatarUpload from '../components/Settings/AvatarUpload';
import TelegramConnectionBlock from '../components/Settings/TelegramConnectionBlock';
import GoogleConnectionBlock from '../components/Settings/GoogleConnectionBlock';
import DiscordConnectionBlock from '../components/Settings/DiscordConnectionBlock';
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

  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [newUserStatus, setNewUserStatus] = useState(user?.userStatus || '');
  const [statusSaveError, setStatusSaveError] = useState(null);

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

  const handleDeleteAccount = async () => {
    // Первое подтверждение
    const firstConfirm = await showConfirm({
      title: 'Удаление аккаунта',
      message: 'Вы уверены, что хотите удалить свой аккаунт? Это действие необратимо!',
      confirmText: 'Продолжить',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });

    if (!firstConfirm) return;

    // Второе подтверждение с вводом текста
    const confirmation = prompt('Для подтверждения удаления введите слово "УДАЛИТЬ" (заглавными буквами):');
    
    if (confirmation !== 'УДАЛИТЬ') {
      await showAlert({
        title: 'Отмена',
        message: 'Удаление аккаунта отменено. Введено неверное подтверждение.',
        type: 'info'
      });
      return;
    }

    try {
      // Отправляем запрос на удаление
      await api.delete('/users/me', {
        data: { confirmation: 'УДАЛИТЬ' }
      });

      await showAlert({
        title: 'Аккаунт удален',
        message: 'Ваш аккаунт и все данные успешно удалены.',
        type: 'success'
      });

      // Выходим и перенаправляем на страницу входа
      await dispatch(logout());
      navigate('/login');
    } catch (error) {
      console.error('Ошибка удаления аккаунта:', error);
      await showAlert({
        title: 'Ошибка',
        message: error.response?.data?.error || 'Не удалось удалить аккаунт. Попробуйте позже.',
        type: 'error'
      });
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

  const handleSaveStatus = async () => {
    if (newUserStatus.trim().length > 100) {
      setStatusSaveError('Статус не может быть длиннее 100 символов');
      return;
    }
    
    try {
      setStatusSaveError(null);
      await dispatch(updateProfile({ 
        userId: user.id, 
        userStatus: newUserStatus.trim() 
      })).unwrap();
      setIsEditingStatus(false);
    } catch (error) {
      setStatusSaveError(error.message || 'Ошибка сохранения статуса');
    }
  };
  
  const handleCancelStatusEdit = () => {
    setNewUserStatus(user?.userStatus || '');
    setIsEditingStatus(false);
    setStatusSaveError(null);
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

        {/* Карточка со статусом */}
        <div className={styles.settingsCard}>
          <h3 className={styles.cardTitle}>Статус</h3>
          {isEditingStatus ? (
            <div className={styles.statusEditContainer}>
              <textarea
                value={newUserStatus}
                onChange={(e) => setNewUserStatus(e.target.value)}
                className={styles.statusInput}
                placeholder="Расскажите о себе..."
                maxLength={100}
                rows={3}
              />
              <div className={styles.statusCounter}>
                {newUserStatus.length}/100
              </div>
              <div className={styles.editButtons}>
                <button 
                  onClick={handleSaveStatus} 
                  className={styles.saveButton}
                  disabled={loading}
                >
                  {loading ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button 
                  onClick={handleCancelStatusEdit} 
                  className={styles.cancelButton}
                  disabled={loading}
                >
                  Отмена
                </button>
              </div>
              {statusSaveError && (
                <div className={styles.errorMessage}>{statusSaveError}</div>
              )}
            </div>
          ) : (
            <div className={styles.statusDisplay}>
              <p className={styles.statusText}>
                {user.userStatus || 'Статус не установлен'}
              </p>
              <button 
                onClick={() => setIsEditingStatus(true)} 
                className={styles.editButton}
              >
                ✏️ Изменить статус
              </button>
            </div>
          )}
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
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Способ входа:</span>
              <div className={styles.authMethodsContainer}>
                {user.telegramUsername && (
                  <span className={styles.authMethod}>📱 Telegram</span>
                )}
                {user.email && (
                  <span className={styles.authMethod}>✉️ Email</span>
                )}
                {user.hasGoogleLinked && (
                  <span className={styles.authMethod}>🔐 Google</span>
                )}
                {user.hasDiscordLinked && (
                  <span className={styles.authMethod}>💬 Discord</span>
                )}
              </div>
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

        {/* Блок управления Telegram */}
        <TelegramConnectionBlock />

        {/* Блок управления Google */}
        <GoogleConnectionBlock />

        {/* Блок управления Discord */}
        <DiscordConnectionBlock />

        {/* Карточка с удалением аккаунта */}
        <div className={styles.settingsCard}>
          <h3 className={styles.cardTitle}>Удаление аккаунта</h3>
          <p className={styles.dangerWarning}>
            ⚠️ Внимание! Удаление аккаунта необратимо. Все ваши данные (списки, оценки, посты, сообщения) будут безвозвратно удалены.
          </p>
          <button onClick={handleDeleteAccount} className={styles.deleteButton}>
            🗑️ Удалить аккаунт
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
