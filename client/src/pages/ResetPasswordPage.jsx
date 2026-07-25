import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import zxcvbn from 'zxcvbn';
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

  // Оценка сложности пароля через zxcvbn
  const passwordStrength = useMemo(() => {
    if (!formData.password) return null;
    return zxcvbn(formData.password);
  }, [formData.password]);

  const strengthLabels = ['Очень слабый', 'Слабый', 'Средний', 'Сильный', 'Очень сильный'];
  const strengthColors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#27ae60'];

  // Переводы сообщений zxcvbn
  const zxcvbnTranslations = {
    warnings: {
      'This is a very common password': 'Это очень распространённый пароль',
      'This is similar to a commonly used password': 'Это похож на часто используемый пароль',
      'This is a top-10 common password': 'Это один из 10 самых распространённых паролей',
      'This is a top-100 common password': 'Это один из 100 самых распространённых паролей',
      'Repeats like "aaa" are easy to guess': 'Повторы (например "aaa") легко угадать',
      'Repeats like "abcabcabc" are only slightly harder to guess than "abc"': 'Повторы (например "abcabcabc") лишь немного сложнее чем "abc"',
      'Sequences like abc or 6543 are easy to guess': 'Последовательности (например "abc" или "6543") легко угадать',
      'Short keyboard patterns are easy to guess': 'Короткие паттерны клавиатуры легко угадать',
      'Dates are often easy to guess': 'Даты часто легко угадать',
      'A word by itself is easy to guess': 'Одно слово само по себе легко угадать',
      'Names and surnames by themselves are easy to guess': 'Имена и фамилии сами по себе легко угадать',
      'Too short': 'Слишком короткий',
    },
    suggestions: {
      'Add another word or two. Uncommon words are better.': 'Добавьте ещё одно-два слова. Редкие слова лучше.',
      'Add more words that are less common': 'Добавьте слова, которые встречаются реже',
      'Use a few words, and avoid common phrases': 'Используйте несколько слов, избегайте распространённых фраз',
      'No need for symbols, digits, or uppercase letters': 'Не нужны символы, цифры или заглавные буквы',
      'Avoid repeated words and characters': 'Избегайте повторяющихся слов и символов',
      'Avoid repeated words': 'Избегайте повторяющихся слов',
      'Avoid sequences': 'Избегайте последовательностей',
      'Avoid recent years': 'Избегайте последних годов',
      'Avoid dates and years that are associated with you': 'Избегайте дат и годов, связанных с вами',
      'Avoid dates and years': 'Избегайте дат и годов',
      'Use a longer keyboard pattern with more turns': 'Используйте более длинный паттерн клавиатуры с большими перепадами',
    }
  };

  const translateFeedback = (text) => {
    if (!text) return '';
    let translated = text;
    for (const [en, ru] of Object.entries(zxcvbnTranslations.warnings)) {
      translated = translated.replaceAll(en, ru);
    }
    for (const [en, ru] of Object.entries(zxcvbnTranslations.suggestions)) {
      translated = translated.replaceAll(en, ru);
    }
    return translated;
  };

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
    } else if (passwordStrength && passwordStrength.score < 2) {
      const feedback = translateFeedback(passwordStrength.feedback.warning) || translateFeedback(passwordStrength.feedback.suggestions?.[0]) || '';
      newErrors.password = `Пароль слишком простой. ${feedback}`;
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

      const serverError = error.data?.error || error.data?.message || error.message;

      if (error.data?.code === 'INVALID_TOKEN') {
        setErrors({ general: 'Неверный или недействительный токен сброса пароля' });
      } else if (error.data?.code === 'TOKEN_EXPIRED') {
        setErrors({ general: 'Токен сброса пароля истек. Пожалуйста, запросите новую ссылку.' });
      } else if (serverError) {
        setErrors({ general: serverError });
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

            {/* Индикатор сложности пароля */}
            {formData.password && passwordStrength && (
              <div className={styles.strengthMeter}>
                <div className={styles.strengthBar}>
                  {[0, 1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={styles.strengthSegment}
                      style={{
                        backgroundColor: i < passwordStrength.score
                          ? strengthColors[passwordStrength.score]
                          : 'var(--bg-tertiary)'
                      }}
                    />
                  ))}
                </div>
                <span
                  className={styles.strengthLabel}
                  style={{ color: strengthColors[passwordStrength.score] }}
                >
                  {strengthLabels[passwordStrength.score]}
                </span>
                {passwordStrength.feedback.warning && (
                  <p className={styles.strengthHint}>{translateFeedback(passwordStrength.feedback.warning)}</p>
                )}
              </div>
            )}

            {/* Базовые требования */}
            <div className={styles.passwordRequirements}>
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
