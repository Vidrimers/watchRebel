import React, { useState } from 'react';
import api from '../../services/api';
import useConfirm from '../../hooks/useConfirm';
import useAlert from '../../hooks/useAlert';
import { useNavigate } from 'react-router-dom';
import Icon from '../Common/Icon';
import styles from './GroupSettingsModal.module.css';

const GroupSettingsModal = ({
  conversationId,
  currentName,
  currentAvatar,
  isCreator,
  isSecretGroup,
  showCreatorLabel: initialShowCreator,
  showModeratorLabel: initialShowModerator,
  onClose,
  onUpdated
}) => {
  const navigate = useNavigate();
  const { confirmDialog, showConfirm } = useConfirm();
  const { alertDialog, showAlert } = useAlert();
  const [groupName, setGroupName] = useState(currentName || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = React.useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showCreatorLabel, setShowCreatorLabel] = useState(initialShowCreator !== false);
  const [showModeratorLabel, setShowModeratorLabel] = useState(initialShowModerator !== false);

  const handleRename = async () => {
    if (!groupName.trim() || groupName.trim() === currentName) return;
    setSaving(true);
    setError(null);
    try {
      await api.put(`/messages/conversations/${conversationId}`, {
        groupName: groupName.trim()
      });
      onUpdated({ groupName: groupName.trim() });
      await showAlert({ title: 'Готово', message: 'Название обновлено', type: 'success' });
    } catch (err) {
      setError(err.data?.error || 'Ошибка переименования');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Файл слишком большой (макс 5 МБ)');
      return;
    }

    setUploadingAvatar(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const response = await api.post(`/messages/conversations/${conversationId}/avatar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onUpdated({ groupAvatar: response.data.avatarUrl });
    } catch (err) {
      setError(err.data?.error || 'Ошибка загрузки аватарки');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSettingChange = async (setting, value) => {
    try {
      await api.patch(`/messages/conversations/${conversationId}/settings`, {
        [setting]: value
      });
      if (setting === 'showCreatorLabel') setShowCreatorLabel(value);
      if (setting === 'showModeratorLabel') setShowModeratorLabel(value);
      onUpdated({ [setting]: value });
    } catch (err) {
      await showAlert({ title: 'Ошибка', message: 'Не удалось сохранить настройку', type: 'error' });
    }
  };

  const handleDeleteGroup = async () => {
    const confirmed = await showConfirm({
      title: 'Удалить группу?',
      message: 'Это действие необратимо. Все сообщения будут удалены.',
      confirmText: 'Удалить',
      cancelText: 'Отмена'
    });
    if (!confirmed) return;

    try {
      await api.delete(`/messages/conversations/${conversationId}`);
      await showAlert({ title: 'Группа удалена', type: 'success' });
      navigate('/messages');
    } catch (err) {
      await showAlert({
        title: 'Ошибка',
        message: err.data?.error || 'Не удалось удалить группу',
        type: 'error'
      });
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {confirmDialog}
        {alertDialog}
        <div className={styles.header}>
          <h3>Настройки группы</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <Icon name="close" size="small" />
          </button>
        </div>

        <div className={styles.body}>
          {/* Аватарка по центру */}
          <div className={styles.avatarSection}>
            <div className={styles.avatarWrapper}>
              {currentAvatar ? (
                <img
                  src={
                    currentAvatar.startsWith('/uploads/')
                      ? `${import.meta.env.VITE_API_URL || ''}${currentAvatar}`
                      : currentAvatar
                  }
                  alt={currentName}
                  className={styles.avatarImage}
                />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  {isSecretGroup ? '🔐' : '👥'}
                </div>
              )}
              {isCreator && (
                <button
                  className={styles.avatarEditBtn}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  <Icon name="edit" size="small" />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              style={{ display: 'none' }}
              onChange={handleAvatarUpload}
            />
            {uploadingAvatar && <span className={styles.uploadingText}>Загрузка...</span>}
          </div>

          {/* Название группы */}
          <div className={styles.section}>
            <label className={styles.sectionTitle}>Название</label>
            <div className={styles.inputRow}>
              <input
                type="text"
                className={styles.input}
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                maxLength={50}
                disabled={!isCreator}
              />
              {isCreator && (
                <button
                  className={styles.saveBtn}
                  onClick={handleRename}
                  disabled={saving || !groupName.trim() || groupName.trim() === currentName}
                >
                  {saving ? '...' : 'Сохранить'}
                </button>
              )}
            </div>
          </div>

          {/* Настройки отображения (только для создателя) */}
          {isCreator && (
            <div className={styles.section}>
              <label className={styles.sectionTitle}>Отображение</label>
              <div className={styles.settingsList}>
                <label className={styles.settingItem}>
                  <input
                    type="checkbox"
                    checked={showCreatorLabel}
                    onChange={(e) => handleSettingChange('showCreatorLabel', e.target.checked)}
                    className={styles.checkbox}
                  />
                  <div className={styles.settingInfo}>
                    <span className={styles.settingLabel}>Показывать "Создатель"</span>
                    <span className={styles.settingDesc}>Отображать метку создателя в списке участников</span>
                  </div>
                </label>
                <label className={styles.settingItem}>
                  <input
                    type="checkbox"
                    checked={showModeratorLabel}
                    onChange={(e) => handleSettingChange('showModeratorLabel', e.target.checked)}
                    className={styles.checkbox}
                  />
                  <div className={styles.settingInfo}>
                    <span className={styles.settingLabel}>Показывать "Модератор"</span>
                    <span className={styles.settingDesc}>Отображать метку модераторов в списке участников</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}

          {/* Опасная зона */}
          {isCreator && (
            <div className={styles.dangerZone}>
              <label className={styles.sectionTitle}>Опасная зона</label>
              <button className={styles.deleteBtn} onClick={handleDeleteGroup}>
                <Icon name="delete" size="small" />
                Удалить группу
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupSettingsModal;
