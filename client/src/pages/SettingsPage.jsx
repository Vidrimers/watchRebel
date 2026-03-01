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
import NotificationSettings from '../components/Settings/NotificationSettings';
import Icon from '../components/Common/Icon';
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
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showAccountsSettings, setShowAccountsSettings] = useState(false);

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
        {!showNotificationSettings && !showAccountsSettings ? (
          <>
            <h1 className={styles.pageTitle}><Icon name="settings" size="medium" /> Настройки</h1>

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
                        <Icon name="edit" size="small" /> Изменить
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
                      <span className={styles.authMethod}><Icon name="telegram" size="small" /> Telegram</span>
                    )}
                    {user.email && (
                      <span className={styles.authMethod}><Icon name="email" size="small" /> Email</span>
                    )}
                    {user.hasGoogleLinked && (
                      <span className={styles.authMethod}><Icon name="google" size="small" /> Google</span>
                    )}
                    {user.hasDiscordLinked && (
                      <span className={styles.authMethod}><Icon name="discord" size="small" /> Discord</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Карточка с аватаркой */}
            <div className={styles.settingsCard}>
              <h3 className={styles.cardTitle}>Аватарка</h3>
              <AvatarUpload user={user} />
            </div>

            {/* Карточка с темой */}
            <ThemeDropdown />

            {/* Карточка с приватностью стены */}
            <div className={styles.settingsCard}>
              <h3 className={styles.cardTitle}>Приватность стены</h3>
              <p className={styles.cardDescription}>
                Выберите, кто может писать на вашей стене
              </p>
              <select 
                className={styles.privacySelect}
                value={user.wallPrivacy || 'all'}
                onChange={async (e) => {
                  try {
                    await dispatch(updateProfile({ 
                      userId: user.id, 
                      wallPrivacy: e.target.value 
                    })).unwrap();
                  } catch (error) {
                    console.error('Ошибка обновления приватности:', error);
                    await showAlert({
                      title: 'Ошибка',
                      message: 'Не удалось обновить настройки приватности',
                      type: 'error'
                    });
                  }
                }}
              >
                <option value="all">Все</option>
                <option value="friends">Только друзья</option>
                <option value="none">Никто</option>
              </select>
            </div>

            {/* Кнопка для открытия настроек уведомлений */}
            <div className={styles.settingsCard}>
              <h3 className={styles.cardTitle}>Уведомления</h3>
              <button 
                onClick={() => setShowNotificationSettings(true)}
                className={styles.notificationSettingsButton}
              >
                <Icon name="bell" size="medium" />
                <span>Уведомления в Telegram</span>
                <Icon name="chevron-right" size="small" />
              </button>
            </div>

            {/* Кнопка для открытия настроек связанных аккаунтов */}
            <div className={styles.settingsCard}>
              <h3 className={styles.cardTitle}>Связанные аккаунты</h3>
              <button 
                onClick={() => setShowAccountsSettings(true)}
                className={styles.settingsNavigationButton}
              >
                <Icon name="link" size="medium" />
                <span>Управление аккаунтами</span>
                <Icon name="chevron-right" size="small" />
              </button>
            </div>

            {/* Карточка с выходом */}
            <div className={styles.settingsCard}>
              <h3 className={styles.cardTitle}>Сессия</h3>
              <button onClick={handleLogout} className={styles.logoutButton}>
                Выйти из аккаунта
              </button>
            </div>

            {/* Карточка с удалением аккаунта */}
            <div className={styles.settingsCard}>
              <h3 className={styles.cardTitle}>Удаление аккаунта</h3>
              <p className={styles.dangerWarning}>
                ⚠️ Внимание! Удаление аккаунта необратимо. Все ваши данные (списки, оценки, посты, сообщения) будут безвозвратно удалены.
              </p>
              <button onClick={handleDeleteAccount} className={styles.deleteButton}>
                <Icon name="delete" size="small" /> Удалить аккаунт
              </button>
            </div>

            {/* Админ-панель (только для админа) */}
            {isAdmin && <AdminPanel />}
          </>
        ) : showNotificationSettings ? (
          <>
            {/* Экран настроек уведомлений */}
            <div className={styles.notificationSettingsScreen}>
              <button 
                onClick={() => setShowNotificationSettings(false)}
                className={styles.backButton}
              >
                <Icon name="arrow-left" size="medium" />
                <span>Назад</span>
              </button>
              
              <div className={styles.settingsCard}>
                <NotificationSettings userId={user.id} />
              </div>
            </div>
          </>
        ) : showAccountsSettings ? (
          <>
            {/* Экран настроек связанных аккаунтов */}
            <div className={styles.accountsSettingsScreen}>
              <button 
                onClick={() => setShowAccountsSettings(false)}
                className={styles.backButton}
              >
                <Icon name="arrow-left" size="medium" />
                <span>Назад</span>
              </button>
              
              <h2 className={styles.screenTitle}>Связанные аккаунты</h2>
              
              {/* Блок управления Telegram */}
              <TelegramConnectionBlock />

              {/* Блок управления Google */}
              <GoogleConnectionBlock />

              {/* Блок управления Discord */}
              <DiscordConnectionBlock />
            </div>
          </>
        ) : null}
      </div>
    </UserPageLayout>
    </>
  );
};

export default SettingsPage;
