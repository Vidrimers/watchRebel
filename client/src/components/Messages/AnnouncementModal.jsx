import React, { useState, useRef } from 'react';
import api from '../../services/api';
import useAlert from '../../hooks/useAlert';
import Icon from '../Common/Icon';
import styles from './AnnouncementModal.module.css';

const AnnouncementModal = ({ conversationId, onClose, onSent }) => {
  const [content, setContent] = useState('');
  const [images, setImages] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const { alertDialog, showAlert } = useAlert();
  const fileInputRef = useRef(null);

  const handleAddImage = (e) => {
    const files = Array.from(e.target.files);
    const maxSize = 10 * 1024 * 1024; // 10MB

    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        setError('Только изображения');
        return false;
      }
      if (file.size > maxSize) {
        setError(`Файл ${file.name} слишком большой (макс 10МБ)`);
        return false;
      }
      return true;
    });

    if (images.length + validFiles.length > 5) {
      setError('Максимум 5 изображений');
      return;
    }

    setImages(prev => [...prev, ...validFiles]);
    setError(null);
    e.target.value = '';
  };

  const handleRemoveImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if ((!content.trim() && images.length === 0) || sending) return;

    setSending(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('conversationId', conversationId);
      if (content.trim()) {
        formData.append('content', content.trim());
      }
      images.forEach(file => {
        formData.append('images', file);
      });

      const response = await api.post('/messages/announcement', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      onSent?.(response.data);
      onClose();
    } catch (err) {
      setError(err.data?.error || 'Ошибка отправки объявления');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      {alertDialog}
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3><Icon name="announcement" size="medium" /> Объявление</h3>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.body}>
          <textarea
            className={styles.textarea}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Текст объявления..."
            rows={4}
            maxLength={2000}
            autoFocus
          />

          {images.length > 0 && (
            <div className={styles.imagesPreview}>
              {images.map((file, index) => (
                <div key={index} className={styles.imageItem}>
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className={styles.imageThumb}
                  />
                  <button
                    className={styles.removeImage}
                    onClick={() => handleRemoveImage(index)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.actions}>
            <button
              className={styles.addImageBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={images.length >= 5}
            >
              <Icon name="image" size="small" /> Изображение
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleAddImage}
            />
            <span className={styles.charCount}>{content.length}/2000</span>
          </div>

          {error && <div className={styles.error}>{error}</div>}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Отмена</button>
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={sending || (!content.trim() && images.length === 0)}
          >
            {sending ? 'Отправка...' : 'Отправить'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementModal;
