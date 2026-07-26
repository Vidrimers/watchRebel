import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { checkSession } from '../../store/slices/authSlice';
import Icon from '../Common/Icon';
import api from '../../services/api';
import styles from './TwoFactorVerify.module.css';

/**
 * Экран верификации 2FA при входе
 * Показывается после успешной первичной аутентификации, если 2FA включена
 */
function TwoFactorVerify({ preAuthToken, user, onBack }) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  
  const [code, setCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tokenExpired, setTokenExpired] = useState(false);

  // Проверяем срок действия pre-auth токена
  useEffect(() => {
    if (!preAuthToken) return;

    try {
      const [dataB64] = preAuthToken.split('.');
      const data = JSON.parse(atob(dataB64));
      const timeLeft = data.exp - Date.now();

      if (timeLeft <= 0) {
        setTokenExpired(true);
        return;
      }

      // Таймер для проверки истечения токена
      const timer = setTimeout(() => {
        setTokenExpired(true);
      }, timeLeft);

      return () => clearTimeout(timer);
    } catch {
      setTokenExpired(true);
    }
  }, [preAuthToken]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (tokenExpired) {
      setError('Срок действия кода истёк. Пожалуйста, войдите заново.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        preAuthToken,
        ...(useBackupCode ? { backupCode } : { code })
      };

      const response = await api.post('/2fa/verify', payload);

      // Сохраняем токен
      localStorage.setItem('authToken', response.data.token);

      // Проверяем сессию (обновляет Redux store)
      await dispatch(checkSession()).unwrap();

      // Перенаправляем на главную
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Ошибка верификации 2FA:', err);

      if (err.response?.data?.code === 'PRE_AUTH_EXPIRED') {
        setTokenExpired(true);
      } else if (err.response?.data?.code === 'INVALID_2FA_CODE') {
        setError(err.response.data.error);
      } else {
        setError(err.response?.data?.error || 'Ошибка верификации');
      }
    } finally {
      setLoading(false);
    }
  };

  // Если токен истёк
  if (tokenExpired) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.iconContainer}>
            <Icon name="clock" size="large" />
          </div>
          <h2 className={styles.title}>Срок действия истёк</h2>
          <p className={styles.description}>
            Время для ввода кода 2FA истекло. Пожалуйста, войдите заново.
          </p>
          <button onClick={onBack} className={styles.backButton}>
            Вернуться к входу
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconContainer}>
          <Icon name="shield" size="large" />
        </div>
        
        <h2 className={styles.title}>Двухфакторная аутентификация</h2>
        
        {user && (
          <p className={styles.welcome}>
            Добро пожаловать, <strong>{user.displayName}</strong>
          </p>
        )}

        {!useBackupCode ? (
          <>
            <p className={styles.description}>
              Введите 6-значный код из приложения-аутентификатора
            </p>

            <form onSubmit={handleSubmit} className={styles.form}>
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setError(null);
                }}
                placeholder="000000"
                className={`${styles.codeInput} ${error ? styles.inputError : ''}`}
                maxLength={6}
                autoFocus
                disabled={loading}
              />

              {error && (
                <div className={styles.error}>{error}</div>
              )}

              <button
                type="submit"
                className={styles.submitButton}
                disabled={loading || code.length !== 6}
              >
                {loading ? 'Проверка...' : 'Подтвердить'}
              </button>
            </form>

            <button
              onClick={() => {
                setUseBackupCode(true);
                setError(null);
              }}
              className={styles.linkButton}
            >
              Использовать backup-код
            </button>
          </>
        ) : (
          <>
            <p className={styles.description}>
              Введите backup-код (8 символов)
            </p>

            <form onSubmit={handleSubmit} className={styles.form}>
              <input
                type="text"
                value={backupCode}
                onChange={(e) => {
                  setBackupCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8));
                  setError(null);
                }}
                placeholder="XXXXXXXX"
                className={`${styles.codeInput} ${styles.backupInput} ${error ? styles.inputError : ''}`}
                maxLength={8}
                autoFocus
                disabled={loading}
              />

              {error && (
                <div className={styles.error}>{error}</div>
              )}

              <button
                type="submit"
                className={styles.submitButton}
                disabled={loading || backupCode.length !== 8}
              >
                {loading ? 'Проверка...' : 'Подтвердить'}
              </button>
            </form>

            <button
              onClick={() => {
                setUseBackupCode(false);
                setBackupCode('');
                setError(null);
              }}
              className={styles.linkButton}
            >
              Использовать код из аутентификатора
            </button>
          </>
        )}

        <button onClick={onBack} className={styles.cancelButton}>
          Отмена
        </button>
      </div>
    </div>
  );
}

export default TwoFactorVerify;
