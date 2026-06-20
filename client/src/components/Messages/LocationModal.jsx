import React, { useState } from 'react';
import Icon from '../Common/Icon';
import styles from './LocationModal.module.css';

const LocationModal = ({ onSend, onClose }) => {
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (lat && lng) {
      onSend({
        type: 'location',
        latitude: parseFloat(lat),
        longitude: parseFloat(lng)
      });
      onClose();
    }
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude.toFixed(6));
          setLng(position.coords.longitude.toFixed(6));
          setLoading(false);
        },
        (error) => {
          console.error('Ошибка геолокации:', error);
          setLoading(false);
          alert('Не удалось определить местоположение');
        }
      );
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Геометка</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className={styles.content}>
          <button 
            className={styles.locationBtn}
            onClick={handleGetCurrentLocation}
            disabled={loading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="22" y1="12" x2="18" y2="12"/>
              <line x1="6" y1="12" x2="2" y2="12"/>
              <line x1="12" y1="6" x2="12" y2="2"/>
              <line x1="12" y1="22" x2="12" y2="18"/>
            </svg>
            {loading ? 'Определение...' : 'Определить местоположение'}
          </button>

          <div className={styles.inputs}>
            <div className={styles.inputGroup}>
              <label>Широта</label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="55.7558"
              />
            </div>
            <div className={styles.inputGroup}>
              <label>Долгота</label>
              <input
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="37.6173"
              />
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose}>Отмена</button>
          <button 
            className={styles.sendBtn} 
            onClick={handleSend}
            disabled={!lat || !lng}
          >
            Отправить
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationModal;
