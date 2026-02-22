import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { login } from '../store/slices/authSlice';
import api from '../services/api';
import styles from './VerifyEmailPage.module.css';

/**
 * Страница подтверждения email
 */
function VerifyEmailPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [error, setError] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setError('Токен подтверждения отсутствует');
        return;
      }

      try {
        const response = await api.get(`/auth/verify-email/${token}`);
        
        console.log('Email подтвержден:', response.data);

        // Сохраняем токен
        localStorage.setItem('token', response.data.token);

        // Обновляем Redux store
        dispatch(login(response.data));

        setStatus('success');

        // Перенаправляем на главную страницу через 3 секунды
        setTimeout(() => {
          navigate('/feed');
        }, 3000);

      } catch (err) {
        console.error('Ошибка подтверждения email:', err);
        
        setStatus('error');
        
        if (err.response?.data?.code === 'INVALID_TOKEN') {
          setError('Неверный или недействительный токен подтверждения');
        } else if (err.response?.data?.code === 'TOKEN_EXPIRED') {
          setError('Токен подтверждения истек. Пожалуйста, запросите новое письмо.');
        } else if (err.response?.data?.code === 'EMAIL_ALREADY_VERIFIED') {
          setError('Email уже подтвержден. Вы можете войти в систему.');
        } else if (err.response?.data?.error) {
          setError(err.response.data.error);
        } else {
          setError('Ошибка подтверждения email. Попробуйте позже.');
        }
      }
    };

    verifyEmail();
  }, [token, navigate, dispatch]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {status === 'verifying' && (
          <>
            <div className={styles.spinner}></div>
            <h1>Подтверждение email...</h1>
            <p>Пожалуйста, подождите</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className={styles.successIcon}>✓</div>
            <h1>Email подтвержден!</h1>
            <p className={styles.successMessage}>
              Ваш email успешно подтвержден. Вы автоматически вошли в систему.
            </p>
            <p className={styles.redirectMessage}>
              Перенаправление на главную страницу...
            </p>
            <Link to="/feed" className={styles.button}>
              Перейти сейчас
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className={styles.errorIcon}>✕</div>
            <h1>Ошибка подтверждения</h1>
            <p className={styles.errorMessage}>{error}</p>
            <div className={styles.actions}>
              <Link to="/login" className={styles.button}>
                Войти
              </Link>
              <Link to="/register-email" className={styles.buttonSecondary}>
                Зарегистрироваться заново
              </Link>
            </div>
          </>
        )}
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

export default VerifyEmailPage;
