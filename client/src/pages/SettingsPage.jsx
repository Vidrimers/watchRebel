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
import EmailConnectionBlock from '../components/Settings/EmailConnectionBlock';
import NotificationSettings from '../components/Settings/NotificationSettings';
import Icon from '../components/Common/Icon';
import useConfirm from '../hooks/useConfirm.jsx';
import useAlert from '../hooks/useAlert.jsx';
import api from '../services/api';
import styles from './SettingsPage.module.css';

const SettingsPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated, loading } = useAppSelector((state) => state.auth);
  const { confirmDialog, showConfirm } = useConfirm();
  const { alertDialog, showAlert } = useAlert();

  const [isEditingName, setIsEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(user?.displayName || '');
  const [saveError, setSaveError] = useState(null);
  const [openSection, setOpenSection] = useState(null);

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
    const firstConfirm = await showConfirm({
      title: 'Удаление аккаунта',
      message: 'Вы уверены, что хотите удалить свой аккаунт? Это действие необратимо!',
      confirmText: 'Продолжить',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });
    if (!firstConfirm) return;

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
      await api.delete('/users/me', { data: { confirmation: 'УДАЛИТЬ' } });
      await showAlert({ title: 'Аккаунт удален', message: 'Ваш аккаунт и все данные успешно удалены.', type: 'success' });
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
      await dispatch(updateProfile({ userId: user.id, displayName: newDisplayName.trim() })).unwrap();
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

  const toggleSection = (sectionId) => {
    setOpenSection(prev => prev === sectionId ? null : sectionId);
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
          <h1 className={styles.pageTitle}><Icon name="settings" size="medium" /> Настройки</h1>

          {/* Группа 1: Профиль — всегда развёрнута */}
          <div className={styles.settingsCard}>
            <h3 className={styles.cardTitle}>Профиль</h3>

            {/* Аватарка */}
            <div className={styles.profileAvatarSection}>
              <AvatarUpload user={user} />
            </div>

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
                      <button onClick={handleSaveName} className={styles.saveButton} disabled={loading}>
                        {loading ? 'Сохранение...' : 'Сохранить'}
                      </button>
                      <button onClick={handleCancelEdit} className={styles.cancelButton} disabled={loading}>
                        Отмена
                      </button>
                    </div>
                    {saveError && <div className={styles.errorMessage}>{saveError}</div>}
                  </div>
                ) : (
                  <div className={styles.nameDisplay}>
                    <span className={styles.infoValue}>{user.displayName}</span>
                    <button onClick={() => setIsEditingName(true)} className={styles.editButton}>
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

          {/* Группа 2: Оформление */}
          <div className={styles.settingsCard}>
            <button className={styles.accordionHeader} onClick={() => toggleSection('appearance')}>
              <div className={styles.accordionHeaderLeft}>
                <Icon name="theme" size="medium" />
                <span className={styles.accordionTitle}>Оформление</span>
              </div>
              <Icon name="chevron-down" size="small" className={`${styles.accordionChevron} ${openSection === 'appearance' ? styles.open : ''}`} />
            </button>
            {openSection === 'appearance' && (
              <div className={styles.accordionContent}>
                <ThemeDropdown embedded />
              </div>
            )}
          </div>

          {/* Группа 3: Приватность и уведомления */}
          <div className={styles.settingsCard}>
            <button className={styles.accordionHeader} onClick={() => toggleSection('privacy')}>
              <div className={styles.accordionHeaderLeft}>
                <Icon name="shield" size="medium" />
                <span className={styles.accordionTitle}>Приватность и уведомления</span>
              </div>
              <Icon name="chevron-down" size="small" className={`${styles.accordionChevron} ${openSection === 'privacy' ? styles.open : ''}`} />
            </button>
            {openSection === 'privacy' && (
              <div className={styles.accordionContent}>
                <div className={styles.accordionSection}>
                  <h4 className={styles.accordionSectionTitle}>Приватность стены</h4>
                  <p className={styles.cardDescription}>Выберите, кто может писать на вашей стене</p>
                  <select
                    className={styles.privacySelect}
                    value={user.wallPrivacy || 'all'}
                    onChange={async (e) => {
                      try {
                        await dispatch(updateProfile({ userId: user.id, wallPrivacy: e.target.value })).unwrap();
                      } catch (error) {
                        console.error('Ошибка обновления приватности:', error);
                        await showAlert({ title: 'Ошибка', message: 'Не удалось обновить настройки приватности', type: 'error' });
                      }
                    }}
                  >
                    <option value="all">Все</option>
                    <option value="friends">Только друзья</option>
                    <option value="none">Никто</option>
                  </select>
                </div>
                <div className={styles.accordionSection}>
                  <h4 className={styles.accordionSectionTitle}>Уведомления в Telegram</h4>
                  <NotificationSettings userId={user.id} />
                </div>
              </div>
            )}
          </div>

          {/* Группа 4: Аккаунт и безопасность */}
          <div className={styles.settingsCard}>
            <button className={styles.accordionHeader} onClick={() => toggleSection('account')}>
              <div className={styles.accordionHeaderLeft}>
                <Icon name="lock" size="medium" />
                <span className={styles.accordionTitle}>Аккаунт и безопасность</span>
              </div>
              <Icon name="chevron-down" size="small" className={`${styles.accordionChevron} ${openSection === 'account' ? styles.open : ''}`} />
            </button>
            {openSection === 'account' && (
              <div className={styles.accordionContent}>
                <div className={styles.accordionSection}>
                  <h4 className={styles.accordionSectionTitle}>Связанные аккаунты</h4>
                  <EmailConnectionBlock />
                  <TelegramConnectionBlock />
                  <GoogleConnectionBlock />
                  <DiscordConnectionBlock />
                </div>
                <div className={styles.accordionSection}>
                  <button onClick={handleLogout} className={styles.logoutButton}>
                    Выйти из аккаунта
                  </button>
                </div>
                <div className={styles.accordionSection}>
                  <h4 className={styles.accordionSectionTitle}>Удаление аккаунта</h4>
                  <p className={styles.dangerWarning}>
                    ⚠️ Внимание! Удаление аккаунта необратимо. Все ваши данные (списки, оценки, посты, сообщения) будут безвозвратно удалены.
                  </p>
                  <button onClick={handleDeleteAccount} className={styles.deleteButton}>
                    <Icon name="delete" size="small" /> Удалить аккаунт
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Группа 5: Поддержка */}
          <div className={styles.settingsCard}>
            <button className={styles.accordionHeader} onClick={() => toggleSection('support')}>
              <div className={styles.accordionHeaderLeft}>
                <Icon name="bug" size="medium" />
                <span className={styles.accordionTitle}>Поддержка</span>
              </div>
              <Icon name="chevron-down" size="small" className={`${styles.accordionChevron} ${openSection === 'support' ? styles.open : ''}`} />
            </button>
            {openSection === 'support' && (
              <div className={styles.accordionContent}>
                <button
                  onClick={() => navigate('/my-bug-reports')}
                  className={styles.settingsNavigationButton}
                >
                <Icon name="support" size="medium" />
                  <span>Мои багрепорты</span>
                  <Icon name="chevron-right" size="small" />
                </button>
              </div>
            )}
          </div>

          {/* Админ-панель */}
          {isAdmin && <AdminPanel />}
        </div>
      </UserPageLayout>
    </>
  );
};

export default SettingsPage;
