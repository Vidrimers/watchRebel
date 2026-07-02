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

  // Состояние для Telegram
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramText, setTelegramText] = useState('');
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [sendingToSelf, setSendingToSelf] = useState(false);
  const [telegramProgress, setTelegramProgress] = useState(null);

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

  const handleSendTelegramAd = async () => {
    if (!telegramText.trim()) return;
    try {
      setSendingTelegram(true);
      setTelegramProgress({ current: 0, total: 0 });
      const response = await api.post('/admin/telegram-announcement', {
        content: telegramText.trim()
      });
      setTelegramProgress({
        current: response.data.success,
        total: response.data.total,
        failed: response.data.failed
      });
      setTimeout(() => {
        setShowTelegramModal(false);
        setTelegramText('');
        setTelegramProgress(null);
      }, 3000);
    } catch (err) {
      console.error('Ошибка отправки в Telegram:', err);
      setError('Не удалось отправить в Telegram');
      setTelegramProgress(null);
    } finally {
      setSendingTelegram(false);
    }
  };

  const handleSendToSelf = async () => {
    if (!telegramText.trim()) return;
    try {
      setSendingToSelf(true);
      await api.post('/admin/telegram-announcement-self', {
        content: telegramText.trim()
      });
      alert('Реклама отправлена вам в Telegram!');
    } catch (err) {
      console.error('Ошибка отправки себе:', err);
      setError('Не удалось отправить');
    } finally {
      setSendingToSelf(false);
    }
  };

  const insertFormatting = (before, after = '', placeholder = '') => {
    const textarea = document.querySelector(`.${styles.telegramTextarea}`);
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = telegramText.substring(start, end);
    const textToInsert = selectedText || placeholder;
    const newText = telegramText.substring(0, start) + before + textToInsert + after + telegramText.substring(end);
    setTelegramText(newText);
    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        const pos = start + before.length + selectedText.length;
        textarea.setSelectionRange(pos, pos);
      } else {
        const s = start + before.length;
        textarea.setSelectionRange(s, s + placeholder.length);
      }
    }, 0);
  };

  const handleBold = () => insertFormatting('*', '*', 'текст');
  const handleItalic = () => insertFormatting('_', '_', 'текст');
  const handleUnderline = () => insertFormatting('__', '__', 'текст');
  const handleStrikethrough = () => insertFormatting('~', '~', 'текст');
  const handleCode = () => insertFormatting('`', '`', 'код');
  const handleQuote = () => {
    const textarea = document.querySelector(`.${styles.telegramTextarea}`);
    if (!textarea) return;
    const start = textarea.selectionStart;
    const newText = telegramText.substring(0, start) + '> ' + telegramText.substring(start);
    setTelegramText(newText);
    setTimeout(() => { textarea.focus(); textarea.setSelectionRange(start + 2, start + 2); }, 0);
  };

  const renderTelegramPreview = (text) => {
    if (!text) return 'Превью появится здесь...';
    let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(/```\n?([\s\S]+?)\n?```/g, '<pre>$1</pre>');
    html = html.replace(/`([^`]+?)`/g, '<code>$1</code>');
    html = html.replace(/\*([^*]+?)\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+?)__/g, '<u>$1</u>');
    html = html.replace(/(?<!_)_([^_]+?)_(?!_)/g, '<em>$1</em>');
    html = html.replace(/~([^~]+?)~/g, '<s>$1</s>');
    html = html.replace(/^&gt;\s(.+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/\n/g, '<br/>');
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
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

          <div className={styles.createButtons}>
            <button
              type="submit"
              className={styles.createButton}
              disabled={creating || (!newAdContent.trim() && selectedImages.length === 0)}
            >
              {creating ? 'Публикация...' : 'Опубликовать рекламу'}
            </button>
            <button
              type="button"
              className={styles.telegramButton}
              onClick={() => setShowTelegramModal(true)}
            >
              <Icon name="telegram" size="small" /> Реклама в ТГ
            </button>
          </div>
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

      {/* Модальное окно Telegram */}
      {showTelegramModal && (
        <div className={styles.telegramModal}>
          <div className={styles.telegramModalContent}>
            <h3><Icon name="telegram" size="medium" /> Отправить рекламу в Telegram</h3>
            <p className={styles.telegramModalDescription}>
              Реклама будет отправлена всем пользователям через Telegram бота
            </p>

            <div className={styles.formattingToolbar}>
              <button type="button" onClick={handleBold} className={styles.formatButton} title="Жирный" disabled={sendingTelegram || sendingToSelf}><strong>B</strong></button>
              <button type="button" onClick={handleItalic} className={styles.formatButton} title="Курсив" disabled={sendingTelegram || sendingToSelf}><em>I</em></button>
              <button type="button" onClick={handleUnderline} className={styles.formatButton} title="Подчёркнутый" disabled={sendingTelegram || sendingToSelf}><u>U</u></button>
              <button type="button" onClick={handleStrikethrough} className={styles.formatButton} title="Зачёркнутый" disabled={sendingTelegram || sendingToSelf}><s>S</s></button>
              <button type="button" onClick={handleCode} className={styles.formatButton} title="Код" disabled={sendingTelegram || sendingToSelf}><code>{'<>'}</code></button>
              <button type="button" onClick={handleQuote} className={styles.formatButton} title="Цитата" disabled={sendingTelegram || sendingToSelf}><span>"</span></button>
            </div>

            <textarea
              value={telegramText}
              onChange={(e) => setTelegramText(e.target.value)}
              placeholder="Введите текст рекламы для Telegram..."
              className={`${styles.textarea} ${styles.telegramTextarea}`}
              rows={6}
              disabled={sendingTelegram || sendingToSelf}
            />

            <div className={styles.previewSection}>
              <h4>Превью:</h4>
              <div className={styles.telegramPreview}>
                {renderTelegramPreview(telegramText)}
              </div>
            </div>

            {telegramProgress && (
              <div className={styles.progressInfo}>
                <p>Отправлено: {telegramProgress.current} из {telegramProgress.total}</p>
                {telegramProgress.failed > 0 && (
                  <p className={styles.progressError}>Не удалось: {telegramProgress.failed}</p>
                )}
              </div>
            )}

            <div className={styles.telegramModalButtons}>
              <button className={styles.telegramSendToSelfButton} onClick={handleSendToSelf} disabled={sendingTelegram || sendingToSelf || !telegramText.trim()}>
                {sendingToSelf ? 'Отправка...' : 'Отправить себе'}
              </button>
              <button className={styles.telegramSendButton} onClick={handleSendTelegramAd} disabled={sendingTelegram || sendingToSelf || !telegramText.trim()}>
                {sendingTelegram ? 'Отправка...' : 'Отправить'}
              </button>
              <button className={styles.telegramCancelButton} onClick={() => { setShowTelegramModal(false); setTelegramText(''); setTelegramProgress(null); }} disabled={sendingTelegram || sendingToSelf}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvertisingAdminPage;
