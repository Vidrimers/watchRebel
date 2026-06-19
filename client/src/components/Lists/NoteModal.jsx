import React, { useState } from 'react';
import Icon from '../Common/Icon';
import api from '../../services/api';
import useAlert from '../../hooks/useAlert';
import styles from './NoteModal.module.css';

/**
 * Модалка для просмотра/редактирования/удаления персональной заметки
 */
const NoteModal = ({ item, listId, onClose, onUpdate }) => {
  const { alertDialog, showAlert } = useAlert();
  const [note, setNote] = useState(item.personalNote || '');
  const [isEditing, setIsEditing] = useState(!item.personalNote);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    try {
      setLoading(true);
      await api.put(`/lists/${listId}/items/${item.id}/note`, {
        personalNote: note.trim() || null
      });

      if (onUpdate) onUpdate(note.trim() || null);
      onClose();
    } catch (error) {
      await showAlert({
        title: 'Ошибка',
        message: error.response?.data?.error || 'Не удалось сохранить заметку',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      await api.put(`/lists/${listId}/items/${item.id}/note`, {
        personalNote: null
      });

      if (onUpdate) onUpdate(null);
      onClose();
    } catch (error) {
      await showAlert({
        title: 'Ошибка',
        message: error.response?.data?.error || 'Не удалось удалить заметку',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <>
      {alertDialog}
      <div className={styles.backdrop} onClick={handleBackdropClick}>
        <div className={styles.modal}>
          <div className={styles.header}>
            <h3 className={styles.title}>
              <Icon name="edit" size="small" />
              Заметка: {item.title}
            </h3>
            <button className={styles.closeBtn} onClick={onClose}>
              <Icon name="close" size={18} />
            </button>
          </div>

          <div className={styles.content}>
            {isEditing ? (
              <>
                <textarea
                  className={styles.textarea}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ссылки, комментарии..."
                  rows={5}
                  maxLength={500}
                  autoFocus
                />
                <span className={styles.charCount}>{note.length}/500</span>
              </>
            ) : (
              <p className={styles.noteText}>{note}</p>
            )}
          </div>

          <div className={styles.actions}>
            {isEditing ? (
              <>
                <button
                  className={styles.cancelBtn}
                  onClick={() => {
                    setNote(item.personalNote || '');
                    setIsEditing(!item.personalNote);
                  }}
                  disabled={loading}
                >
                  Отмена
                </button>
                <button
                  className={styles.saveBtn}
                  onClick={handleSave}
                  disabled={loading}
                >
                  {loading ? 'Сохранение...' : 'Сохранить'}
                </button>
              </>
            ) : (
              <>
                {item.personalNote && (
                  <button
                    className={styles.deleteBtn}
                    onClick={handleDelete}
                    disabled={loading}
                  >
                    <Icon name="delete" size={16} /> Удалить
                  </button>
                )}
                <button
                  className={styles.editBtn}
                  onClick={() => setIsEditing(true)}
                >
                  <Icon name="edit" size={16} /> Редактировать
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default NoteModal;
