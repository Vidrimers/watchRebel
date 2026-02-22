import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import styles from './RegisterEmailPage.module.css';

/**
 * Страница регистрации через Email
 */
function RegisterEmailPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Валидация формы
  const validateForm = () => {
    const newErrors = {};

    // Email
    if (!formData.email) {
      newErrors.email = 'Email обязателен';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Неверный формат email';
    }

    // Имя
    if (!formData.displayName) {
      newErrors.displayName = 'Имя обязательно';
    } else if (formData.displayName.length < 2) {
      newErrors.displayName = 'Имя должно содержать минимум 2 символа';
    } else if (formData.displayName.length > 50) {
      newErrors.displayName = 'Имя должно содержать максимум 50 символов';
    }

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
      const response = await api.post('/auth/register-email', {
        email: formData.email,
        password: formData.password,
        displayName: formData.displayName
      });

      console.log('Регистрация успешна:', response.data);
      setSuccess(true);

    } catch (error) {
      console.error('Ошибка регистрации:', error);
      
      if (error.response?.data?.code === 'EMAIL_ALREADY_EXISTS') {
        setErrors({ email: 'Этот email уже зарегистрирован' });
      } else if (error.response?.data?.error) {
        setErrors({ general: error.response.data.error });
      } else {
        setErrors({ general: 'Ошибка регистрации. Попробуйте позже.' });
      }
    } finally {
      setLoading(false);
    }
  };

  // Если регистрация успешна, показываем сообщение
  if (success) {
    return (
      <div className={styles.container}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>✉️</div>
          <h1>Проверьте свою почту!</h1>
          <p className={styles.successMessage}>
            Мы отправили письмо с подтверждением на адрес <strong>{formData.email}</strong>
          </p>
          <p className={styles.successHint}>
            Перейдите по ссылке в письме, чтобы завершить регистрацию и войти в систему.
          </p>
          <div className={styles.successNote}>
            <p>💡 Не получили письмо?</p>
            <ul>
              <li>Проверьте папку "Спам"</li>
              <li>Убедитесь, что email указан правильно</li>
              <li>Письмо может прийти в течение нескольких минут</li>
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
          <h1>Регистрация через Email</h1>
          <p>Создайте аккаунт на watchRebel</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Email */}
          <div className={styles.formGroup}>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? styles.inputError : ''}
              placeholder="your@email.com"
              disabled={loading}
            />
            {errors.email && (
              <span className={styles.error}>{errors.email}</span>
            )}
          </div>

          {/* Имя */}
          <div className={styles.formGroup}>
            <label htmlFor="displayName">Имя</label>
            <input
              type="text"
              id="displayName"
              name="displayName"
              value={formData.displayName}
              onChange={handleChange}
              className={errors.displayName ? styles.inputError : ''}
              placeholder="Ваше имя"
              disabled={loading}
            />
            {errors.displayName && (
              <span className={styles.error}>{errors.displayName}</span>
            )}
          </div>

          {/* Пароль */}
          <div className={styles.formGroup}>
            <label htmlFor="password">Пароль</label>
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
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className={styles.footer}>
          <p>
            Уже есть аккаунт? <Link to="/login">Войти</Link>
          </p>
          <p>
            <Link to="/register">Другие способы регистрации</Link>
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

export default RegisterEmailPage;
