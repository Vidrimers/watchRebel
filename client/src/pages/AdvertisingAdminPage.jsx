import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import Icon from '../components/Common/Icon';
import api from '../services/api';
import styles from './AdvertisingAdminPage.module.css';

const AdvertisingAdminPage = () => {
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);

  // Состояние для контактов
  const [contactText, setContactText] = useState('');
  const [contactEmail, setContactEmail] = useState('admin@watchrebel.com');
  const [contactTelegram, setContactTelegram] = useState('@watchrebel_admin');
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsSaving, setContactsSaving] = useState(false);
  const [isEditingContacts, setIsEditingContacts] = useState(false);

  // Состояние для рекламных постов
  const [adPosts, setAdPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newAdContent, setNewAdContent] = useState('');
  const [newAdLinkUrl, setNewAdLinkUrl] = useState('');
  const [newAdLinkLabel, setNewAdLinkLabel] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/');
      return;
    }
    loadContacts();
    loadAdPosts();
  }, [user, navigate]);

  // === Контакты ===
  const loadContacts = async () => {
    try {
      setContactsLoading(true);
      const response = await api.get('/settings/advertising_contacts');
      const value = response.data.value || '';
      const lines = value.split('\n');
      let email = 'admin@watchrebel.com';
      let telegram = '@watchrebel_admin';
      let text = '';

      lines.forEach(line => {
        const emailMatch = line.match(/Email:\s*(.+)/i);
        const telegramMatch = line.match(/Telegram:\s*(.+)/i);
        if (emailMatch) email = emailMatch[1].trim();
        else if (telegramMatch) telegram = telegramMatch[1].trim();
        else if (line.trim() && !line.includes('Email:') && !line.includes('Telegram:')) {
          text += (text ? '\n' : '') + line;
        }
      });

      setContactEmail(email);
      setContactTelegram(telegram);
      setContactText(text);
    } catch (err) {
      console.error('Ошибка загрузки контактов:', err);
    } finally {
      setContactsLoading(false);
    }
  };

  const handleSaveContacts = async () => {
    try {
      setContactsSaving(true);
      const contactsValue = `${contactText}\n\nEmail: ${contactEmail}\nTelegram: ${contactTelegram}`;
      await api.put('/settings/advertising_contacts', { value: contactsValue });
      setIsEditingContacts(false);
    } catch (err) {
      console.error('Ошибка сохранения контактов:', err);
      setError('Не удалось сохранить контакты');
    } finally {
      setContactsSaving(false);
    }
  };

  // === Рекламные посты ===
  const loadAdPosts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/advertising');
      setAdPosts(response.data);
      setError(null);
    } catch (err) {
      console.error('Ошибка загрузки рекламных постов:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAd = async (e) => {
    e.preventDefault();
    if (!newAdContent.trim() && selectedImages.length === 0) {
      setError('Добавьте текст или изображения');
      return;
    }

    try {
      setCreating(true);

      // Загружаем изображения
      const uploadedUrls = [];
      for (const image of selectedImages) {
        const formData = new FormData();
        formData.append('image', image);
        const uploadRes = await api.post('/admin/advertising/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (uploadRes.data?.url) {
          uploadedUrls.push(uploadRes.data.url);
        }
      }

      await api.post('/admin/advertising', {
        content: newAdContent.trim(),
        linkUrl: newAdLinkUrl.trim() || null,
        linkLabel: newAdLinkLabel.trim() || null,
        imageUrls: uploadedUrls
      });

      setNewAdContent('');
      setNewAdLinkUrl('');
      setNewAdLinkLabel('');
      setSelectedImages([]);
      setImagePreviews([]);
      setError(null);
      await loadAdPosts();
    } catch (err) {
      console.error('Ошибка создания рекламного поста:', err);
      setError('Не удалось создать рекламный пост');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAd = async (id) => {
    try {
      await api.delete(`/admin/advertising/${id}`);
      await loadAdPosts();
    } catch (err) {
      console.error('Ошибка удаления:', err);
      setError('Не удалось удалить рекламный пост');
    }
  };

  const addImages = (files) => {
    if (selectedImages.length + files.length > 5) {
      setError('Максимум 5 изображений');
      return;
    }
    const validFiles = [];
    const newPreviews = [];

    files.forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > 5 * 1024 * 1024) {
        setError('Размер изображения не более 5MB');
        return;
      }
      validFiles.push(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push(reader.result);
        if (newPreviews.length === validFiles.length) {
          setImagePreviews(prev => [...prev, ...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });

    setSelectedImages(prev => [...prev, ...validFiles]);
  };

  const handleImageSelect = (e) => addImages(Array.from(e.target.files));

  const handleRemoveImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.page}>
      <button className={styles.backButton} onClick={() => navigate('/settings')}>
        <Icon name="arrow-left" size="medium" />
        <span>Назад</span>
      </button>

      <h1 className={styles.title}>
        <Icon name="advertising" size="medium" /> Реклама
      </h1>

      {/* Контакты для рекламы */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Контакты для рекламы</h2>
          {!isEditingContacts && (
            <button onClick={() => setIsEditingContacts(true)} className={styles.btnEdit}>
              Редактировать
            </button>
          )}
        </div>

        {contactsLoading ? (
          <p className={styles.loading}>Загрузка...</p>
        ) : isEditingContacts ? (
          <div className={styles.editForm}>
            <div className={styles.formGroup}>
              <label>Текст:</label>
              <textarea
                value={contactText}
                onChange={(e) => setContactText(e.target.value)}
                className={styles.textarea}
                rows={3}
                placeholder="Для размещения рекламы свяжитесь с нами:"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Email:</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Telegram:</label>
              <input
                type="text"
                value={contactTelegram}
                onChange={(e) => setContactTelegram(e.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.formButtons}>
              <button onClick={handleSaveContacts} className={styles.btnSave} disabled={contactsSaving}>
                {contactsSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button onClick={() => { setIsEditingContacts(false); loadContacts(); }} className={styles.btnCancel}>
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.contactsDisplay}>
            {contactText && <p>{contactText}</p>}
            <p>
              <span className={styles.contactIcon}><Icon name="email" size="small" /></span>
              Email: {contactEmail}
            </p>
            <p>
              <span className={styles.contactIcon}><Icon name="telegram" size="small" /></span>
              Telegram: {contactTelegram}
            </p>
          </div>
        )}
      </div>

      {/* Создание рекламного поста */}
      <div className={styles.section}>
        <h2>Создать рекламный пост</h2>
        <form onSubmit={handleCreateAd} className={styles.createForm}>
          <div className={styles.textareaWrapper}>
            <textarea
              value={newAdContent}
              onChange={(e) => setNewAdContent(e.target.value)}
              placeholder="Текст рекламного поста..."
              className={styles.textarea}
              rows={4}
              disabled={creating}
            />
            <label htmlFor="adImageInput" className={styles.attachButton} title="Прикрепить изображения">
              <Icon name="paperclip" size="medium" />
            </label>
            <input
              id="adImageInput"
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className={styles.hiddenFileInput}
              disabled={creating || selectedImages.length >= 5}
            />
          </div>

          {imagePreviews.length > 0 && (
            <div className={styles.imagePreviews}>
              {imagePreviews.map((preview, index) => (
                <div key={index} className={styles.imagePreview}>
                  <img src={preview} alt={`Превью ${index + 1}`} />
                  <button type="button" className={styles.removeImageButton} onClick={() => handleRemoveImage(index)} disabled={creating}>
                    <Icon name="close" size="small" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Ссылка (URL):</label>
              <input
                type="url"
                value={newAdLinkUrl}
                onChange={(e) => setNewAdLinkUrl(e.target.value)}
                className={styles.input}
                placeholder="https://example.com"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Текст ссылки:</label>
              <input
                type="text"
                value={newAdLinkLabel}
                onChange={(e) => setNewAdLinkLabel(e.target.value)}
                className={styles.input}
                placeholder="Перейти"
              />
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            type="submit"
            className={styles.createButton}
            disabled={creating || (!newAdContent.trim() && selectedImages.length === 0)}
          >
            {creating ? 'Публикация...' : 'Опубликовать рекламу'}
          </button>
        </form>
      </div>

      {/* Список рекламных постов */}
      <div className={styles.section}>
        <h2>Опубликованные рекламные посты</h2>
        {loading ? (
          <p className={styles.loading}>Загрузка...</p>
        ) : adPosts.length === 0 ? (
          <p className={styles.empty}>Рекламных постов пока нет</p>
        ) : (
          <div className={styles.adList}>
            {adPosts.map((post) => (
              <div key={post.id} className={styles.adCard}>
                <div className={styles.adHeader}>
                  <span className={styles.adDate}>{formatDate(post.createdAt)}</span>
                  <button onClick={() => handleDeleteAd(post.id)} className={styles.deleteButton} title="Удалить">
                    <Icon name="delete" size="small" />
                  </button>
                </div>
                <p className={styles.adContent}>{post.content}</p>
                {post.linkUrl && (
                  <a href={post.linkUrl} target="_blank" rel="noopener noreferrer" className={styles.adLink}>
                    {post.linkLabel || post.linkUrl}
                  </a>
                )}
                {post.imageUrls && post.imageUrls.length > 0 && (
                  <div className={styles.adImages}>
                    {post.imageUrls.map((url, i) => (
                      <img key={i} src={url.startsWith('http') ? url : `${import.meta.env.VITE_API_URL || ''}${url}`} alt="" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvertisingAdminPage;
