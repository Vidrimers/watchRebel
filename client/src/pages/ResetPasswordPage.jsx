import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import styles from './ResetPasswordPage.module.css';

/**
 * Страница сброса пароля
 */
function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Валидация формы
  const validateForm = () => {
    const newErrors = {};

    // Пароль
    if (!formData.password) {
      newErrors.password = 'Пароль обязателен';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Пароль должен содержать минимум 8 символов';
    } else if (!/[a-zA-Zа-яА-Я]/.test(formData.password)) {
      newErrors.password = 'Пароль должен содержать хотя бы одну букву';
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = 'Пароль должен содержать хотя бы одну цифру';
    }

    // Подтверждение пароля
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Подтвердите пароль';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Пароли не совпадают';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Обработка изменения полей
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Очищаем ошибку для этого поля
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Обработка отправки формы
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      await api.post('/auth/reset-password', {
        token,
        password: formData.password
      });

      setSuccess(true);

      // Перенаправляем на страницу входа через 3 секунды
      setTimeout(() => {
        navigate('/login');
      }, 3000);

    } catch (error) {
      console.error('Ошибка сброса пароля:', error);
      
      if (error.response?.data?.code === 'INVALID_TOKEN') {
        setErrors({ general: 'Неверный или недействительный токен сброса пароля' });
      } else if (error.response?.data?.code === 'TOKEN_EXPIRED') {
        setErrors({ general: 'Токен сброса пароля истек. Пожалуйста, запросите новую ссылку.' });
      } else if (error.response?.data?.error) {
        setErrors({ general: error.response.data.error });
      } else {
        setErrors({ general: 'Ошибка сброса пароля. Попробуйте позже.' });
      }
    } finally {
      setLoading(false);
    }
  };

  // Если сброс успешен
  if (success) {
    return (
      <div className={styles.container}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>✓</div>
          <h1>Пароль изменен!</h1>
          <p className={styles.successMessage}>
            Ваш пароль успешно изменен. Теперь вы можете войти с новым паролем.
          </p>
          <p className={styles.redirectMessage}>
            Перенаправление на страницу входа...
          </p>
          <Link to="/login" className={styles.button}>
            Войти сейчас
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>Установить новый пароль</h1>
          <p>Введите новый пароль для вашего аккаунта</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Пароль */}
          <div className={styles.formGroup}>
            <label htmlFor="password">Новый пароль</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={errors.password ? styles.inputError : ''}
              placeholder="Минимум 8 символов"
              disabled={loading}
            />
            {errors.password && (
              <span className={styles.error}>{errors.password}</span>
            )}
            
            {/* Требования к паролю */}
            <div className={styles.passwordRequirements}>
              <p>Требования к паролю:</p>
              <ul>
                <li className={formData.password.length >= 8 ? styles.valid : ''}>
                  Минимум 8 символов
                </li>
                <li className={/[a-zA-Zа-яА-Я]/.test(formData.password) ? styles.valid : ''}>
                  Хотя бы одна буква
                </li>
                <li className={/[0-9]/.test(formData.password) ? styles.valid : ''}>
                  Хотя бы одна цифра
                </li>
              </ul>
            </div>
          </div>

          {/* Подтверждение пароля */}
          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword">Подтвердите пароль</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={errors.confirmPassword ? styles.inputError : ''}
              placeholder="Повторите пароль"
              disabled={loading}
            />
            {errors.confirmPassword && (
              <span className={styles.error}>{errors.confirmPassword}</span>
            )}
          </div>

          {/* Общая ошибка */}
          {errors.general && (
            <div className={styles.generalError}>
              {errors.general}
            </div>
          )}

          {/* Кнопка отправки */}
          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? 'Сохранение...' : 'Сохранить новый пароль'}
          </button>
        </form>

        <div className={styles.footer}>
          <p>
            <Link to="/login">Вернуться на страницу входа</Link>
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
            <a href="/about" className={styles.link}>О проекте</a>
            <span className={styles.separator}>•</span>
            <a href="/privacy" className={styles.link}>Конфиденциальность</a>
            <span className={styles.separator}>•</span>
            <a href="/terms" className={styles.link}>Условия использования</a>
            <span className={styles.separator}>•</span>
            <a href="/advertising-contacts" className={styles.link}>Контакты для рекламы</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default ResetPasswordPage;
