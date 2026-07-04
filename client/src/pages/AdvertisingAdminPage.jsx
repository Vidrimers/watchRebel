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
  const [activeTab, setActiveTab] = useState('advertising');
  const [activeSubTab, setActiveSubTab] = useState('site'); // 'site' | 'telegram'

  // === Контакты ===
  const [contactText, setContactText] = useState('');
  const [contactEmail, setContactEmail] = useState('admin@watchrebel.com');
  const [contactTelegram, setContactTelegram] = useState('@watchrebel_admin');
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsSaving, setContactsSaving] = useState(false);
  const [isEditingContacts, setIsEditingContacts] = useState(false);

  const [error, setError] = useState(null);

  // === Рекламные посты (сайт) ===
  const [adPosts, setAdPosts] = useState([]);
  const [loadingAd, setLoadingAd] = useState(true);
  const [newAdContent, setNewAdContent] = useState('');
  const [newAdLinkUrl, setNewAdLinkUrl] = useState('https://');
  const [newAdLinkLabel, setNewAdLinkLabel] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [creatingAd, setCreatingAd] = useState(false);
  const [adPinDuration, setAdPinDuration] = useState(0);
  const [adRepeatCount, setAdRepeatCount] = useState(0);
  const [adRepeatInterval, setAdRepeatInterval] = useState(0);

  // === Объявления (сайт) ===
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnn, setLoadingAnn] = useState(true);
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [selectedAnnImages, setSelectedAnnImages] = useState([]);
  const [annImagePreviews, setAnnImagePreviews] = useState([]);
  const [creatingAnn, setCreatingAnn] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [annPinDuration, setAnnPinDuration] = useState(0);
  const [annRepeatCount, setAnnRepeatCount] = useState(0);
  const [annRepeatInterval, setAnnRepeatInterval] = useState(0);
  const [annRepeatChannel, setAnnRepeatChannel] = useState('site');

  // === Telegram (общий) ===
  const [tgText, setTgText] = useState('');
  const [tgRepeatCount, setTgRepeatCount] = useState(0);
  const [tgRepeatInterval, setTgRepeatInterval] = useState(0);

  // === Настройки цен ===
  const [adSettings, setAdSettings] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [tgImage, setTgImage] = useState(null);
  const [tgImagePreview, setTgImagePreview] = useState(null);
  const [sendingTg, setSendingTg] = useState(false);
  const [sendingSelf, setSendingSelf] = useState(false);
  const [tgProgress, setTgProgress] = useState(null);

  // === История ===
  const [sentPosts, setSentPosts] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [cleanupStats, setCleanupStats] = useState(null);

  // === Модалка деталей поста ===
  const [selectedPostForDetails, setSelectedPostForDetails] = useState(null);
  const [cleanupResult, setCleanupResult] = useState(null);

  useEffect(() => {
    if (!user?.isAdmin) { navigate('/'); return; }
    loadContacts(); loadAdPosts(); loadAnnouncements(); loadSentPosts(); loadAdSettings();
  }, [user, navigate]);

  useEffect(() => { loadSentPosts(); }, [activeTab]);

  // ===================== КОНТАКТЫ =====================
  const loadContacts = async () => {
    try {
      setContactsLoading(true);
      const r = await api.get('/settings/advertising_contacts');
      const v = r.data.value || '';
      const lines = v.split('\n');
      let email = 'admin@watchrebel.com', telegram = '@watchrebel_admin', text = '';
      lines.forEach(l => {
        const em = l.match(/Email:\s*(.+)/i), tm = l.match(/Telegram:\s*(.+)/i);
        if (em) email = em[1].trim();
        else if (tm) telegram = tm[1].trim();
        else if (l.trim() && !l.includes('Email:') && !l.includes('Telegram:')) text += (text ? '\n' : '') + l;
      });
      setContactEmail(email); setContactTelegram(telegram); setContactText(text);
    } catch (err) { console.error('Ошибка загрузки контактов:', err); }
    finally { setContactsLoading(false); }
  };

  const handleSaveContacts = async () => {
    try {
      setContactsSaving(true);
      await api.put('/settings/advertising_contacts', { value: `${contactText}\n\nEmail: ${contactEmail}\nTelegram: ${contactTelegram}` });
      setIsEditingContacts(false);
    } catch (err) { setError('Не удалось сохранить контакты'); }
    finally { setContactsSaving(false); }
  };

  // ===================== НАСТРОЙКИ ЦЕН =====================
  const loadAdSettings = async () => {
    try {
      const r = await api.get('/admin/ad-settings');
      setAdSettings(r.data);
    } catch (err) { console.error(err); }
  };

  const handleSaveAdSetting = async (key, value) => {
    try {
      setSettingsSaving(true);
      await api.put('/admin/ad-settings', { key, value });
      setAdSettings(prev => ({ ...prev, [key]: value }));
    } catch (err) { setError('Не удалось сохранить настройку'); }
    finally { setSettingsSaving(false); }
  };

  // ===================== РЕКЛАМА (САЙТ) =====================
  const loadAdPosts = async () => {
    try { setLoadingAd(true); const r = await api.get('/admin/advertising'); setAdPosts(r.data); }
    catch (err) { console.error(err); } finally { setLoadingAd(false); }
  };

  const handleCreateAd = async (e) => {
    e.preventDefault();
    if (!newAdContent.trim() && selectedImages.length === 0) { setError('Добавьте текст или изображения'); return; }
    try {
      setCreatingAd(true);
      const urls = [];
      for (const img of selectedImages) {
        const fd = new FormData(); fd.append('image', img);
        const r = await api.post('/admin/advertising/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        if (r.data?.url) urls.push(r.data.url);
      }
      await api.post('/admin/advertising', {
        content: newAdContent.trim(),
        linkUrl: newAdLinkUrl.trim() !== 'https://' ? (newAdLinkUrl.startsWith('http') ? newAdLinkUrl : `https://${newAdLinkUrl}`) : null,
        linkLabel: newAdLinkLabel.trim() || null, imageUrls: urls,
        pinDuration: adPinDuration, repeatCount: adRepeatCount, repeatIntervalHours: adRepeatInterval
      });
      setNewAdContent(''); setNewAdLinkUrl('https://'); setNewAdLinkLabel('');
      setSelectedImages([]); setImagePreviews([]); setError(null);
      setAdPinDuration(0); setAdRepeatCount(0); setAdRepeatInterval(0);
      await loadAdPosts();
    } catch (err) { setError('Не удалось создать рекламный пост'); }
    finally { setCreatingAd(false); }
  };

  const handleDeleteAd = async (id) => {
    try { await api.delete(`/admin/advertising/${id}`); await loadAdPosts(); }
    catch (err) { setError('Не удалось удалить'); }
  };

  // ===================== ОБЪЯВЛЕНИЯ (САЙТ) =====================
  const loadAnnouncements = async () => {
    try { setLoadingAnn(true); const r = await api.get('/admin/announcements'); setAnnouncements(r.data); }
    catch (err) { console.error(err); } finally { setLoadingAnn(false); }
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!newAnnouncement.trim() && selectedAnnImages.length === 0) { setError('Добавьте текст или изображения'); return; }
    try {
      setCreatingAnn(true);
      const fd = new FormData(); fd.append('content', newAnnouncement.trim() || ' ');
      fd.append('pinDuration', annPinDuration);
      fd.append('repeatCount', annRepeatCount);
      fd.append('repeatIntervalHours', annRepeatInterval);
      fd.append('repeatChannel', annRepeatChannel);
      selectedAnnImages.forEach(img => fd.append('images', img));
      await api.post('/admin/announcements', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setNewAnnouncement(''); setSelectedAnnImages([]); setAnnImagePreviews([]); setError(null);
      setAnnPinDuration(0); setAnnRepeatCount(0); setAnnRepeatInterval(0); setAnnRepeatChannel('site');
      await loadAnnouncements();
    } catch (err) { setError('Не удалось создать объявление'); }
    finally { setCreatingAnn(false); }
  };

  const handleDeleteAnnouncement = async (id) => {
    try { await api.delete(`/admin/announcements/${id}`); await loadAnnouncements(); setDeleteConfirm(null); }
    catch (err) { setError('Не удалось удалить'); }
  };

  // ===================== ИЗОБРАЖЕНИЯ =====================
  const addImages = (files, setSel, setPrev, setErr) => {
    if (files.length > 5) { setErr('Максимум 5'); return; }
    const valid = [], previews = [];
    files.forEach(f => {
      if (!f.type.startsWith('image/') || f.size > 5*1024*1024) return;
      valid.push(f);
      const r = new FileReader();
      r.onloadend = () => { previews.push(r.result); if (previews.length === valid.length) setPrev(p => [...p, ...previews]); };
      r.readAsDataURL(f);
    });
    setSel(p => [...p, ...valid]);
  };

  const handleImageSelect = (e) => addImages(Array.from(e.target.files), setSelectedImages, setImagePreviews, setError);
  const handleRemoveImage = (i) => { setSelectedImages(p => p.filter((_,j) => j!==i)); setImagePreviews(p => p.filter((_,j) => j!==i)); };
  const handleAnnImageSelect = (e) => addImages(Array.from(e.target.files), setSelectedAnnImages, setAnnImagePreviews, setError);
  const handleRemoveAnnImage = (i) => { setSelectedAnnImages(p => p.filter((_,j) => j!==i)); setAnnImagePreviews(p => p.filter((_,j) => j!==i)); };

  // ===================== TELEGRAM =====================
  const tgType = activeTab === 'advertising' ? 'advertising' : 'announcement';

  const uploadTgImage = async () => {
    if (!tgImage) return null;
    const fd = new FormData(); fd.append('image', tgImage);
    const r = await api.post('/admin/advertising/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return r.data?.url || null;
  };

  const handleSendTg = async () => {
    if (!tgText.trim()) return;
    try {
      setSendingTg(true); setTgProgress({ current: 0, total: 0 });
      const imageUrl = await uploadTgImage();
      const r = await api.post('/admin/telegram-announcement', {
        content: tgText.trim(), imageUrl, type: tgType,
        repeatCount: tgRepeatCount, repeatIntervalHours: tgRepeatInterval
      });
      setTgProgress({ current: r.data.success, total: r.data.total, failed: r.data.failed });
      setTimeout(() => { setTgText(''); setTgProgress(null); setTgImage(null); setTgImagePreview(null); setTgRepeatCount(0); setTgRepeatInterval(0); }, 3000);
    } catch (err) { setError('Не удалось отправить в Telegram'); setTgProgress(null); }
    finally { setSendingTg(false); }
  };

  const handleSendSelf = async () => {
    if (!tgText.trim()) return;
    try {
      setSendingSelf(true);
      const imageUrl = await uploadTgImage();
      await api.post('/admin/telegram-announcement-self', { content: tgText.trim(), imageUrl, type: tgType });
      alert(`${tgType === 'advertising' ? 'Реклама' : 'Объявление'} отправлено вам в Telegram!`);
    } catch (err) { setError('Не удалось отправить'); }
    finally { setSendingSelf(false); }
  };

  const handleTgImageSelect = (e) => {
    const f = e.target.files[0]; if (!f || !f.type.startsWith('image/') || f.size > 5*1024*1024) return;
    setTgImage(f);
    const r = new FileReader(); r.onloadend = () => setTgImagePreview(r.result); r.readAsDataURL(f);
  };

  // ===================== ФОРМАТИРОВАНИЕ ТГ =====================
  const insertFormatting = (before, after = '', placeholder = '') => {
    const ta = document.querySelector(`.${styles.tgTextarea}`); if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = tgText.substring(s, e), ins = sel || placeholder;
    setTgText(tgText.substring(0, s) + before + ins + after + tgText.substring(e));
    setTimeout(() => { ta.focus(); if (sel) { const p = s + before.length + sel.length; ta.setSelectionRange(p, p); } else { ta.setSelectionRange(s + before.length, s + before.length + placeholder.length); } }, 0);
  };

  const insertAtCursor = (text) => {
    const ta = document.querySelector(`.${styles.tgTextarea}`); if (!ta) return;
    const s = ta.selectionStart;
    setTgText(tgText.substring(0, s) + text + tgText.substring(s));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + text.length, s + text.length); }, 0);
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
    const ta = document.querySelector(`.${styles.tgTextarea}`); if (!ta) return;
    const s = ta.selectionStart;
    const lines = tgText.substring(0, s).split('\n');
    const m = lines[lines.length - 1].match(/^(\d+)\.\s/);
    insertAtCursor(`${m ? parseInt(m[1]) + 1 : 1}. `);
  };

  const renderTgPreview = (text) => {
    if (!text) return 'Превью появится здесь...';
    let h = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    h = h.replace(/```\n?([\s\S]+?)\n?```/g, '<pre>$1</pre>');
    h = h.replace(/`([^`]+?)`/g, '<code>$1</code>');
    h = h.replace(/\*([^*]+?)\*/g, '<strong>$1</strong>');
    h = h.replace(/__([^_]+?)__/g, '<u>$1</u>');
    h = h.replace(/(?<!_)_([^_]+?)_(?!_)/g, '<em>$1</em>');
    h = h.replace(/~([^~]+?)~/g, '<s>$1</s>');
    h = h.replace(/^&gt;\s(.+)$/gm, '<blockquote>$1</blockquote>');
    h = h.replace(/\n/g, '<br/>');
    return <div dangerouslySetInnerHTML={{ __html: h }} />;
  };

  // ===================== ИСТОРИЯ =====================
  const loadSentPosts = async () => {
    try {
      setLoadingHistory(true);
      const type = activeTab === 'advertising' ? 'advertising' : 'announcement';
      const r = await api.get('/admin/sent-posts', { params: { type } });
      setSentPosts(r.data);
    } catch (err) { console.error(err); }
    finally { setLoadingHistory(false); }
  };

  const handleRepeatPost = (post) => {
    const isTg = post.channel === 'telegram';
    if (activeTab === 'advertising') {
      if (isTg) {
        setTgText(post.content);
        if (post.imageUrl) {
          const fullUrl = post.imageUrl.startsWith('http') ? post.imageUrl : `${import.meta.env.VITE_API_URL || ''}${post.imageUrl}`;
          setTgImagePreview(fullUrl);
        }
      } else {
        setNewAdContent(post.content);
        setNewAdLinkUrl('https://');
        setNewAdLinkLabel('');
        setSelectedImages([]); setImagePreviews([]);
      }
    } else {
      if (isTg) {
        setTgText(post.content);
        if (post.imageUrl) {
          const fullUrl = post.imageUrl.startsWith('http') ? post.imageUrl : `${import.meta.env.VITE_API_URL || ''}${post.imageUrl}`;
          setTgImagePreview(fullUrl);
        }
      } else {
        setNewAnnouncement(post.content);
        setSelectedAnnImages([]); setAnnImagePreviews([]);
      }
    }
    setActiveSubTab(isTg ? 'telegram' : 'site');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteSentPost = async (id) => {
    try { await api.delete(`/admin/sent-posts/${id}`); await loadSentPosts(); }
    catch (err) { console.error(err); }
  };

  const handleCleanupImages = async () => {
    try {
      const r = await api.get('/admin/advertising/image-stats');
      setCleanupStats(r.data);
      setShowCleanupConfirm(true);
    } catch (err) { console.error(err); setError('Не удалось проверить изображения'); }
  };

  const handleConfirmCleanup = async () => {
    try {
      const r = await api.post('/admin/advertising/cleanup-images');
      setShowCleanupConfirm(false);
      setCleanupResult(r.data);
    } catch (err) { console.error(err); setError('Не удалось очистить'); }
  };

  const formatDate = (d) => new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // ===================== RENDER =====================
  const isAd = activeTab === 'advertising';
  const tgTitle = isAd ? 'Отправить рекламу в Telegram' : 'Отправить объявление в Telegram';
  const tgDesc = isAd ? 'Реклама будет отправлена всем пользователям' : 'Объявление будет отправлено всем пользователям';

  return (
    <div className={styles.page}>
      <button className={styles.backButton} onClick={() => navigate('/settings')}>
        <Icon name="arrow-left" size="medium" /><span>Назад</span>
      </button>

      <h1 className={styles.title}>
        <Icon name="advertising" size="medium" /> Объявления и реклама
      </h1>

      {/* ===== Основные вкладки ===== */}
      <div className={styles.tabs}>
        <button className={`${styles.tabButton} ${activeTab === 'advertising' ? styles.tabButtonActive : ''}`} onClick={() => { setActiveTab('advertising'); setActiveSubTab('site'); }}>
          <Icon name="advertising" size="small" /> Реклама
        </button>
        <button className={`${styles.tabButton} ${activeTab === 'announcements' ? styles.tabButtonActive : ''}`} onClick={() => { setActiveTab('announcements'); setActiveSubTab('site'); }}>
          <Icon name="announcement" size="small" /> Объявления
        </button>
      </div>

      {/* ===== Подвкладки ===== */}
      <div className={styles.subTabs}>
        <button className={`${styles.subTabButton} ${activeSubTab === 'site' ? styles.subTabButtonActive : ''}`} onClick={() => setActiveSubTab('site')}>
          <Icon name="feed" size="small" /> {isAd ? 'Реклама на сайте' : 'Объявления на сайте'}
        </button>
        <button className={`${styles.subTabButton} ${activeSubTab === 'telegram' ? styles.subTabButtonActive : ''}`} onClick={() => setActiveSubTab('telegram')}>
          <Icon name="telegram" size="small" /> {isAd ? 'Реклама в ТГ' : 'Объявления в ТГ'}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* ===== Настройки цен ===== */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Настройки рекламы и прайс</h2>
          <button onClick={() => setShowSettings(!showSettings)} className={styles.btnEdit}>
            {showSettings ? 'Скрыть' : 'Настроить'}
          </button>
        </div>
        {showSettings && (
          <div className={styles.editForm}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Цена показа на сайте:</label>
                <input type="number" min="0" value={adSettings.ad_price_site || ''} onChange={e => handleSaveAdSetting('ad_price_site', e.target.value)} className={styles.input} placeholder="₽" />
              </div>
              <div className={styles.formGroup}>
                <label>Цена за повторения:</label>
                <input type="number" min="0" value={adSettings.ad_price_repeat || ''} onChange={e => handleSaveAdSetting('ad_price_repeat', e.target.value)} className={styles.input} placeholder="₽" />
              </div>
              <div className={styles.formGroup}>
                <label>Цена за интервал:</label>
                <input type="number" min="0" value={adSettings.ad_price_interval || ''} onChange={e => handleSaveAdSetting('ad_price_interval', e.target.value)} className={styles.input} placeholder="₽" />
              </div>
              <div className={styles.formGroup}>
                <label>Цена за ТГ-рассылку:</label>
                <input type="number" min="0" value={adSettings.ad_price_telegram || ''} onChange={e => handleSaveAdSetting('ad_price_telegram', e.target.value)} className={styles.input} placeholder="₽" />
              </div>
            </div>
            <p className={styles.tgDesc}>Максимальные значения: показов в закреплённых — 50, повторений — 50, интервал — 50 часов.</p>
            <div className={styles.toggleRow}>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  className={styles.toggleInput}
                  checked={adSettings.ad_auto_delete === '1'}
                  onChange={e => handleSaveAdSetting('ad_auto_delete', e.target.checked ? '1' : '0')}
                  disabled={settingsSaving}
                />
                <span className={styles.toggleSlider}></span>
              </label>
              <div>
                <div className={styles.toggleLabel}>Автоудаление рекламных постов</div>
                <div className={styles.toggleDesc}>Посты удаляются после исчерпания повторов и/или истечения закрепления</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== ПОДВКЛАДКА: НА САЙТЕ ===== */}
      {activeSubTab === 'site' && isAd && (
        <>
          <div className={styles.section}>
            <h2>Создать рекламный пост</h2>
            <form onSubmit={handleCreateAd} className={styles.createForm}>
              <div className={styles.textareaWrapper}>
                <textarea value={newAdContent} onChange={e => setNewAdContent(e.target.value)} placeholder="Текст рекламного поста..." className={styles.textarea} rows={4} disabled={creatingAd} />
                <label htmlFor="adImageInput" className={styles.attachButton} title="Прикрепить изображения"><Icon name="paperclip" size="medium" /></label>
                <input id="adImageInput" type="file" accept="image/*" multiple onChange={handleImageSelect} className={styles.hiddenFileInput} disabled={creatingAd || selectedImages.length >= 5} />
              </div>
              {imagePreviews.length > 0 && (
                <div className={styles.imagePreviews}>
                  {imagePreviews.map((p, i) => (
                    <div key={i} className={styles.imagePreview}>
                      <img src={p} alt="" />
                      <button type="button" className={styles.removeImageButton} onClick={() => handleRemoveImage(i)} disabled={creatingAd}><Icon name="close" size="small" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className={styles.formRow}>
                <div className={styles.formGroup}><label>Ссылка (URL):</label><input type="url" value={newAdLinkUrl} onChange={e => setNewAdLinkUrl(e.target.value)} className={styles.input} placeholder="google.com" /></div>
                <div className={styles.formGroup}><label>Текст ссылки:</label><input type="text" value={newAdLinkLabel} onChange={e => setNewAdLinkLabel(e.target.value)} className={styles.input} placeholder="Перейти" /></div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Показов в закреплённых:</label>
                  <input type="number" min="0" max="50" value={adPinDuration} onChange={e => setAdPinDuration(Math.min(50, Math.max(0, parseInt(e.target.value) || 0)))} className={styles.input} placeholder="0 = всегда в топе" />
                </div>
                <div className={styles.formGroup}>
                  <label>Повторений:</label>
                  <input type="number" min="0" max="50" value={adRepeatCount} onChange={e => setAdRepeatCount(Math.min(50, Math.max(0, parseInt(e.target.value) || 0)))} className={styles.input} placeholder="0 = без повторов" />
                </div>
                <div className={styles.formGroup}>
                  <label>Интервал (часы):</label>
                  <input type="number" min="0" max="50" value={adRepeatInterval} onChange={e => setAdRepeatInterval(Math.min(50, Math.max(0, parseInt(e.target.value) || 0)))} className={styles.input} placeholder="обязательно при повторах" />
                </div>
              </div>
              <button type="submit" className={styles.createButton} disabled={creatingAd || (!newAdContent.trim() && selectedImages.length === 0)}>
                {creatingAd ? 'Публикация...' : 'Опубликовать рекламу'}
              </button>
            </form>
          </div>
          {adPosts.length > 0 && (
          <div className={styles.section}>
            <h2>Опубликованные рекламные посты</h2>
            {loadingAd ? <p className={styles.loading}>Загрузка...</p> : (
              <div className={styles.adList}>
                {adPosts.map(p => (
                  <div key={p.id} className={styles.adCard}>
                    <div className={styles.adHeader}>
                      <span className={styles.adDate}>{formatDate(p.createdAt)}</span>
                      {deleteConfirm === p.id ? (
                        <div className={styles.sentActions}>
                          <button onClick={() => handleDeleteAd(p.id)} className={styles.repeatButton} style={{ background: 'var(--color-error, #ef4444)' }}>Удалить</button>
                          <button onClick={() => setDeleteConfirm(null)} className={styles.repeatButton} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>Отмена</button>
                        </div>
                      ) : <button onClick={() => setDeleteConfirm(p.id)} className={styles.deleteButton}><Icon name="delete" size="small" /></button>}
                    </div>
                    <p className={styles.adContent}>{p.content}</p>
                    {p.linkUrl && <a href={p.linkUrl} target="_blank" rel="noopener noreferrer" className={styles.adLink}>{p.linkLabel || p.linkUrl}</a>}
                    {p.imageUrls?.length > 0 && <div className={styles.adImages}>{p.imageUrls.map((u, i) => <img key={i} src={u.startsWith('http') ? u : `${import.meta.env.VITE_API_URL || ''}${u}`} alt="" />)}</div>}
                    <div className={styles.postOptions} onClick={() => setSelectedPostForDetails(p)}>
                      {p.pinDuration > 0 && <span className={styles.postOptionIcon} title={`Закрепление: ${p.pinDuration} показов`}><Icon name="pin" size="small" /></span>}
                      {p.repeatCount > 0 && <span className={styles.postOptionIcon} title={`Повторы: ${p.repeatCount} осталось`}><Icon name="repeat" size="small" /></span>}
                      {p.repeatIntervalHours > 0 && <span className={styles.postOptionIcon} title={`Интервал: ${p.repeatIntervalHours}ч`}><Icon name="clock" size="small" /></span>}
                      {p.repeatChannel && <span className={styles.postOptionIcon} title={`Канал: ${p.repeatChannel === 'telegram' ? 'Телеграм' : 'Сайт'}`}>
                        <Icon name={p.repeatChannel === 'telegram' ? 'telegram' : 'feed'} size="small" />
                      </span>}
                      {adSettings.ad_auto_delete === '1' && <span className={`${styles.postOptionIcon} ${styles.autoDeleteOn}`} title="Автоудаление включено"><Icon name="delete" size="small" /></span>}
                      {adSettings.ad_auto_delete !== '1' && (p.pinDuration > 0 || p.repeatCount > 0) && <span className={`${styles.postOptionIcon} ${styles.autoDeleteOff}`} title="Автоудаление выключено"><Icon name="delete" size="small" /></span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </>
      )}

      {activeSubTab === 'site' && !isAd && (
        <>
          <div className={styles.section}>
            <h2>Создать новое объявление</h2>
            <form onSubmit={handleCreateAnnouncement} className={styles.createForm}>
              <div className={styles.textareaWrapper}>
                <textarea value={newAnnouncement} onChange={e => setNewAnnouncement(e.target.value)} placeholder="Введите текст объявления..." className={styles.textarea} rows={4} disabled={creatingAnn} />
                <label htmlFor="annImageInput" className={styles.attachButton} title="Прикрепить изображения"><Icon name="paperclip" size="medium" /></label>
                <input id="annImageInput" type="file" accept="image/*" multiple onChange={handleAnnImageSelect} className={styles.hiddenFileInput} disabled={creatingAnn || selectedAnnImages.length >= 5} />
              </div>
              {annImagePreviews.length > 0 && (
                <div className={styles.imagePreviews}>
                  {annImagePreviews.map((p, i) => (
                    <div key={i} className={styles.imagePreview}>
                      <img src={p} alt="" />
                      <button type="button" className={styles.removeImageButton} onClick={() => handleRemoveAnnImage(i)} disabled={creatingAnn}><Icon name="close" size="small" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Показов в закреплённых:</label>
                  <input type="number" min="0" max="50" value={annPinDuration} onChange={e => setAnnPinDuration(Math.min(50, Math.max(0, parseInt(e.target.value) || 0)))} className={styles.input} placeholder="0 = всегда в топе" />
                </div>
                <div className={styles.formGroup}>
                  <label>Повторений:</label>
                  <input type="number" min="0" max="50" value={annRepeatCount} onChange={e => setAnnRepeatCount(Math.min(50, Math.max(0, parseInt(e.target.value) || 0)))} className={styles.input} placeholder="0 = без повторов" />
                </div>
                <div className={styles.formGroup}>
                  <label>Интервал (часы):</label>
                  <input type="number" min="0" max="50" value={annRepeatInterval} onChange={e => setAnnRepeatInterval(Math.min(50, Math.max(0, parseInt(e.target.value) || 0)))} className={styles.input} placeholder="обязательно при повторах" />
                </div>
                <div className={styles.formGroup}>
                  <label>Канал повтора:</label>
                  <select value={annRepeatChannel} onChange={e => setAnnRepeatChannel(e.target.value)} className={styles.input}>
                    <option value="site">Сайт</option>
                    <option value="telegram">Телеграм</option>
                    <option value="telegram">Телеграм</option>
                  </select>
                </div>
              </div>
              <button type="submit" className={styles.createButton} disabled={creatingAnn || (!newAnnouncement.trim() && selectedAnnImages.length === 0)}>
                {creatingAnn ? 'Создание...' : 'Создать объявление'}
              </button>
            </form>
          </div>
          {announcements.length > 0 && (
          <div className={styles.section}>
            <h2>Все объявления</h2>
            {loadingAnn ? <p className={styles.loading}>Загрузка...</p> : (
              <div className={styles.adList}>
                {announcements.map(a => (
                  <div key={a.id} className={styles.adCard}>
                    <div className={styles.adHeader}>
                      <div className={styles.sentMeta}>
                        <span className={styles.adDate}>{formatDate(a.createdAt)}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{a.creatorName || 'Администратор'}</span>
                      </div>
                      {deleteConfirm === a.id ? (
                        <div className={styles.sentActions}>
                          <button onClick={() => handleDeleteAnnouncement(a.id)} className={styles.repeatButton} style={{ background: 'var(--color-error, #ef4444)' }}>Удалить</button>
                          <button onClick={() => setDeleteConfirm(null)} className={styles.repeatButton} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>Отмена</button>
                        </div>
                      ) : <button onClick={() => setDeleteConfirm(a.id)} className={styles.deleteButton}><Icon name="delete" size="small" /></button>}
                    </div>
                    <p className={styles.adContent}>{a.content}</p>
                    {a.imageUrls?.length > 0 && <div className={styles.adImages}>{a.imageUrls.map((u, i) => <img key={i} src={u.startsWith('http') ? u : `${import.meta.env.VITE_API_URL || ''}${u}`} alt="" />)}</div>}
                    {(a.pinDuration > 0 || a.repeatCount > 0) && (
                      <div className={styles.postOptions} onClick={() => setSelectedPostForDetails(a)}>
                        {a.pinDuration > 0 && <span className={styles.postOptionIcon} title={`Закрепление: ${a.pinDuration} показов`}><Icon name="pin" size="small" /></span>}
                        {a.repeatCount > 0 && <span className={styles.postOptionIcon} title={`Повторы: ${a.repeatCount} осталось`}><Icon name="repeat" size="small" /></span>}
                        {a.repeatIntervalHours > 0 && <span className={styles.postOptionIcon} title={`Интервал: ${a.repeatIntervalHours}ч`}><Icon name="clock" size="small" /></span>}
                        {a.repeatChannel && <span className={styles.postOptionIcon} title={`Канал: ${a.repeatChannel === 'telegram' ? 'Телеграм' : 'Сайт'}`}>
                          <Icon name={a.repeatChannel === 'telegram' ? 'telegram' : 'feed'} size="small" />
                        </span>}
                        {adSettings.ad_auto_delete === '1' && <span className={`${styles.postOptionIcon} ${styles.autoDeleteOn}`} title="Автоудаление включено"><Icon name="delete" size="small" /></span>}
                        {adSettings.ad_auto_delete !== '1' && <span className={`${styles.postOptionIcon} ${styles.autoDeleteOff}`} title="Автоудаление выключено"><Icon name="delete" size="small" /></span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </>
      )}

      {/* ===== ПОДВКЛАДКА: TELEGRAM ===== */}
      {activeSubTab === 'telegram' && (<>
        <div className={styles.section}>
          <h2>{tgTitle}</h2>
          <p className={styles.tgDesc}>{tgDesc}</p>

          <div className={styles.formattingToolbar}>
            <button type="button" onClick={handleBold} className={styles.formatButton} disabled={sendingTg || sendingSelf}><strong>B</strong></button>
            <button type="button" onClick={handleItalic} className={styles.formatButton} disabled={sendingTg || sendingSelf}><em>I</em></button>
            <button type="button" onClick={handleUnderline} className={styles.formatButton} disabled={sendingTg || sendingSelf}><u>U</u></button>
            <button type="button" onClick={handleStrikethrough} className={styles.formatButton} disabled={sendingTg || sendingSelf}><s>S</s></button>
            <button type="button" onClick={handleCode} className={styles.formatButton} disabled={sendingTg || sendingSelf}><code>{'<>'}</code></button>
            <button type="button" onClick={handleMonospace} className={styles.formatButton} disabled={sendingTg || sendingSelf}><code>{'{ }'}</code></button>
            <button type="button" onClick={handleQuote} className={styles.formatButton} disabled={sendingTg || sendingSelf}><span>"</span></button>
            <button type="button" onClick={handleLink} className={styles.formatButton} disabled={sendingTg || sendingSelf}><span>🔗</span></button>
            <button type="button" onClick={handleBulletList} className={styles.formatButton} disabled={sendingTg || sendingSelf}><span>•</span></button>
            <button type="button" onClick={handleNumberedList} className={styles.formatButton} disabled={sendingTg || sendingSelf}><span>1.</span></button>
          </div>

          <textarea value={tgText} onChange={e => setTgText(e.target.value)} placeholder="Введите текст для Telegram..." className={`${styles.textarea} ${styles.tgTextarea}`} rows={6} disabled={sendingTg || sendingSelf} />

          <div className={styles.tgImageSection}>
            <label className={styles.tgImageLabel}><Icon name="image" size="small" /> Изображение (необязательно)</label>
            <input type="file" accept="image/*" onChange={handleTgImageSelect} className={styles.hiddenFileInput} id="tgImgInput" disabled={sendingTg || sendingSelf} />
            {tgImagePreview ? (
              <div className={styles.tgImagePreview}>
                <img src={tgImagePreview} alt="" />
                <button type="button" className={styles.removeImageButton} onClick={() => { setTgImage(null); setTgImagePreview(null); }} disabled={sendingTg || sendingSelf}><Icon name="close" size="small" /></button>
              </div>
            ) : (
              <label htmlFor="tgImgInput" className={styles.tgImageDropzone}>
                <Icon name="image" size="medium" /><span>Нажмите или перетащите изображение</span>
              </label>
            )}
          </div>

          <div className={styles.previewSection}>
            <h4>Превью:</h4>
            <div className={styles.tgPreview}>{renderTgPreview(tgText)}</div>
          </div>

          {tgProgress && (
            <div className={styles.progressInfo}>
              <p>Отправлено: {tgProgress.current} из {tgProgress.total}</p>
              {tgProgress.failed > 0 && <p className={styles.progressError}>Не удалось: {tgProgress.failed}</p>}
            </div>
          )}

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Повторений:</label>
              <input type="number" min="0" max="50" value={tgRepeatCount} onChange={e => setTgRepeatCount(Math.min(50, Math.max(0, parseInt(e.target.value) || 0)))} className={styles.input} placeholder="0 = без повторов" />
            </div>
            <div className={styles.formGroup}>
              <label>Интервал (часы):</label>
              <input type="number" min="0" max="50" value={tgRepeatInterval} onChange={e => setTgRepeatInterval(Math.min(50, Math.max(0, parseInt(e.target.value) || 0)))} className={styles.input} placeholder="обязательно при повторах" />
            </div>
          </div>

          <div className={styles.tgButtons}>
            <button className={styles.tgSendSelf} onClick={handleSendSelf} disabled={sendingTg || sendingSelf || !tgText.trim()}>
              {sendingSelf ? 'Отправка...' : 'Отправить себе'}
            </button>
            <button className={styles.tgSendAll} onClick={handleSendTg} disabled={sendingTg || sendingSelf || !tgText.trim()}>
              {sendingTg ? 'Отправка...' : 'Отправить'}
            </button>
          </div>
        </div>

        {/* Опубликованные — зависит от вкладки */}
        {isAd && adPosts.length > 0 && (
          <div className={styles.section}>
            <h2>Опубликованные рекламные посты</h2>
            <div className={styles.adList}>
              {adPosts.map(p => (
                <div key={p.id} className={styles.adCard}>
                  <div className={styles.adHeader}>
                    <span className={styles.adDate}>{formatDate(p.createdAt)}</span>
                    {deleteConfirm === p.id ? (
                      <div className={styles.sentActions}>
                        <button onClick={() => handleDeleteAd(p.id)} className={styles.repeatButton} style={{ background: 'var(--color-error, #ef4444)' }}>Удалить</button>
                        <button onClick={() => setDeleteConfirm(null)} className={styles.repeatButton} style={{ background: 'var(--bg-tertiary)' }}>Отмена</button>
                      </div>
                    ) : <button onClick={() => setDeleteConfirm(p.id)} className={styles.deleteButton}><Icon name="delete" size="small" /></button>}
                  </div>
                  <p className={styles.adContent}>{p.content}</p>
                  {p.imageUrls?.length > 0 && <div className={styles.adImages}>{p.imageUrls.map((u, i) => <img key={i} src={u.startsWith('http') ? u : `${import.meta.env.VITE_API_URL || ''}${u}`} alt="" />)}</div>}
                  <div className={styles.postOptions} onClick={() => setSelectedPostForDetails(p)}>
                    {p.pinDuration > 0 && <span className={styles.postOptionIcon} title={`Закрепление: ${p.pinDuration} показов`}><Icon name="pin" size="small" /></span>}
                    {p.repeatCount > 0 && <span className={styles.postOptionIcon} title={`Повторы: ${p.repeatCount} осталось`}><Icon name="repeat" size="small" /></span>}
                    {p.repeatIntervalHours > 0 && <span className={styles.postOptionIcon} title={`Интервал: ${p.repeatIntervalHours}ч`}><Icon name="clock" size="small" /></span>}
                    {p.repeatChannel && <span className={styles.postOptionIcon} title={`Канал: ${p.repeatChannel === 'telegram' ? 'Телеграм' : 'Сайт'}`}>
                      <Icon name={p.repeatChannel === 'telegram' ? 'telegram' : 'feed'} size="small" />
                    </span>}
                    {adSettings.ad_auto_delete === '1' && <span className={`${styles.postOptionIcon} ${styles.autoDeleteOn}`} title="Автоудаление включено"><Icon name="delete" size="small" /></span>}
                    {adSettings.ad_auto_delete !== '1' && (p.pinDuration > 0 || p.repeatCount > 0) && <span className={`${styles.postOptionIcon} ${styles.autoDeleteOff}`} title="Автоудаление выключено"><Icon name="delete" size="small" /></span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isAd && announcements.length > 0 && (
          <div className={styles.section}>
            <h2>Все объявления</h2>
            {loadingAnn ? <p className={styles.loading}>Загрузка...</p> : announcements.length === 0 ? <p className={styles.empty}>Пока нет</p> : (
              <div className={styles.adList}>
                {announcements.map(a => (
                  <div key={a.id} className={styles.adCard}>
                    <div className={styles.adHeader}>
                      <div className={styles.sentMeta}>
                        <span className={styles.adDate}>{formatDate(a.createdAt)}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{a.creatorName || 'Администратор'}</span>
                      </div>
                      {deleteConfirm === a.id ? (
                        <div className={styles.sentActions}>
                          <button onClick={() => handleDeleteAnnouncement(a.id)} className={styles.repeatButton} style={{ background: 'var(--color-error, #ef4444)' }}>Удалить</button>
                          <button onClick={() => setDeleteConfirm(null)} className={styles.repeatButton} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>Отмена</button>
                        </div>
                      ) : <button onClick={() => setDeleteConfirm(a.id)} className={styles.deleteButton}><Icon name="delete" size="small" /></button>}
                    </div>
                    <p className={styles.adContent}>{a.content}</p>
                    {a.imageUrls?.length > 0 && <div className={styles.adImages}>{a.imageUrls.map((u, i) => <img key={i} src={u.startsWith('http') ? u : `${import.meta.env.VITE_API_URL || ''}${u}`} alt="" />)}</div>}
                    <div className={styles.postOptions} onClick={() => setSelectedPostForDetails(a)}>
                      {a.pinDuration > 0 && <span className={styles.postOptionIcon} title={`Закрепление: ${a.pinDuration} показов`}><Icon name="pin" size="small" /></span>}
                      {a.repeatCount > 0 && <span className={styles.postOptionIcon} title={`Повторы: ${a.repeatCount} осталось`}><Icon name="repeat" size="small" /></span>}
                      {a.repeatIntervalHours > 0 && <span className={styles.postOptionIcon} title={`Интервал: ${a.repeatIntervalHours}ч`}><Icon name="clock" size="small" /></span>}
                      {a.repeatChannel && <span className={styles.postOptionIcon} title={`Канал: ${a.repeatChannel === 'telegram' ? 'Телеграм' : 'Сайт'}`}>
                        <Icon name={a.repeatChannel === 'telegram' ? 'telegram' : 'feed'} size="small" />
                      </span>}
                      {adSettings.ad_auto_delete === '1' && <span className={`${styles.postOptionIcon} ${styles.autoDeleteOn}`} title="Автоудаление включено"><Icon name="delete" size="small" /></span>}
                      {adSettings.ad_auto_delete !== '1' && (a.pinDuration > 0 || a.repeatCount > 0) && <span className={`${styles.postOptionIcon} ${styles.autoDeleteOff}`} title="Автоудаление выключено"><Icon name="delete" size="small" /></span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </>)}

      {/* ===== История ===== */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>История отправленных {isAd ? 'рекламных постов' : 'объявлений'}</h2>
          <button onClick={handleCleanupImages} className={styles.btnEdit} title="Удалить неиспользуемые изображения">
            <Icon name="delete" size="small" /> Очистить изображения
          </button>
        </div>
        {loadingHistory ? <p className={styles.loading}>Загрузка...</p> : sentPosts.length === 0 ? <p className={styles.empty}>Пока ничего не отправлено</p> : (
          <div className={styles.sentList}>
            {sentPosts.map(p => (
              <div key={p.id} className={styles.sentCard}>
                <div className={styles.sentHeader}>
                  <div className={styles.sentMeta}>
                    <span className={styles.sentChannel}>
                      {p.channel === 'telegram' ? <><Icon name="telegram" size="small" /> Telegram</> : <><Icon name="feed" size="small" /> Сайт</>}
                    </span>
                    <span className={styles.sentDate}>{formatDate(p.createdAt)}</span>
                    {p.sentTo > 0 && <span className={styles.sentCount}>→ {p.sentTo} получателей</span>}
                  </div>
                  <div className={styles.sentActions}>
                    <button onClick={() => handleRepeatPost(p)} className={styles.repeatButton}><Icon name="repeat" size="small" /> Повторить</button>
                    <button onClick={() => handleDeleteSentPost(p.id)} className={styles.deleteButton}><Icon name="delete" size="small" /></button>
                  </div>
                </div>
                <p className={styles.sentContent}>{p.content}</p>
                {p.imageUrl && <div className={styles.sentImage}><img src={p.imageUrl.startsWith('http') ? p.imageUrl : `${import.meta.env.VITE_API_URL || ''}${p.imageUrl}`} alt="" /></div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Диалог подтверждения очистки */}
      {showCleanupConfirm && cleanupStats && (
        <div className={styles.telegramModal}>
          <div className={styles.telegramModalContent}>
            <h3><Icon name="delete" size="medium" /> Очистка изображений</h3>
            <div className={styles.cleanupStats}>
              <p>Всего изображений на диске: <strong>{cleanupStats.total}</strong></p>
              <p>Привязаны к постам: <strong>{cleanupStats.referenced}</strong></p>
              <p className={cleanupStats.orphaned > 0 ? styles.cleanupOrphaned : ''}>
                Неиспользуемых: <strong>{cleanupStats.orphaned}</strong>
              </p>
            </div>
            {cleanupStats.orphaned > 0 ? (
              <>
                <p className={styles.tgDesc}>
                  Неиспользуемые изображения будут удалены навсегда. Файлы, привязанные к активным постам, не пострадают.
                </p>
                <div className={styles.tgButtons}>
                  <button className={styles.tgSendAll} onClick={handleConfirmCleanup}>
                    Удалить {cleanupStats.orphaned} файл(ов)
                  </button>
                  <button className={styles.tgSendSelf} onClick={() => { setShowCleanupConfirm(false); setCleanupStats(null); }}>
                    Отмена
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.tgButtons}>
                <button className={styles.tgSendSelf} onClick={() => { setShowCleanupConfirm(false); setCleanupStats(null); }}>
                  Закрыть
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Диалог результата очистки */}
      {cleanupResult && (
        <div className={styles.telegramModal}>
          <div className={styles.telegramModalContent}>
            <h3><Icon name="check" size="medium" /> Готово</h3>
            <p className={styles.tgDesc}>{cleanupResult.message}</p>
            <div className={styles.tgButtons}>
              <button className={styles.tgSendSelf} onClick={() => setCleanupResult(null)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка деталей опций поста */}
      {selectedPostForDetails && (
        <div className={styles.telegramModal} onClick={() => setSelectedPostForDetails(null)}>
          <div className={styles.telegramModalContent} onClick={e => e.stopPropagation()}>
            <h3>Опции поста</h3>
            <div className={styles.postDetailsList}>
              <div className={styles.postDetailRow}>
                <Icon name="pin" size="small" />
                <span>Закрепление:</span>
                <strong>{selectedPostForDetails.pinDuration > 0 ? `${selectedPostForDetails.pinDuration} показов` : 'Выключено'}</strong>
              </div>
              <div className={styles.postDetailRow}>
                <Icon name="repeat" size="small" />
                <span>Повторы:</span>
                <strong>{selectedPostForDetails.repeatCount > 0 ? `${selectedPostForDetails.repeatCount} осталось` : 'Выключено'}</strong>
              </div>
              <div className={styles.postDetailRow}>
                <Icon name="clock" size="small" />
                <span>Интервал:</span>
                <strong>{selectedPostForDetails.repeatIntervalHours > 0 ? `${selectedPostForDetails.repeatIntervalHours} часов` : 'Выключено'}</strong>
              </div>
              <div className={styles.postDetailRow}>
                <Icon name={selectedPostForDetails.repeatChannel === 'telegram' ? 'telegram' : 'feed'} size="small" />
                <span>Канал:</span>
                <strong>{selectedPostForDetails.repeatChannel === 'telegram' ? 'Телеграм' : selectedPostForDetails.repeatChannel === 'site' ? 'Сайт' : 'Не задан'}</strong>
              </div>
              <div className={styles.postDetailRow}>
                <Icon name="delete" size="small" />
                <span>Автоудаление:</span>
                <strong className={adSettings.ad_auto_delete === '1' ? styles.statusOn : styles.statusOff}>{adSettings.ad_auto_delete === '1' ? 'Включено' : 'Выключено'}</strong>
              </div>
            </div>
            <div className={styles.tgButtons}>
              <button className={styles.tgSendSelf} onClick={() => setSelectedPostForDetails(null)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Контакты для рекламы ===== */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Контакты для рекламы</h2>
          {!isEditingContacts && <button onClick={() => setIsEditingContacts(true)} className={styles.btnEdit}>Редактировать</button>}
        </div>
        {contactsLoading ? <p className={styles.loading}>Загрузка...</p>
        : isEditingContacts ? (
          <div className={styles.editForm}>
            <div className={styles.formGroup}><label>Текст:</label><textarea value={contactText} onChange={e => setContactText(e.target.value)} className={styles.textarea} rows={3} /></div>
            <div className={styles.formGroup}><label>Email:</label><input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className={styles.input} /></div>
            <div className={styles.formGroup}><label>Telegram:</label><input type="text" value={contactTelegram} onChange={e => setContactTelegram(e.target.value)} className={styles.input} /></div>
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
    </div>
  );
};

export default AdvertisingAdminPage;
