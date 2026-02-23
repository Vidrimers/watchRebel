import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { login } from '../store/slices/authSlice';
import api from '../services/api';
import styles from './LoginEmailPage.module.css';

/**
 * Страница входа через Email
 */
function LoginEmailPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Принудительно устанавливаем светлую тему для страниц аутентификации
  useEffect(() => {
    const savedTheme = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', 'light-cream');
    
    return () => {
      // Восстанавливаем предыдущую тему при размонтировании
      if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
      }
    };
  }, []);

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

    // Простая валидация
    const newErrors = {};
    if (!formData.email) {
      newErrors.email = 'Email обязателен';
    }
    if (!formData.password) {
      newErrors.password = 'Пароль обязателен';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const response = await api.post('/auth/login-email', {
        email: formData.email,
        password: formData.password
      });

      console.log('Вход успешен:', response.data);

      // Сохраняем токен
      localStorage.setItem('token', response.data.token);

      // Обновляем Redux store
      dispatch(login(response.data));

      // Перенаправляем на главную страницу
      navigate('/feed');

    } catch (error) {
      console.error('Ошибка входа:', error);
      
      if (error.response?.data?.code === 'INVALID_CREDENTIALS') {
        setErrors({ general: 'Неверный email или пароль' });
      } else if (error.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        setErrors({ 
          general: 'Email не подтвержден. Пожалуйста, проверьте свою почту и перейдите по ссылке подтверждения.' 
        });
      } else if (error.response?.data?.code === 'USER_BLOCKED') {
        setErrors({ general: 'Ваш аккаунт заблокирован' });
      } else if (error.response?.data?.error) {
        setErrors({ general: error.response.data.error });
      } else {
        setErrors({ general: 'Ошибка входа. Попробуйте позже.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>Вход через Email</h1>
          <p>Войдите в свой аккаунт watchRebel</p>
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
              autoComplete="email"
            />
            {errors.email && (
              <span className={styles.error}>{errors.email}</span>
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
              placeholder="Введите пароль"
              disabled={loading}
              autoComplete="current-password"
            />
            {errors.password && (
              <span className={styles.error}>{errors.password}</span>
            )}
          </div>

          {/* Забыли пароль */}
          <div className={styles.forgotPassword}>
            <Link to="/forgot-password">Забыли пароль?</Link>
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
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div className={styles.footer}>
          <p>
            Нет аккаунта? <Link to="/register-email">Зарегистрироваться</Link>
          </p>
          <p>
            <Link to="/login">Другие способы входа</Link>
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

export default LoginEmailPage;
