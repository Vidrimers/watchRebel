import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { login } from '../store/slices/authSlice';
import './LoginPage.css';

/**
 * Страница авторизации через Telegram
 * Автоматически авторизует пользователя по токену из URL параметров
 */
function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  
  const { isAuthenticated, loading, error } = useAppSelector((state) => state.auth);
  const [authAttempted, setAuthAttempted] = useState(false);

  useEffect(() => {
    // Если уже авторизован, перенаправляем на главную
    if (isAuthenticated) {
      navigate('/', { replace: true });
      return;
    }

    // Получаем токен из URL параметров
    const token = searchParams.get('token');
    const userId = searchParams.get('userId');
    const username = searchParams.get('username');
    const displayName = searchParams.get('displayName');
    const avatarUrl = searchParams.get('avatarUrl');

    // Если есть токен и данные пользователя, пытаемся авторизоваться
    if (token && userId && !authAttempted) {
      setAuthAttempted(true);
      
      // Сохраняем токен в localStorage
      localStorage.setItem('authToken', token);
      
      // Отправляем данные для авторизации
      dispatch(login({
        token,
        userId,
        username,
        displayName,
        avatarUrl
      }));
    }
  }, [searchParams, isAuthenticated, navigate, dispatch, authAttempted]);

  // Если идет загрузка
  if (loading) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-card">
            <div className="login-logo">
              <h1>watchRebel</h1>
              <p className="login-subtitle">Социальная сеть для любителей кино</p>
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

  // Если есть ошибка
  if (error) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-card">
            <div className="login-logo">
              <h1>watchRebel</h1>
              <p className="login-subtitle">Социальная сеть для любителей кино</p>
            </div>
            <div className="login-error">
              <div className="error-icon">⚠️</div>
              <h2>Ошибка авторизации</h2>
              <p>{error.message || 'Не удалось авторизоваться'}</p>
              <button 
                className="retry-button"
                onClick={() => window.location.href = '/'}
              >
                Попробовать снова
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Страница приглашения авторизоваться через Telegram
  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">
            <h1>watchRebel</h1>
            <p className="login-subtitle">Социальная сеть для любителей кино</p>
          </div>
          
          <div className="login-content">
            <div className="login-icon">🎬</div>
            <h2>Добро пожаловать!</h2>
            <p className="login-description">
              Ведите учет просмотренных фильмов и сериалов, делитесь отзывами 
              и находите друзей с похожими вкусами
            </p>
            
            <div className="login-instructions">
              <h3>Как начать:</h3>
              <ol>
                <li>Откройте Telegram бота watchRebel</li>
                <li>Нажмите команду /start</li>
                <li>Перейдите по ссылке из бота</li>
              </ol>
            </div>

            <div className="login-telegram">
              <a 
                href={`https://t.me/${import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'watchrebel_bot'}`}
                className="telegram-button"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="telegram-icon">✈️</span>
                Открыть Telegram бота
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
