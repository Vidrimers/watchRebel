import React, { useState } from 'react';
import api from '../../services/api';
import useConfirm from '../../hooks/useConfirm';
import useAlert from '../../hooks/useAlert';
import { useNavigate } from 'react-router-dom';
import styles from './GroupSettingsModal.module.css';

const GroupSettingsModal = ({
  conversationId,
  currentName,
  currentAvatar,
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

  const handleRename = async () => {
    if (!groupName.trim() || groupName.trim() === currentName) return;
    setSaving(true);
    setError(null);
    try {
      await api.put(`/messages/conversations/${conversationId}`, {
        groupName: groupName.trim()
      });
      onUpdated({ groupName: groupName.trim() });
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

  const handleDeleteGroup = async () => {
    const confirmed = await showConfirm({
      title: 'Удалить группу?',
      message: 'Это действие необратимо. Все сообщения будут удалены.',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });
    if (!confirmed) return;

    try {
      await api.delete(`/messages/conversations/${conversationId}`);
      await showAlert({
        title: 'Группа удалена',
        type: 'success'
      });
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
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.body}>
          <div className={styles.section}>
            <label className={styles.label}>Название группы</label>
            <div className={styles.renameRow}>
              <input
                type="text"
                className={styles.input}
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                maxLength={50}
              />
              <button
                className={styles.saveBtn}
                onClick={handleRename}
                disabled={saving || !groupName.trim() || groupName.trim() === currentName}
              >
                {saving ? '...' : 'Сохранить'}
              </button>
            </div>
          </div>

          <div className={styles.section}>
            <label className={styles.label}>Аватарка группы</label>
            <div className={styles.avatarSection}>
              <div className={styles.avatarPreview}>
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
                  <div className={styles.avatarPlaceholder}>👥</div>
                )}
              </div>
              <button
                className={styles.uploadBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? 'Загрузка...' : 'Изменить'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                style={{ display: 'none' }}
                onChange={handleAvatarUpload}
              />
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}
        </div>

        <div className={styles.footer}>
          <button className={styles.deleteBtn} onClick={handleDeleteGroup}>
            Удалить группу
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupSettingsModal;
