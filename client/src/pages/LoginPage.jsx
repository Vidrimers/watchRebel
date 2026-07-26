import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { checkSession } from '../store/slices/authSlice';
import TwoFactorVerify from '../components/Auth/TwoFactorVerify';
import Icon from '../components/Common/Icon';
import api from '../services/api';
import './LoginPage.css';

/**
 * Страница авторизации через Telegram Login Widget
 * Пользователь входит одним кликом через виджет Telegram
 */
function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  
  const { isAuthenticated, loading } = useAppSelector((state) => state.auth);
  const [authError, setAuthError] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Состояние для 2FA
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [preAuthToken, setPreAuthToken] = useState(null);
  const [twoFactorUser, setTwoFactorUser] = useState(null);

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

  useEffect(() => {
    // Если уже авторизован, перенаправляем на главную
    if (isAuthenticated) {
      navigate('/', { replace: true });
      return;
    }

    // Проверяем старый способ авторизации через URL параметры (для кнопок в боте)
    const token = searchParams.get('token') || searchParams.get('session');
    const userId = searchParams.get('userId');

    if (token) {
      console.log('📥 Обнаружен токен в URL, авторизуемся...');
      
      // Сохраняем токен в localStorage
      localStorage.setItem('authToken', token);
      
      // Проверяем сессию (обновляет Redux store)
      dispatch(checkSession())
        .unwrap()
        .then(() => {
          console.log('✅ Авторизация через URL успешна');
          navigate('/', { replace: true });
        })
        .catch((error) => {
          console.error('❌ Ошибка авторизации через URL:', error);
          setAuthError('Не удалось авторизоваться. Попробуйте войти через Telegram.');
          localStorage.removeItem('authToken');
        });
      
      return;
    }

    // Проверяем сессию при загрузке страницы (если токен уже есть в localStorage)
    const existingToken = localStorage.getItem('authToken');
    if (existingToken) {
      dispatch(checkSession());
    }
  }, [isAuthenticated, navigate, dispatch, searchParams]);

  // Глобальная функция для обработки ответа от Telegram Widget
  useEffect(() => {
    // ВАЖНО: Создаём функцию ДО загрузки скрипта виджета
    window.onTelegramAuth = async (user) => {
      console.log('📥 Получены данные от Telegram:', user);
      setIsAuthenticating(true);
      setAuthError(null);

      try {
        // Отправляем данные на backend
        const response = await api.post('/auth/telegram-widget', user);

        // Проверяем, требуется ли 2FA
        if (response.data.requiresTwoFactor) {
          setPreAuthToken(response.data.preAuthToken);
          setTwoFactorUser(response.data.user);
          setTwoFactorRequired(true);
          setIsAuthenticating(false);
          return;
        }

        const { token, user: userData } = response.data;

        // Сохраняем токен
        localStorage.setItem('authToken', token);

        console.log('✅ Авторизация успешна:', userData.displayName);

        // Проверяем сессию (обновляет Redux store)
        await dispatch(checkSession()).unwrap();

        // Перенаправляем на главную
        navigate('/', { replace: true });
      } catch (error) {
        console.error('❌ Ошибка авторизации:', error);
        setAuthError(error.response?.data?.error || 'Не удалось авторизоваться');
        setIsAuthenticating(false);
      }
    };

    // Проверяем что функция действительно создана
    console.log('✅ window.onTelegramAuth создана:', typeof window.onTelegramAuth);

    // Загружаем скрипт Telegram Widget ПОСЛЕ создания функции
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'watchRebel_bot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;

    const container = document.getElementById('telegram-login-container');
    if (container) {
      container.appendChild(script);
      console.log('✅ Telegram Widget скрипт загружен');
    } else {
      console.error('❌ Контейнер telegram-login-container не найден!');
    }

    return () => {
      // Очистка при размонтировании
      if (container && script.parentNode === container) {
        container.removeChild(script);
      }
      delete window.onTelegramAuth;
    };
  }, [dispatch, navigate]);

  // Обработчик возврата из 2FA
  const handleBackFrom2FA = () => {
    setTwoFactorRequired(false);
    setPreAuthToken(null);
    setTwoFactorUser(null);
    setIsAuthenticating(false);
  };

  // Если требуется 2FA — показываем экран верификации
  if (twoFactorRequired) {
    return (
      <TwoFactorVerify
        preAuthToken={preAuthToken}
        user={twoFactorUser}
        onBack={handleBackFrom2FA}
      />
    );
  }

  // Если идет загрузка или авторизация
  if (loading || isAuthenticating) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-card">
            <div className="login-logo">
              <h1>watchRebel</h1>
              <p className="login-subtitle">Социальная сеть для любителей кино и сериалов</p>
            </div>
            <div className="login-loading">
              <div className="spinner"></div>
              <p>Авторизация...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Страница входа через Telegram
  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">
            <div className="login-icon">
              <img src="/images/logo-animation.png" alt="watchRebel" />
            </div>
            <p className="login-subtitle">Социальная сеть для любителей кино и сериалов</p>
          </div>
          
          <div className="login-content">
            
            <p className="login-description">
              Ведите учет просмотренных фильмов и сериалов, делитесь отзывами 
              и находите друзей с похожими вкусами
            </p>
            
            <div className="login-telegram-widget">
              <p className="widget-label">Войти через Telegram:</p>
              <div id="telegram-login-container"></div>
            </div>

            {/* Разделитель */}
            <div className="login-divider">
              <span>или</span>
            </div>

            {/* Все способы входа */}
            <div className="login-oauth-buttons">
              <button 
                className="oauth-button email-button"
                onClick={() => navigate('/login-email')}
              >
                <span className="oauth-icon"><Icon name="email" size="medium" /></span>
                <span>Войти через Email</span>
              </button>

              <button 
                className="oauth-button google-button"
                onClick={() => window.location.href = '/api/auth/google'}
              >
                <span className="oauth-icon"><Icon name="google" size="medium" /></span>
                <span>Войти через Google</span>
              </button>

              <button 
                className="oauth-button discord-button"
                onClick={() => window.location.href = '/api/auth/discord'}
              >
                <span className="oauth-icon"><Icon name="discord" size="medium" /></span>
                <span>Войти через Discord</span>
              </button>
            </div>

            {/* Ссылка на регистрацию */}
            <div className="login-footer-links">
              <p>
                Нет аккаунта? <button 
                  className="link-button"
                  onClick={() => navigate('/register')}
                >
                  Зарегистрироваться
                </button>
              </p>
            </div>

            {authError && (
              <div className="login-error-message">
                <span className="error-icon">⚠️</span>
                <p>{authError}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
