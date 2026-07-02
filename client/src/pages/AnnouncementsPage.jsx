import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import Icon from '../components/Common/Icon';
import api from '../services/api';
import styles from './AnnouncementsPage.module.css';

const AnnouncementsPage = () => {
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Состояние для Telegram объявления
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramAnnouncement, setTelegramAnnouncement] = useState('');
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [telegramProgress, setTelegramProgress] = useState(null);
  const [sendingToSelf, setSendingToSelf] = useState(false);
  const [telegramImage, setTelegramImage] = useState(null);
  const [telegramImagePreview, setTelegramImagePreview] = useState(null);

  // Проверка прав администратора
  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/');
    }
  }, [user, navigate]);

  // Загрузка объявлений
  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/announcements');
      setAnnouncements(response.data);
      setError(null);
    } catch (err) {
      console.error('Ошибка загрузки объявлений:', err);
      setError('Не удалось загрузить объявления');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    
    // Проверяем, что есть хотя бы текст или изображения
    if (!newAnnouncement.trim() && selectedImages.length === 0) {
      setError('Добавьте текст или изображения');
      return;
    }

    try {
      setCreating(true);
      
      // Создаем FormData для отправки файлов
      const formData = new FormData();
      formData.append('content', newAnnouncement.trim() || ' '); // Отправляем пробел если текста нет
      
      // Добавляем все выбранные изображения
      selectedImages.forEach((image) => {
        formData.append('images', image);
      });
      
      await api.post('/admin/announcements', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setNewAnnouncement('');
      setSelectedImages([]);
      setImagePreviews([]);
      setError(null);
      await fetchAnnouncements();
    } catch (err) {
      console.error('Ошибка создания объявления:', err);
      setError('Не удалось создать объявление');
    } finally {
      setCreating(false);
    }
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    addImages(files);
  };

  const addImages = (files) => {
    // Проверяем, не превышает ли общее количество 5
    if (selectedImages.length + files.length > 5) {
      setError('Можно загрузить максимум 5 изображений');
      return;
    }

    const validFiles = [];
    const newPreviews = [];

    files.forEach((file) => {
      // Проверяем тип файла
      if (!file.type.startsWith('image/')) {
        setError('Можно загружать только изображения');
        return;
      }
      
      // Проверяем размер файла (макс 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Размер изображения не должен превышать 5MB');
        return;
      }
      
      validFiles.push(file);
      
      // Создаем превью
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push(reader.result);
        if (newPreviews.length === validFiles.length) {
          setImagePreviews([...imagePreviews, ...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });

    setSelectedImages([...selectedImages, ...validFiles]);
  };

  const handleRemoveImage = (index) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    addImages(files);
  };

  const handleDeleteAnnouncement = async (id) => {
    try {
      await api.delete(`/admin/announcements/${id}`);
      await fetchAnnouncements();
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Ошибка удаления объявления:', err);
      setError('Не удалось удалить объявление');
    }
  };

  const handleSendTelegramAnnouncement = async () => {
    if (!telegramAnnouncement.trim()) {
      return;
    }

    try {
      setSendingTelegram(true);
      setTelegramProgress({ current: 0, total: 0 });

      // Если есть изображение — загружаем
      let imageUrl = null;
      if (telegramImage) {
        const formData = new FormData();
        formData.append('image', telegramImage);
        const uploadRes = await api.post('/admin/advertising/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (uploadRes.data?.url) {
          imageUrl = uploadRes.data.url;
        }
      }

      const response = await api.post('/admin/telegram-announcement', {
        content: telegramAnnouncement.trim(),
        imageUrl
      });
      
      setTelegramProgress({
        current: response.data.success,
        total: response.data.total,
        failed: response.data.failed
      });
      
      // Показываем результат на 3 секунды, затем закрываем модалку
      setTimeout(() => {
        setShowTelegramModal(false);
        setTelegramAnnouncement('');
        setTelegramProgress(null);
        setTelegramImage(null);
        setTelegramImagePreview(null);
      }, 3000);
    } catch (err) {
      console.error('Ошибка отправки объявления в Telegram:', err);
      setError('Не удалось отправить объявление в Telegram');
      setTelegramProgress(null);
    } finally {
      setSendingTelegram(false);
    }
  };

  const handleSendToSelf = async () => {
    if (!telegramAnnouncement.trim()) {
      return;
    }

    try {
      setSendingToSelf(true);
      
      await api.post('/admin/telegram-announcement-self', {
        content: telegramAnnouncement.trim()
      });
      
      // Показываем уведомление об успехе
      alert('Объявление отправлено вам в Telegram!');
    } catch (err) {
      console.error('Ошибка отправки объявления себе:', err);
      setError('Не удалось отправить объявление');
    } finally {
      setSendingToSelf(false);
    }
  };

  const handleTelegramImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { setError('Максимум 5MB'); return; }
    setTelegramImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setTelegramImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  // Функции для форматирования текста (Telegram MarkdownV2)
  const insertFormatting = (before, after = '', placeholder = '') => {
    const textarea = document.querySelector(`.${styles.telegramTextarea}`);
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = telegramAnnouncement.substring(start, end);
    const textToInsert = selectedText || placeholder;
    const newText = 
      telegramAnnouncement.substring(0, start) +
      before + textToInsert + after +
      telegramAnnouncement.substring(end);
    
    setTelegramAnnouncement(newText);
    
    // Восстанавливаем фокус и позицию курсора
    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        const newCursorPos = start + before.length + selectedText.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      } else {
        // Если текст не был выделен, выделяем placeholder
        const selectionStart = start + before.length;
        const selectionEnd = selectionStart + placeholder.length;
        textarea.setSelectionRange(selectionStart, selectionEnd);
      }
    }, 0);
  };

  const insertAtCursor = (text) => {
    const textarea = document.querySelector(`.${styles.telegramTextarea}`);
    if (!textarea) return;

    const start = textarea.selectionStart;
    const newText = 
      telegramAnnouncement.substring(0, start) +
      text +
      telegramAnnouncement.substring(start);
    
    setTelegramAnnouncement(newText);
    
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + text.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Telegram форматирование
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
    // Находим номер для следующего пункта
    const textBefore = telegramAnnouncement.substring(0, start);
    const lines = textBefore.split('\n');
    const lastLine = lines[lines.length - 1];
    const match = lastLine.match(/^(\d+)\.\s/);
    const nextNumber = match ? parseInt(match[1]) + 1 : 1;
    insertAtCursor(`${nextNumber}. `);
  };

  // Рендер превью с Telegram форматированием
  const renderTelegramPreview = (text) => {
    if (!text) return 'Превью появится здесь...';
    
    let html = text;
    
    // Экранируем HTML теги
    html = html.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Ссылки: [текст](url)
    html = html.replace(/\[([^\]]+?)\]\(([^)]+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Моноширинный блок: ```текст``` (обрабатываем первым)
    html = html.replace(/```\n?([\s\S]+?)\n?```/g, '<pre>$1</pre>');
    
    // Инлайн код: `текст`
    html = html.replace(/`([^`]+?)`/g, '<code>$1</code>');
    
    // Жирный текст: *текст*
    html = html.replace(/\*([^*]+?)\*/g, '<strong>$1</strong>');
    
    // Подчёркнутый: __текст__
    html = html.replace(/__([^_]+?)__/g, '<u>$1</u>');
    
    // Курсив: _текст_ (один подчёркивание, не два)
    html = html.replace(/(?<!_)_([^_]+?)_(?!_)/g, '<em>$1</em>');
    
    // Зачёркнутый: ~текст~
    html = html.replace(/~([^~]+?)~/g, '<s>$1</s>');
    
    // Цитаты: > текст
    html = html.replace(/^&gt;\s(.+)$/gm, '<blockquote>$1</blockquote>');
    
    // Нумерованные списки: 1. текст
    html = html.replace(/^(\d+)\.\s(.+)$/gm, '<div class="numbered-item"><span class="number">$1.</span> $2</div>');
    
    // Маркированные списки: • текст
    html = html.replace(/^•\s(.+)$/gm, '<div class="bullet-item">• $1</div>');
    
    // Переносы строк
    html = html.replace(/\n/g, '<br/>');
    
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!user?.isAdmin) {
    return null;
  }

  return (
    <div className={styles.announcementsPage}>
      <button 
        className={styles.backButton}
        onClick={() => navigate('/settings')}
      >
        <Icon name="arrow-left" size="medium" />
        <span>Назад</span>
      </button>
      
      <div className={styles.header}>
        <h1><Icon name="announcement" size="medium" /> Управление объявлениями</h1>
      </div>

      {/* Форма создания объявления */}
      <div className={styles.createSection}>
        <h2>Создать новое объявление</h2>
        <form onSubmit={handleCreateAnnouncement} className={styles.createForm}>
          <div className={styles.textareaWrapper}>
            <textarea
              value={newAnnouncement}
              onChange={(e) => setNewAnnouncement(e.target.value)}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              placeholder="Введите текст объявления..."
              className={`${styles.textarea} ${isDragging ? styles.dragging : ''}`}
              rows={4}
              disabled={creating}
            />
            
            {/* Кнопка загрузки изображения внутри textarea */}
            <label 
              htmlFor="imageInput" 
              className={styles.attachButton} 
              title="Прикрепить изображения"
            >
              <Icon name="paperclip" size="medium" />
            </label>
            
            {/* Скрытый input для загрузки файлов */}
            <input
              id="imageInput"
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className={styles.hiddenFileInput}
              disabled={creating || selectedImages.length >= 5}
            />
          </div>
          
          {/* Превью изображений */}
          {imagePreviews.length > 0 && (
            <div className={styles.imagePreviewsContainer}>
              <div className={styles.imagePreviewsHeader}>
                <span>Изображения: {selectedImages.length} / 5</span>
              </div>
              <div className={styles.imagePreviews}>
                {imagePreviews.map((preview, index) => (
                  <div key={index} className={styles.imagePreview}>
                    <img src={preview} alt={`Превью ${index + 1}`} />
                    <button
                      type="button"
                      className={styles.removeImageButton}
                      onClick={() => handleRemoveImage(index)}
                      disabled={creating}
                      title="Удалить изображение"
                    >
                      <Icon name="close" size="small" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className={styles.createButtons}>
            <button 
              type="submit" 
              className={styles.createButton}
              disabled={creating || (!newAnnouncement.trim() && selectedImages.length === 0)}
            >
              {creating ? 'Создание...' : 'Создать объявление'}
            </button>
            <button 
              type="button"
              className={styles.telegramButton}
              onClick={() => setShowTelegramModal(true)}
            >
              <Icon name="telegram" size="small" /> Объявление в ТГ
            </button>
          </div>
        </form>
      </div>

      {/* Список объявлений */}
      <div className={styles.announcementsList}>
        <h2>Все объявления</h2>
        
        {error && (
          <div className={styles.error}>{error}</div>
        )}

        {loading ? (
          <div className={styles.loading}>Загрузка...</div>
        ) : announcements.length === 0 ? (
          <div className={styles.empty}>Объявлений пока нет</div>
        ) : (
          <div className={styles.announcements}>
            {announcements.map((announcement) => (
              <div key={announcement.id} className={styles.announcementCard}>
                <div className={styles.announcementHeader}>
                  <div className={styles.announcementMeta}>
                    <span className={styles.creatorName}>
                      {announcement.creatorName || 'Администратор'}
                    </span>
                    <span className={styles.date}>
                      {formatDate(announcement.createdAt)}
                    </span>
                  </div>
                  <button
                    className={styles.deleteButton}
                    onClick={() => setDeleteConfirm(announcement.id)}
                    title="Удалить объявление"
                  >
                    <Icon name="delete" size="small" />
                  </button>
                </div>
                <div className={styles.announcementContent}>
                  {announcement.content}
                </div>
                
                {/* Изображения объявления */}
                {announcement.imageUrls && announcement.imageUrls.length > 0 && (
                  <div className={styles.announcementImages}>
                    {announcement.imageUrls.map((imageUrl, index) => (
                      <div key={index} className={styles.announcementImage}>
                        <img 
                          src={imageUrl.startsWith('http') ? imageUrl : `${import.meta.env.VITE_API_URL || ''}${imageUrl}`} 
                          alt={`Изображение ${index + 1}`} 
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Модальное окно подтверждения удаления */}
                {deleteConfirm === announcement.id && (
                  <div className={styles.confirmModal}>
                    <div className={styles.confirmContent}>
                      <p>Вы уверены, что хотите удалить это объявление?</p>
                      <div className={styles.confirmButtons}>
                        <button
                          className={styles.confirmDelete}
                          onClick={() => handleDeleteAnnouncement(announcement.id)}
                        >
                          Удалить
                        </button>
                        <button
                          className={styles.confirmCancel}
                          onClick={() => setDeleteConfirm(null)}
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модальное окно для Telegram объявления */}
      {showTelegramModal && (
        <div className={styles.telegramModal}>
          <div className={styles.telegramModalContent}>
            <h3><Icon name="telegram" size="medium" /> Отправить объявление в Telegram</h3>
            <p className={styles.telegramModalDescription}>
              Объявление будет отправлено всем пользователям через Telegram бота
            </p>
            
            {/* Панель инструментов форматирования */}
            <div className={styles.formattingToolbar}>
              <button
                type="button"
                onClick={handleBold}
                className={styles.formatButton}
                title="Жирный (*текст*)"
                disabled={sendingTelegram || sendingToSelf}
              >
                <strong>B</strong>
              </button>
              <button
                type="button"
                onClick={handleItalic}
                className={styles.formatButton}
                title="Курсив (_текст_)"
                disabled={sendingTelegram || sendingToSelf}
              >
                <em>I</em>
              </button>
              <button
                type="button"
                onClick={handleUnderline}
                className={styles.formatButton}
                title="Подчёркнутый (__текст__)"
                disabled={sendingTelegram || sendingToSelf}
              >
                <u>U</u>
              </button>
              <button
                type="button"
                onClick={handleStrikethrough}
                className={styles.formatButton}
                title="Зачёркнутый (~текст~)"
                disabled={sendingTelegram || sendingToSelf}
              >
                <s>S</s>
              </button>
              <button
                type="button"
                onClick={handleCode}
                className={styles.formatButton}
                title="Код (`код`)"
                disabled={sendingTelegram || sendingToSelf}
              >
                <code>{'<>'}</code>
              </button>
              <button
                type="button"
                onClick={handleMonospace}
                className={styles.formatButton}
                title="Блок кода (```код```)"
                disabled={sendingTelegram || sendingToSelf}
              >
                <code>{'{ }'}</code>
              </button>
              <button
                type="button"
                onClick={handleQuote}
                className={styles.formatButton}
                title="Цитата (> текст)"
                disabled={sendingTelegram || sendingToSelf}
              >
                <span>"</span>
              </button>
              <button
                type="button"
                onClick={handleLink}
                className={styles.formatButton}
                title="Ссылка ([текст](url))"
                disabled={sendingTelegram || sendingToSelf}
              >
                <span>🔗</span>
              </button>
              <button
                type="button"
                onClick={handleBulletList}
                className={styles.formatButton}
                title="Маркированный список (• текст)"
                disabled={sendingTelegram || sendingToSelf}
              >
                <span>•</span>
              </button>
              <button
                type="button"
                onClick={handleNumberedList}
                className={styles.formatButton}
                title="Нумерованный список (1. текст)"
                disabled={sendingTelegram || sendingToSelf}
              >
                <span>1.</span>
              </button>
            </div>

            {/* Редактор текста */}
            <textarea
              value={telegramAnnouncement}
              onChange={(e) => setTelegramAnnouncement(e.target.value)}
              placeholder="Введите текст объявления для Telegram..."
              className={`${styles.textarea} ${styles.telegramTextarea}`}
              rows={6}
              disabled={sendingTelegram || sendingToSelf}
            />

            {/* Загрузка изображения для ТГ */}
            <div className={styles.telegramImageSection}>
              <label className={styles.telegramImageLabel}>
                <Icon name="image" size="small" /> Изображение (необязательно)
              </label>
              <input type="file" accept="image/*" onChange={handleTelegramImageSelect} className={styles.hiddenFileInput} id="tgImageInputAnn" disabled={sendingTelegram || sendingToSelf} />
              {telegramImagePreview ? (
                <div className={styles.telegramImagePreview}>
                  <img src={telegramImagePreview} alt="Превью" />
                  <button type="button" className={styles.removeImageButton} onClick={() => { setTelegramImage(null); setTelegramImagePreview(null); }} disabled={sendingTelegram || sendingToSelf}>
                    <Icon name="close" size="small" />
                  </button>
                </div>
              ) : (
                <label htmlFor="tgImageInputAnn" className={styles.telegramImageDropzone}>
                  <Icon name="image" size="medium" />
                  <span>Нажмите или перетащите изображение</span>
                </label>
              )}
            </div>

            {/* Превью сообщения */}
            <div className={styles.previewSection}>
              <h4>Превью сообщения:</h4>
              <div className={styles.telegramPreview}>
                {renderTelegramPreview(telegramAnnouncement)}
              </div>
            </div>

            {telegramProgress && (
              <div className={styles.progressInfo}>
                <p>
                  Отправлено: {telegramProgress.current} из {telegramProgress.total}
                </p>
                {telegramProgress.failed > 0 && (
                  <p className={styles.progressError}>
                    Не удалось отправить: {telegramProgress.failed}
                  </p>
                )}
              </div>
            )}

            <div className={styles.telegramModalButtons}>
              <button
                className={styles.telegramSendToSelfButton}
                onClick={handleSendToSelf}
                disabled={sendingTelegram || sendingToSelf || !telegramAnnouncement.trim()}
              >
                {sendingToSelf ? 'Отправка...' : 'Отправить себе'}
              </button>
              <button
                className={styles.telegramSendButton}
                onClick={handleSendTelegramAnnouncement}
                disabled={sendingTelegram || sendingToSelf || !telegramAnnouncement.trim()}
              >
                {sendingTelegram ? 'Отправка...' : 'Отправить'}
              </button>
              <button
                className={styles.telegramCancelButton}
                onClick={() => {
                  setShowTelegramModal(false);
                  setTelegramAnnouncement('');
                  setTelegramProgress(null);
                }}
                disabled={sendingTelegram || sendingToSelf}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnouncementsPage;
