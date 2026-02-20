import React, { useEffect, useState } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import api from '../../services/api';
import styles from './ReferralStats.module.css';

/**
 * Компонент для отображения статистики рефералов
 * Показывает количество приглашенных друзей и список рефералов
 */
const ReferralStats = ({ userId }) => {
  const { user: currentUser } = useAppSelector((state) => state.auth);
  const [referralCode, setReferralCode] = useState(null);
  const [referralsCount, setReferralsCount] = useState(0);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReferrals, setShowReferrals] = useState(false);
  const [error, setError] = useState(null);

  // Проверяем, это свой профиль или чужой
  const isOwnProfile = currentUser?.id === userId;

  useEffect(() => {
    // Загружаем статистику только для своего профиля
    if (isOwnProfile) {
      loadReferralStats();
    }
  }, [userId, isOwnProfile]);

  /**
   * Загрузка статистики рефералов
   */
  const loadReferralStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Получаем реферальный код и количество рефералов
      const response = await api.get(`/users/${userId}/referral-code`);
      setReferralCode(response.data.referralCode);
      setReferralsCount(response.data.referralsCount || 0);

      setLoading(false);
    } catch (err) {
      console.error('Ошибка загрузки статистики рефералов:', err);
      
      // Если ошибка 404 или пользователь не найден, показываем fallback
      if (err.response?.status === 404 || err.response?.data?.code === 'USER_NOT_FOUND') {
        setReferralCode(null);
        setReferralsCount(0);
        setLoading(false);
      } else {
        // Для других ошибок показываем сообщение
        setError('Не удалось загрузить статистику');
        setLoading(false);
      }
    }
  };

  /**
   * Загрузка списка рефералов
   */
  const loadReferrals = async () => {
    try {
      const response = await api.get(`/users/${userId}/referrals`);
      setReferrals(response.data);
    } catch (err) {
      console.error('Ошибка загрузки списка рефералов:', err);
      
      // Если ошибка 404, просто показываем пустой список
      if (err.response?.status === 404) {
        setReferrals([]);
      } else {
        setError('Не удалось загрузить список рефералов');
      }
    }
  };

  /**
   * Переключение отображения списка рефералов
   */
  const toggleReferrals = async () => {
    if (!showReferrals && referrals.length === 0) {
      await loadReferrals();
    }
    setShowReferrals(!showReferrals);
  };

  // Не отображаем компонент для чужих профилей
  if (!isOwnProfile) {
    return null;
  }

  if (loading) {
    return (
      <div className={styles.referralStats}>
        <p className={styles.loading}>Загрузка статистики...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.referralStats}>
        <p className={styles.error}>{error}</p>
      </div>
    );
  }

  return (
    <div className={styles.referralStats}>
      <div className={styles.statsHeader}>
        <h3 className={styles.statsTitle}>👥 Приглашенные друзья</h3>
        <div className={styles.statsCount}>
          <span className={styles.countNumber}>{referralsCount}</span>
          <span className={styles.countLabel}>друзей</span>
        </div>
      </div>

      {referralsCount > 0 && (
        <button 
          className={styles.toggleButton}
          onClick={toggleReferrals}
        >
          {showReferrals ? '▼ Скрыть список' : '▶ Показать список'}
        </button>
      )}

      {showReferrals && (
        <div className={styles.referralsList}>
          {referrals.length === 0 ? (
            <p className={styles.emptyMessage}>Загрузка...</p>
          ) : (
            <ul className={styles.referralsItems}>
              {referrals.map((referral) => (
                <li key={referral.id} className={styles.referralItem}>
                  <div className={styles.referralAvatar}>
                    {referral.avatarUrl ? (
                      <img 
                        src={
                          referral.avatarUrl.startsWith('/uploads/')
                            ? `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${referral.avatarUrl}`
                            : referral.avatarUrl
                        } 
                        alt={referral.displayName} 
                      />
                    ) : (
                      <div className={styles.avatarPlaceholder}>
                        {referral.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className={styles.referralInfo}>
                    <p className={styles.referralName}>{referral.displayName}</p>
                    {referral.telegramUsername && (
                      <p className={styles.referralUsername}>@{referral.telegramUsername}</p>
                    )}
                    <p className={styles.referralDate}>
                      Присоединился: {new Date(referral.referralCreatedAt).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {referralsCount === 0 && (
        <p className={styles.emptyMessage}>
          Вы еще не пригласили друзей. Используйте Telegram бот для получения реферальной ссылки!
        </p>
      )}
    </div>
  );
};

export default ReferralStats;
