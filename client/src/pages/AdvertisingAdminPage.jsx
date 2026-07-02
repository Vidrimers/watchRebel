import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import Icon from '../components/Common/Icon';
import api from '../services/api';
import styles from './AdvertisingAdminPage.module.css';

const AdvertisingAdminPage = () => {
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);

  // === Вкладки ===
  const [activeTab, setActiveTab] = useState('advertising'); // 'advertising' | 'announcements'

  // === Контакты ===
  const [contactText, setContactText] = useState('');
  const [contactEmail, setContactEmail] = useState('admin@watchrebel.com');
  const [contactTelegram, setContactTelegram] = useState('@watchrebel_admin');
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsSaving, setContactsSaving] = useState(false);
  const [isEditingContacts, setIsEditingContacts] = useState(false);

  // === Общее ===
  const [error, setError] = useState(null);

  // === Рекламные посты ===
  const [adPosts, setAdPosts] = useState([]);
  const [loadingAd, setLoadingAd] = useState(true);
  const [newAdContent, setNewAdContent] = useState('');
  const [newAdLinkUrl, setNewAdLinkUrl] = useState('https://');
  const [newAdLinkLabel, setNewAdLinkLabel] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [creatingAd, setCreatingAd] = useState(false);

  // === Объявления ===
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnn, setLoadingAnn] = useState(true);
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [selectedAnnImages, setSelectedAnnImages] = useState([]);
  const [annImagePreviews, setAnnImagePreviews] = useState([]);
  const [creatingAnn, setCreatingAnn] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // === Telegram (общий) ===
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramText, setTelegramText] = useState('');
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [sendingToSelf, setSendingToSelf] = useState(false);
  const [telegramProgress, setTelegramProgress] = useState(null);
  const [telegramImage, setTelegramImage] = useState(null);
  const [telegramImagePreview, setTelegramImagePreview] = useState(null);

  // === История ===
  const [sentPosts, setSentPosts] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    if (!user?.isAdmin) { navigate('/'); return; }
    loadContacts();
    loadAdPosts();
    loadAnnouncements();
    loadSentPosts();
  }, [user, navigate]);

  // При смене вкладки перезагружаем историю
  useEffect(() => {
    loadSentPosts();
  }, [activeTab]);

  // ===================== КОНТАКТЫ =====================
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

  // ===================== РЕКЛАМА =====================
  const loadAdPosts = async () => {
    try {
      setLoadingAd(true);
      const response = await api.get('/admin/advertising');
      setAdPosts(response.data);
    } catch (err) {
      console.error('Ошибка загрузки рекламных постов:', err);
    } finally {
      setLoadingAd(false);
    }
  };

  const handleCreateAd = async (e) => {
    e.preventDefault();
    if (!newAdContent.trim() && selectedImages.length === 0) {
      setError('Добавьте текст или изображения'); return;
    }
    try {
      setCreatingAd(true);
      const uploadedUrls = [];
      for (const image of selectedImages) {
        const formData = new FormData();
        formData.append('image', image);
        const uploadRes = await api.post('/admin/advertising/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (uploadRes.data?.url) uploadedUrls.push(uploadRes.data.url);
      }
      await api.post('/admin/advertising', {
        content: newAdContent.trim(),
        linkUrl: newAdContent.trim() && newAdLinkUrl.trim() !== 'https://'
          ? (newAdLinkUrl.trim().startsWith('http') ? newAdLinkUrl.trim() : `https://${newAdLinkUrl.trim()}`)
          : null,
        linkLabel: newAdLinkLabel.trim() || null,
        imageUrls: uploadedUrls
      });
      setNewAdContent(''); setNewAdLinkUrl('https://'); setNewAdLinkLabel('');
      setSelectedImages([]); setImagePreviews([]); setError(null);
      await loadAdPosts();
    } catch (err) {
      console.error('Ошибка создания рекламного поста:', err);
      setError('Не удалось создать рекламный пост');
    } finally {
      setCreatingAd(false);
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

  // ===================== ОБЪЯВЛЕНИЯ =====================
  const loadAnnouncements = async () => {
    try {
      setLoadingAnn(true);
      const response = await api.get('/admin/announcements');
      setAnnouncements(response.data);
    } catch (err) {
      console.error('Ошибка загрузки объявлений:', err);
    } finally {
      setLoadingAnn(false);
    }
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!newAnnouncement.trim() && selectedAnnImages.length === 0) {
      setError('Добавьте текст или изображения'); return;
    }
    try {
      setCreatingAnn(true);
      const formData = new FormData();
      formData.append('content', newAnnouncement.trim() || ' ');
      selectedAnnImages.forEach(image => formData.append('images', image));
      await api.post('/admin/announcements', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setNewAnnouncement(''); setSelectedAnnImages([]); setAnnImagePreviews([]); setError(null);
      await loadAnnouncements();
    } catch (err) {
      console.error('Ошибка создания объявления:', err);
      setError('Не удалось создать объявление');
    } finally {
      setCreatingAnn(false);
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    try {
      await api.delete(`/admin/announcements/${id}`);
      await loadAnnouncements();
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Ошибка удаления:', err);
      setError('Не удалось удалить объявление');
    }
  };

  // ===================== ИЗОБРАЖЕНИЯ =====================
  const addImages = (files, setSelected, setPreviews, setErrorMsg) => {
    if (files.length > 5) { setErrorMsg('Максимум 5 изображений'); return; }
    const validFiles = [];
    const newPreviews = [];
    files.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > 5 * 1024 * 1024) { setErrorMsg('Размер не более 5MB'); return; }
      validFiles.push(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push(reader.result);
        if (newPreviews.length === validFiles.length) setPreviews(prev => [...prev, ...newPreviews]);
      };
      reader.readAsDataURL(file);
    });
    setSelected(prev => [...prev, ...validFiles]);
  };

  const handleImageSelect = (e) => addImages(Array.from(e.target.files), setSelectedImages, setImagePreviews, setError);
  const handleRemoveImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleAnnImageSelect = (e) => addImages(Array.from(e.target.files), setSelectedAnnImages, setAnnImagePreviews, setError);
  const handleRemoveAnnImage = (index) => {
    setSelectedAnnImages(prev => prev.filter((_, i) => i !== index));
    setAnnImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // ===================== TELEGRAM =====================
  const uploadTgImage = async () => {
    if (!telegramImage) return null;
    const formData = new FormData();
    formData.append('image', telegramImage);
    const uploadRes = await api.post('/admin/advertising/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return uploadRes.data?.url || null;
  };

  const handleSendTelegram = async () => {
    if (!telegramText.trim()) return;
    const type = activeTab === 'advertising' ? 'advertising' : 'announcement';
    try {
      setSendingTelegram(true);
      setTelegramProgress({ current: 0, total: 0 });
      const imageUrl = await uploadTgImage();
      const response = await api.post('/admin/telegram-announcement', {
        content: telegramText.trim(), imageUrl, type
      });
      setTelegramProgress({ current: response.data.success, total: response.data.total, failed: response.data.failed });
      setTimeout(() => {
        setShowTelegramModal(false); setTelegramText(''); setTelegramProgress(null);
        setTelegramImage(null); setTelegramImagePreview(null);
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
    const type = activeTab === 'advertising' ? 'advertising' : 'announcement';
    try {
      setSendingToSelf(true);
      const imageUrl = await uploadTgImage();
      await api.post('/admin/telegram-announcement-self', {
        content: telegramText.trim(), imageUrl, type
      });
      alert(`${type === 'advertising' ? 'Реклама' : 'Объявление'} отправлено вам в Telegram!`);
    } catch (err) {
      console.error('Ошибка отправки себе:', err);
      setError('Не удалось отправить');
    } finally {
      setSendingToSelf(false);
    }
  };

  const handleTelegramImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) return;
    setTelegramImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setTelegramImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  // ===================== ФОРМАТИРОВАНИЕ ТГ =====================
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
      if (selectedText) { const pos = start + before.length + selectedText.length; textarea.setSelectionRange(pos, pos); }
      else { const s = start + before.length; textarea.setSelectionRange(s, s + placeholder.length); }
    }, 0);
  };

  const insertAtCursor = (text) => {
    const textarea = document.querySelector(`.${styles.telegramTextarea}`);
    if (!textarea) return;
    const start = textarea.selectionStart;
    setTelegramText(telegramText.substring(0, start) + text + telegramText.substring(start));
    setTimeout(() => { textarea.focus(); textarea.setSelectionRange(start + text.length, start + text.length); }, 0);
  };

  const handleBold = () => insertFormatting('*', '*', 'текст');
  const handleItalic = () => insertFormatting('_', '_', 'текст');
  const handleUnderline = () => insertFormatting('__', '__', 'текст');
  const handleStrikethrough = () => insertFormatting('~', '~', 'текст');
  const handleCode = () => insertFormatting('`', '`', 'код');
  const handleMonospace = () => insertFormatting('```\n', '\n```', 'код');
  const handleQuote = () => insertAtCursor('> ');
  const handleLink = () => insertFormatting('[', '](https://example.com)', 'текст ссылки');
  const handleBulletList = () => insertAtCursor('• ');
  const handleNumberedList = () => {
    const textarea = document.querySelector(`.${styles.telegramTextarea}`);
    if (!textarea) return;
    const start = textarea.selectionStart;
    const lines = telegramText.substring(0, start).split('\n');
    const lastLine = lines[lines.length - 1];
    const match = lastLine.match(/^(\d+)\.\s/);
    insertAtCursor(`${match ? parseInt(match[1]) + 1 : 1}. `);
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

  // ===================== ИСТОРИЯ =====================
  const loadSentPosts = async () => {
    try {
      setLoadingHistory(true);
      const type = activeTab === 'advertising' ? 'advertising' : 'announcement';
      const response = await api.get('/admin/sent-posts', { params: { type } });
      setSentPosts(response.data);
    } catch (err) {
      console.error('Ошибка загрузки истории:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleRepeatPost = (post) => {
    if (activeTab === 'advertising') {
      setNewAdContent(post.content);
      setNewAdLinkUrl('https://');
      setNewAdLinkLabel('');
    } else {
      setNewAnnouncement(post.content);
    }
    setSelectedImages([]); setImagePreviews([]);
    setSelectedAnnImages([]); setAnnImagePreviews([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteSentPost = async (id) => {
    try { await api.delete(`/admin/sent-posts/${id}`); await loadSentPosts(); }
    catch (err) { console.error('Ошибка удаления:', err); }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // ===================== RENDER =====================
  const tgTitle = activeTab === 'advertising' ? 'Отправить рекламу в Telegram' : 'Отправить объявление в Telegram';
  const tgDescription = activeTab === 'advertising'
    ? 'Реклама будет отправлена всем пользователям через Telegram бота'
    : 'Объявление будет отправлено всем пользователям через Telegram бота';

  return (
    <div className={styles.page}>
      <button className={styles.backButton} onClick={() => navigate('/settings')}>
        <Icon name="arrow-left" size="medium" /><span>Назад</span>
      </button>

      <h1 className={styles.title}>
        <Icon name="advertising" size="medium" /> Объявления и реклама
      </h1>

      {/* ===== Контакты для рекламы ===== */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Контакты для рекламы</h2>
          {!isEditingContacts && (
            <button onClick={() => setIsEditingContacts(true)} className={styles.btnEdit}>Редактировать</button>
          )}
        </div>
        {contactsLoading ? (
          <p className={styles.loading}>Загрузка...</p>
        ) : isEditingContacts ? (
          <div className={styles.editForm}>
            <div className={styles.formGroup}>
              <label>Текст:</label>
              <textarea value={contactText} onChange={(e) => setContactText(e.target.value)} className={styles.textarea} rows={3} placeholder="Для размещения рекламы свяжитесь с нами:" />
            </div>
            <div className={styles.formGroup}>
              <label>Email:</label>
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={styles.input} />
            </div>
            <div className={styles.formGroup}>
              <label>Telegram:</label>
              <input type="text" value={contactTelegram} onChange={(e) => setContactTelegram(e.target.value)} className={styles.input} />
            </div>
            <div className={styles.formButtons}>
              <button onClick={handleSaveContacts} className={styles.btnSave} disabled={contactsSaving}>{contactsSaving ? 'Сохранение...' : 'Сохранить'}</button>
              <button onClick={() => { setIsEditingContacts(false); loadContacts(); }} className={styles.btnCancel}>Отмена</button>
            </div>
          </div>
        ) : (
          <div className={styles.contactsDisplay}>
            {contactText && <p>{contactText}</p>}
            <p><span className={styles.contactIcon}><Icon name="email" size="small" /></span> Email: {contactEmail}</p>
            <p><span className={styles.contactIcon}><Icon name="telegram" size="small" /></span> Telegram: {contactTelegram}</p>
          </div>
        )}
      </div>

      {/* ===== Вкладки ===== */}
      <div className={styles.tabs}>
        <button className={`${styles.tabButton} ${activeTab === 'advertising' ? styles.tabButtonActive : ''}`} onClick={() => setActiveTab('advertising')}>
          <Icon name="advertising" size="small" /> Реклама
        </button>
        <button className={`${styles.tabButton} ${activeTab === 'announcements' ? styles.tabButtonActive : ''}`} onClick={() => setActiveTab('announcements')}>
          <Icon name="announcement" size="small" /> Объявления
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* ===== ВКЛАДКА: РЕКЛАМА ===== */}
      {activeTab === 'advertising' && (
        <>
          {/* Создание рекламного поста */}
          <div className={styles.section}>
            <h2>Создать рекламный пост</h2>
            <form onSubmit={handleCreateAd} className={styles.createForm}>
              <div className={styles.textareaWrapper}>
                <textarea value={newAdContent} onChange={(e) => setNewAdContent(e.target.value)} placeholder="Текст рекламного поста..." className={styles.textarea} rows={4} disabled={creatingAd} />
                <label htmlFor="adImageInput" className={styles.attachButton} title="Прикрепить изображения"><Icon name="paperclip" size="medium" /></label>
                <input id="adImageInput" type="file" accept="image/*" multiple onChange={handleImageSelect} className={styles.hiddenFileInput} disabled={creatingAd || selectedImages.length >= 5} />
              </div>
              {imagePreviews.length > 0 && (
                <div className={styles.imagePreviews}>
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className={styles.imagePreview}>
                      <img src={preview} alt={`Превью ${index + 1}`} />
                      <button type="button" className={styles.removeImageButton} onClick={() => handleRemoveImage(index)} disabled={creatingAd}><Icon name="close" size="small" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Ссылка (URL):</label>
                  <input type="url" value={newAdLinkUrl} onChange={(e) => setNewAdLinkUrl(e.target.value)} className={styles.input} placeholder="google.com" />
                </div>
                <div className={styles.formGroup}>
                  <label>Текст ссылки:</label>
                  <input type="text" value={newAdLinkLabel} onChange={(e) => setNewAdLinkLabel(e.target.value)} className={styles.input} placeholder="Перейти" />
                </div>
              </div>
              <div className={styles.createButtons}>
                <button type="submit" className={styles.createButton} disabled={creatingAd || (!newAdContent.trim() && selectedImages.length === 0)}>
                  {creatingAd ? 'Публикация...' : 'Опубликовать рекламу'}
                </button>
                <button type="button" className={styles.telegramButton} onClick={() => setShowTelegramModal(true)}>
                  <Icon name="telegram" size="small" /> Реклама в ТГ
                </button>
              </div>
            </form>
          </div>

          {/* Список рекламных постов */}
          <div className={styles.section}>
            <h2>Опубликованные рекламные посты</h2>
            {loadingAd ? <p className={styles.loading}>Загрузка...</p>
            : adPosts.length === 0 ? <p className={styles.empty}>Рекламных постов пока нет</p>
            : (
              <div className={styles.adList}>
                {adPosts.map((post) => (
                  <div key={post.id} className={styles.adCard}>
                    <div className={styles.adHeader}>
                      <span className={styles.adDate}>{formatDate(post.createdAt)}</span>
                      <button onClick={() => handleDeleteAd(post.id)} className={styles.deleteButton} title="Удалить"><Icon name="delete" size="small" /></button>
                    </div>
                    <p className={styles.adContent}>{post.content}</p>
                    {post.linkUrl && <a href={post.linkUrl} target="_blank" rel="noopener noreferrer" className={styles.adLink}>{post.linkLabel || post.linkUrl}</a>}
                    {post.imageUrls && post.imageUrls.length > 0 && (
                      <div className={styles.adImages}>
                        {post.imageUrls.map((url, i) => <img key={i} src={url.startsWith('http') ? url : `${import.meta.env.VITE_API_URL || ''}${url}`} alt="" />)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== ВКЛАДКА: ОБЪЯВЛЕНИЯ ===== */}
      {activeTab === 'announcements' && (
        <>
          {/* Создание объявления */}
          <div className={styles.section}>
            <h2>Создать новое объявление</h2>
            <form onSubmit={handleCreateAnnouncement} className={styles.createForm}>
              <div className={styles.textareaWrapper}>
                <textarea value={newAnnouncement} onChange={(e) => setNewAnnouncement(e.target.value)} placeholder="Введите текст объявления..." className={styles.textarea} rows={4} disabled={creatingAnn} />
                <label htmlFor="annImageInput" className={styles.attachButton} title="Прикрепить изображения"><Icon name="paperclip" size="medium" /></label>
                <input id="annImageInput" type="file" accept="image/*" multiple onChange={handleAnnImageSelect} className={styles.hiddenFileInput} disabled={creatingAnn || selectedAnnImages.length >= 5} />
              </div>
              {annImagePreviews.length > 0 && (
                <div className={styles.imagePreviews}>
                  {annImagePreviews.map((preview, index) => (
                    <div key={index} className={styles.imagePreview}>
                      <img src={preview} alt={`Превью ${index + 1}`} />
                      <button type="button" className={styles.removeImageButton} onClick={() => handleRemoveAnnImage(index)} disabled={creatingAnn}><Icon name="close" size="small" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className={styles.createButtons}>
                <button type="submit" className={styles.createButton} disabled={creatingAnn || (!newAnnouncement.trim() && selectedAnnImages.length === 0)}>
                  {creatingAnn ? 'Создание...' : 'Создать объявление'}
                </button>
                <button type="button" className={styles.telegramButton} onClick={() => setShowTelegramModal(true)}>
                  <Icon name="telegram" size="small" /> Объявление в ТГ
                </button>
              </div>
            </form>
          </div>

          {/* Список объявлений */}
          <div className={styles.section}>
            <h2>Все объявления</h2>
            {loadingAnn ? <p className={styles.loading}>Загрузка...</p>
            : announcements.length === 0 ? <p className={styles.empty}>Объявлений пока нет</p>
            : (
              <div className={styles.adList}>
                {announcements.map((announcement) => (
                  <div key={announcement.id} className={styles.adCard}>
                    <div className={styles.adHeader}>
                      <div className={styles.sentMeta}>
                        <span className={styles.adDate}>{formatDate(announcement.createdAt)}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{announcement.creatorName || 'Администратор'}</span>
                      </div>
                      {deleteConfirm === announcement.id ? (
                        <div className={styles.sentActions}>
                          <button onClick={() => handleDeleteAnnouncement(announcement.id)} className={styles.repeatButton} style={{ background: 'var(--color-error, #ef4444)' }}>Удалить</button>
                          <button onClick={() => setDeleteConfirm(null)} className={styles.repeatButton} style={{ background: 'var(--bg-tertiary)' }}>Отмена</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(announcement.id)} className={styles.deleteButton} title="Удалить"><Icon name="delete" size="small" /></button>
                      )}
                    </div>
                    <p className={styles.adContent}>{announcement.content}</p>
                    {announcement.imageUrls && announcement.imageUrls.length > 0 && (
                      <div className={styles.adImages}>
                        {announcement.imageUrls.map((url, i) => <img key={i} src={url.startsWith('http') ? url : `${import.meta.env.VITE_API_URL || ''}${url}`} alt="" />)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== История (общая, фильтруется по activeTab) ===== */}
      <div className={styles.section}>
        <h2>История отправленных {activeTab === 'advertising' ? 'рекламных постов' : 'объявлений'}</h2>
        {loadingHistory ? <p className={styles.loading}>Загрузка...</p>
        : sentPosts.length === 0 ? <p className={styles.empty}>Пока ничего не отправлено</p>
        : (
          <div className={styles.sentList}>
            {sentPosts.map((post) => (
              <div key={post.id} className={styles.sentCard}>
                <div className={styles.sentHeader}>
                  <div className={styles.sentMeta}>
                    <span className={styles.sentChannel}>
                      {post.channel === 'telegram' ? <><Icon name="telegram" size="small" /> Telegram</> : <><Icon name="feed" size="small" /> Сайт</>}
                    </span>
                    <span className={styles.sentDate}>{formatDate(post.createdAt)}</span>
                    {post.sentTo > 0 && <span className={styles.sentCount}>→ {post.sentTo} получателей</span>}
                  </div>
                  <div className={styles.sentActions}>
                    <button onClick={() => handleRepeatPost(post)} className={styles.repeatButton} title="Повторить"><Icon name="refresh" size="small" /> Повторить</button>
                    <button onClick={() => handleDeleteSentPost(post.id)} className={styles.deleteButton} title="Удалить из истории"><Icon name="delete" size="small" /></button>
                  </div>
                </div>
                <p className={styles.sentContent}>{post.content}</p>
                {post.imageUrl && (
                  <div className={styles.sentImage}>
                    <img src={post.imageUrl.startsWith('http') ? post.imageUrl : `${import.meta.env.VITE_API_URL || ''}${post.imageUrl}`} alt="" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== Модальное окно Telegram ===== */}
      {showTelegramModal && (
        <div className={styles.telegramModal}>
          <div className={styles.telegramModalContent}>
            <h3><Icon name="telegram" size="medium" /> {tgTitle}</h3>
            <p className={styles.telegramModalDescription}>{tgDescription}</p>

            <div className={styles.formattingToolbar}>
              <button type="button" onClick={handleBold} className={styles.formatButton} title="Жирный" disabled={sendingTelegram || sendingToSelf}><strong>B</strong></button>
              <button type="button" onClick={handleItalic} className={styles.formatButton} title="Курсив" disabled={sendingTelegram || sendingToSelf}><em>I</em></button>
              <button type="button" onClick={handleUnderline} className={styles.formatButton} title="Подчёркнутый" disabled={sendingTelegram || sendingToSelf}><u>U</u></button>
              <button type="button" onClick={handleStrikethrough} className={styles.formatButton} title="Зачёркнутый" disabled={sendingTelegram || sendingToSelf}><s>S</s></button>
              <button type="button" onClick={handleCode} className={styles.formatButton} title="Код" disabled={sendingTelegram || sendingToSelf}><code>{'<>'}</code></button>
              <button type="button" onClick={handleMonospace} className={styles.formatButton} title="Блок кода" disabled={sendingTelegram || sendingToSelf}><code>{'{ }'}</code></button>
              <button type="button" onClick={handleQuote} className={styles.formatButton} title="Цитата" disabled={sendingTelegram || sendingToSelf}><span>"</span></button>
              <button type="button" onClick={handleLink} className={styles.formatButton} title="Ссылка" disabled={sendingTelegram || sendingToSelf}><span>🔗</span></button>
              <button type="button" onClick={handleBulletList} className={styles.formatButton} title="Маркированный список" disabled={sendingTelegram || sendingToSelf}><span>•</span></button>
              <button type="button" onClick={handleNumberedList} className={styles.formatButton} title="Нумерованный список" disabled={sendingTelegram || sendingToSelf}><span>1.</span></button>
            </div>

            <textarea value={telegramText} onChange={(e) => setTelegramText(e.target.value)} placeholder={`Введите текст для Telegram...`} className={`${styles.textarea} ${styles.telegramTextarea}`} rows={6} disabled={sendingTelegram || sendingToSelf} />

            <div className={styles.telegramImageSection}>
              <label className={styles.telegramImageLabel}><Icon name="image" size="small" /> Изображение (необязательно)</label>
              <input type="file" accept="image/*" onChange={handleTelegramImageSelect} className={styles.hiddenFileInput} id="tgImageInput" disabled={sendingTelegram || sendingToSelf} />
              {telegramImagePreview ? (
                <div className={styles.telegramImagePreview}>
                  <img src={telegramImagePreview} alt="Превью" />
                  <button type="button" className={styles.removeImageButton} onClick={() => { setTelegramImage(null); setTelegramImagePreview(null); }} disabled={sendingTelegram || sendingToSelf}><Icon name="close" size="small" /></button>
                </div>
              ) : (
                <label htmlFor="tgImageInput" className={styles.telegramImageDropzone}>
                  <Icon name="image" size="medium" /><span>Нажмите или перетащите изображение</span>
                </label>
              )}
            </div>

            <div className={styles.previewSection}>
              <h4>Превью:</h4>
              <div className={styles.telegramPreview}>{renderTelegramPreview(telegramText)}</div>
            </div>

            {telegramProgress && (
              <div className={styles.progressInfo}>
                <p>Отправлено: {telegramProgress.current} из {telegramProgress.total}</p>
                {telegramProgress.failed > 0 && <p className={styles.progressError}>Не удалось: {telegramProgress.failed}</p>}
              </div>
            )}

            <div className={styles.telegramModalButtons}>
              <button className={styles.telegramSendToSelfButton} onClick={handleSendToSelf} disabled={sendingTelegram || sendingToSelf || !telegramText.trim()}>
                {sendingToSelf ? 'Отправка...' : 'Отправить себе'}
              </button>
              <button className={styles.telegramSendButton} onClick={handleSendTelegram} disabled={sendingTelegram || sendingToSelf || !telegramText.trim()}>
                {sendingTelegram ? 'Отправка...' : 'Отправить'}
              </button>
              <button className={styles.telegramCancelButton} onClick={() => { setShowTelegramModal(false); setTelegramText(''); setTelegramProgress(null); setTelegramImage(null); setTelegramImagePreview(null); }} disabled={sendingTelegram || sendingToSelf}>
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
