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
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  // Состояние для Telegram объявления
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramAnnouncement, setTelegramAnnouncement] = useState('');
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [telegramProgress, setTelegramProgress] = useState(null);

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
    
    if (!newAnnouncement.trim()) {
      return;
    }

    try {
      setCreating(true);
      
      // Создаем FormData для отправки файла
      const formData = new FormData();
      formData.append('content', newAnnouncement.trim());
      if (selectedImage) {
        formData.append('image', selectedImage);
      }
      
      await api.post('/admin/announcements', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setNewAnnouncement('');
      setSelectedImage(null);
      setImagePreview(null);
      await fetchAnnouncements();
    } catch (err) {
      console.error('Ошибка создания объявления:', err);
      setError('Не удалось создать объявление');
    } finally {
      setCreating(false);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
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
      
      setSelectedImage(file);
      
      // Создаем превью
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
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
      
      const response = await api.post('/admin/telegram-announcement', {
        content: telegramAnnouncement.trim()
      });
      
      setTelegramProgress({
        current: response.data.success,
        total: response.data.total,
        failed: response.data.failed
      });
      
      // Показываем результат на 3 секунды
      setTimeout(() => {
        setShowTelegramModal(false);
        setTelegramAnnouncement('');
        setTelegramProgress(null);
      }, 3000);
    } catch (err) {
      console.error('Ошибка отправки объявления в Telegram:', err);
      setError('Не удалось отправить объявление в Telegram');
      setTelegramProgress(null);
    } finally {
      setSendingTelegram(false);
    }
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
      <div className={styles.header}>
        <h1><Icon name="announcement" size="medium" /> Управление объявлениями</h1>
        <button 
          className={styles.backButton}
          onClick={() => navigate('/settings')}
        >
          ← Назад к настройкам
        </button>
      </div>

      {/* Форма создания объявления */}
      <div className={styles.createSection}>
        <h2>Создать новое объявление</h2>
        <form onSubmit={handleCreateAnnouncement} className={styles.createForm}>
          <div className={styles.textareaWrapper}>
            <textarea
              value={newAnnouncement}
              onChange={(e) => setNewAnnouncement(e.target.value)}
              placeholder="Введите текст объявления..."
              className={styles.textarea}
              rows={4}
              disabled={creating}
            />
            
            {/* Кнопка загрузки изображения внутри textarea */}
            <label htmlFor="imageInput" className={styles.attachButton} title="Прикрепить изображение">
              <Icon name="paperclip" size="medium" />
            </label>
            <input
              id="imageInput"
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className={styles.imageInput}
              disabled={creating}
            />
          </div>
          
          {/* Превью изображения */}
          {imagePreview && (
            <div className={styles.imagePreview}>
              <img src={imagePreview} alt="Превью" />
              <button
                type="button"
                className={styles.removeImageButton}
                onClick={handleRemoveImage}
                disabled={creating}
                title="Удалить изображение"
              >
                <Icon name="close" size="small" />
              </button>
            </div>
          )}
          
          <div className={styles.createButtons}>
            <button 
              type="submit" 
              className={styles.createButton}
              disabled={creating || !newAnnouncement.trim()}
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
                
                {/* Изображение объявления */}
                {announcement.imageUrl && (
                  <div className={styles.announcementImage}>
                    <img 
                      src={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${announcement.imageUrl}`} 
                      alt="Изображение объявления" 
                    />
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
            
            <textarea
              value={telegramAnnouncement}
              onChange={(e) => setTelegramAnnouncement(e.target.value)}
              placeholder="Введите текст объявления для Telegram..."
              className={styles.textarea}
              rows={6}
              disabled={sendingTelegram}
            />

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
                className={styles.telegramSendButton}
                onClick={handleSendTelegramAnnouncement}
                disabled={sendingTelegram || !telegramAnnouncement.trim()}
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
                disabled={sendingTelegram}
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
