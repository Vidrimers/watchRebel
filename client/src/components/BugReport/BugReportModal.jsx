import { useState, useRef } from 'react';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { createBugReport } from '../../store/slices/bugReportsSlice';
import useAlert from '../../hooks/useAlert';
import styles from './BugReportModal.module.css';

/**
 * Модальное окно для создания багрепорта
 * @param {Object} props
 * @param {boolean} props.isOpen - Открыто ли модальное окно
 * @param {Function} props.onClose - Функция закрытия модального окна
 */
function BugReportModal({ isOpen, onClose }) {
  const dispatch = useAppDispatch();
  const { alertDialog, showAlert } = useAlert();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Закрытие модального окна
  const handleClose = () => {
    if (isLoading) return;
    setTitle('');
    setDescription('');
    setImages([]);
    setImagePreviews([]);
    setError('');
    onClose();
  };

  // Обработка выбора файлов
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    addImages(files);
  };

  // Добавление изображений
  const addImages = (files) => {
    // Фильтруем только изображения
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    // Проверяем лимит
    const remainingSlots = 5 - images.length;
    if (imageFiles.length > remainingSlots) {
      setError(`Максимум 5 изображений. Можно добавить еще ${remainingSlots}`);
      return;
    }

    // Создаем превью
    const newPreviews = [];
    const newImages = [];

    imageFiles.forEach(file => {
      // Проверяем размер файла (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError(`Файл ${file.name} слишком большой. Максимум 5MB`);
        return;
      }

      newImages.push(file);

      const reader = new FileReader();
      reader.onload = (e) => {
        newPreviews.push({
          file,
          url: e.target.result
        });

        if (newPreviews.length === imageFiles.length) {
          setImages(prev => [...prev, ...newImages]);
          setImagePreviews(prev => [...prev, ...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });

    setError('');
  };

  // Удаление изображения
  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Drag and drop
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    addImages(files);
  };

  // Отправка багрепорта
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Валидация
    if (!title.trim()) {
      setError('Введите заголовок');
      return;
    }

    if (!description.trim()) {
      setError('Введите описание');
      return;
    }

    setIsLoading(true);

    try {
      await dispatch(createBugReport({
        title: title.trim(),
        description: description.trim(),
        images: images
      })).unwrap();

      // Успех
      await showAlert({
        title: 'Успешно!',
        message: 'Багрепорт успешно отправлен! Спасибо за обратную связь.',
        type: 'success'
      });
      handleClose();

    } catch (err) {
      console.error('Ошибка отправки багрепорта:', err);
      setError(err.message || 'Ошибка отправки багрепорта');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {alertDialog}
      <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Сообщить о проблеме</h2>
          <button
            className={styles.closeButton}
            onClick={handleClose}
            disabled={isLoading}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.field}>
            <label htmlFor="title">Заголовок *</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Кратко опишите проблему"
              disabled={isLoading}
              maxLength={200}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="description">Описание *</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Подробно опишите проблему, шаги для воспроизведения, ожидаемое и фактическое поведение"
              disabled={isLoading}
              rows={6}
              maxLength={2000}
            />
          </div>

          <div className={styles.field}>
            <label>Изображения (опционально)</label>
            <div
              className={`${styles.dropZone} ${isDragging ? styles.dragging : ''}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                disabled={isLoading || images.length >= 5}
              />
              <div className={styles.dropZoneContent}>
                <span className={styles.uploadIcon}>📷</span>
                <p>Перетащите изображения сюда или нажмите для выбора</p>
                <span className={styles.imageCount}>{images.length} / 5</span>
              </div>
            </div>

            {imagePreviews.length > 0 && (
              <div className={styles.previews}>
                {imagePreviews.map((preview, index) => (
                  <div key={index} className={styles.previewItem}>
                    <img src={preview.url} alt={`Превью ${index + 1}`} />
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => removeImage(index)}
                      disabled={isLoading}
                      aria-label="Удалить изображение"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={handleClose}
              disabled={isLoading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isLoading || !title.trim() || !description.trim()}
            >
              {isLoading ? 'Отправка...' : 'Отправить'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}

export default BugReportModal;
