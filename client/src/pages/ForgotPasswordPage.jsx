import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import styles from './ForgotPasswordPage.module.css';

/**
 * Страница запроса сброса пароля
 */
function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      setError('Email обязателен');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Неверный формат email');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err) {
      console.error('Ошибка запроса сброса пароля:', err);
      
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Ошибка отправки запроса. Попробуйте позже.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.container}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>✉️</div>
          <h1>Проверьте свою почту!</h1>
          <p className={styles.successMessage}>
            Мы отправили письмо со ссылкой для сброса пароля на адрес <strong>{email}</strong>
          </p>
          <p className={styles.successHint}>
            Перейдите по ссылке в письме, чтобы установить новый пароль.
          </p>
          <div className={styles.successNote}>
            <p>💡 Не получили письмо?</p>
            <ul>
              <li>Проверьте папку "Спам"</li>
              <li>Убедитесь, что email указан правильно</li>
              <li>Письмо может прийти в течение нескольких минут</li>
              <li>Ссылка действительна в течение 1 часа</li>
            </ul>
          </div>
          <Link to="/login" className={styles.backButton}>
            Вернуться на страницу входа
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>Забыли пароль?</h1>
          <p>Введите ваш email, и мы отправим ссылку для сброса пароля</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              className={error ? styles.inputError : ''}
              placeholder="your@email.com"
              disabled={loading}
              autoComplete="email"
            />
            {error && (
              <span className={styles.error}>{error}</span>
            )}
          </div>

          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? 'Отправка...' : 'Отправить ссылку'}
          </button>
        </form>

        <div className={styles.footer}>
          <p>
            Вспомнили пароль? <Link to="/login">Войти</Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className={styles.pageFooter}>
        <div className={styles.footerContent}>
          <p className={styles.copyright}>
            © 2026 watchRebel. Социальная сеть для любителей кино и сериалов.
          </p>
          <div className={styles.links}>
            <Link to="/about" className={styles.link}>О проекте</Link>
            <span className={styles.separator}>•</span>
            <Link to="/privacy" className={styles.link}>Конфиденциальность</Link>
            <span className={styles.separator}>•</span>
            <Link to="/terms" className={styles.link}>Условия использования</Link>
            <span className={styles.separator}>•</span>
            <Link to="/advertising-contacts" className={styles.link}>Контакты для рекламы</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default ForgotPasswordPage;
