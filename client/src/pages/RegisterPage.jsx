import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicHeader from '../components/Layout/PublicHeader';
import styles from './RegisterPage.module.css';

/**
 * Страница выбора способа регистрации
 * Предлагает четыре варианта: Telegram, Email, Google, Discord
 */
const RegisterPage = () => {
  const navigate = useNavigate();

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

  const registrationMethods = [
    {
      id: 'telegram',
      name: 'Telegram',
      icon: '✈️',
      description: 'Быстрая регистрация через Telegram бот',
      color: '#0088cc',
      available: true,
      action: () => navigate('/login') // Пока используем существующую страницу логина
    },
    {
      id: 'email',
      name: 'Email',
      icon: '📧',
      description: 'Регистрация с помощью электронной почты',
      color: '#ea4335',
      available: true,
      action: () => navigate('/register-email')
    },
    {
      id: 'google',
      name: 'Google',
      icon: '🔍',
      description: 'Войти с помощью аккаунта Google',
      color: '#4285f4',
      available: true,
      action: () => {
        // Редирект на backend OAuth endpoint
        window.location.href = '/api/auth/google';
      }
    },
    {
      id: 'discord',
      name: 'Discord',
      icon: '💬',
      description: 'Войти с помощью аккаунта Discord',
      color: '#5865f2',
      available: true,
      action: () => {
        // Редирект на backend OAuth endpoint
        window.location.href = '/api/auth/discord';
      }
    }
  ];

  return (
    <div className={styles.registerPage}>
      <PublicHeader />

      <main className={styles.mainContent}>
        <div className={styles.container}>
          {/* Заголовок */}
          <div className={styles.header}>
            <h1 className={styles.title}>Добро пожаловать в watchRebel!</h1>
            <p className={styles.subtitle}>
              Выберите удобный способ регистрации
            </p>
          </div>

          {/* Методы регистрации */}
          <div className={styles.methodsGrid}>
            {registrationMethods.map((method) => (
              <button
                key={method.id}
                className={`${styles.methodCard} ${!method.available ? styles.disabled : ''}`}
                onClick={method.action}
                disabled={!method.available}
                style={{
                  '--method-color': method.color
                }}
              >
                <div className={styles.methodIcon}>{method.icon}</div>
                <h3 className={styles.methodName}>{method.name}</h3>
                <p className={styles.methodDescription}>{method.description}</p>
                {!method.available && (
                  <span className={styles.comingSoon}>Скоро</span>
                )}
              </button>
            ))}
          </div>

          {/* Дополнительная информация */}
          <div className={styles.infoSection}>
            <h2 className={styles.infoTitle}>Почему стоит зарегистрироваться?</h2>
            <ul className={styles.featuresList}>
              <li className={styles.featureItem}>
                <span className={styles.featureIcon}>📋</span>
                <span>Создавайте свои списки фильмов и сериалов</span>
              </li>
              <li className={styles.featureItem}>
                <span className={styles.featureIcon}>⭐</span>
                <span>Оценивайте просмотренное и делитесь отзывами</span>
              </li>
              <li className={styles.featureItem}>
                <span className={styles.featureIcon}>👥</span>
                <span>Находите друзей с похожими вкусами</span>
              </li>
              <li className={styles.featureItem}>
                <span className={styles.featureIcon}>🔔</span>
                <span>Получайте уведомления о новинках</span>
              </li>
              <li className={styles.featureItem}>
                <span className={styles.featureIcon}>📺</span>
                <span>Отслеживайте прогресс просмотра сериалов</span>
              </li>
            </ul>
          </div>

          {/* Ссылка на вход */}
          <div className={styles.loginLink}>
            <p>
              Уже есть аккаунт?{' '}
              <button 
                className={styles.loginButton}
                onClick={() => navigate('/login')}
              >
                Войти
              </button>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
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
};

export default RegisterPage;
