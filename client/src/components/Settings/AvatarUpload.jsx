import React, { useState, useRef } from 'react';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { updateProfile } from '../../store/slices/authSlice';
import styles from './AvatarUpload.module.css';

/**
 * Компонент для загрузки аватарки пользователя
 */
const AvatarUpload = ({ user }) => {
  const dispatch = useAppDispatch();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Проверка типа файла
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Недопустимый тип файла. Разрешены только изображения (JPEG, PNG, GIF, WebP)');
      return;
    }

    // Проверка размера файла (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Файл слишком большой. Максимальный размер: 5MB');
      return;
    }

    // Создаем превью
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);

    // Загружаем файл
    handleUpload(file);
  };

  const handleUpload = async (file) => {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      await dispatch(updateProfile({ 
        userId: user.id, 
        formData 
      })).unwrap();

      // Очищаем превью после успешной загрузки
      setPreviewUrl(null);
    } catch (err) {
      setError(err.message || 'Ошибка загрузки аватарки');
      setPreviewUrl(null);
    } finally {
      setUploading(false);
      // Очищаем input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const getAvatarUrl = () => {
    if (previewUrl) return previewUrl;
    if (user.avatarUrl) {
      // Если аватарка загружена на сервер
      if (user.avatarUrl.startsWith('/uploads/')) {
        return `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${user.avatarUrl}`;
      }
      // Если аватарка из Telegram
      return user.avatarUrl;
    }
    return null;
  };

  return (
    <div className={styles.avatarUploadContainer}>
      <div className={styles.avatarPreview}>
        {getAvatarUrl() ? (
          <img 
            src={getAvatarUrl()} 
            alt="Аватар" 
            className={styles.avatarImage}
          />
        ) : (
          <div className={styles.avatarPlaceholder}>
            <span className={styles.placeholderIcon}>👤</span>
          </div>
        )}
        {uploading && (
          <div className={styles.uploadingOverlay}>
            <div className={styles.spinner}></div>
          </div>
        )}
      </div>

      <div className={styles.uploadControls}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          onChange={handleFileSelect}
          className={styles.fileInput}
        />
        <button
          onClick={handleButtonClick}
          disabled={uploading}
          className={styles.uploadButton}
        >
          {uploading ? 'Загрузка...' : '📷 Изменить аватарку'}
        </button>
        <p className={styles.uploadHint}>
          Максимальный размер: 5MB. Форматы: JPEG, PNG, GIF, WebP
        </p>
      </div>

      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}
    </div>
  );
};

export default AvatarUpload;
