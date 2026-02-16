import React, { useEffect } from 'react';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { checkSession } from '../store/slices/authSlice';

/**
 * Компонент для инициализации приложения
 * Проверяет сессию пользователя при загрузке
 */
function AppInitializer({ children }) {
  const dispatch = useAppDispatch();
  const { loading } = useAppSelector((state) => state.auth);
  const [initialized, setInitialized] = React.useState(false);

  useEffect(() => {
    // Проверяем сессию при первой загрузке
    const initializeAuth = async () => {
      await dispatch(checkSession());
      setInitialized(true);
    };

    initializeAuth();
  }, [dispatch]);

  // Показываем загрузку пока идет инициализация
  if (!initialized || loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-primary)'
      }}>
        <div style={{
          textAlign: 'center'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid var(--bg-secondary)',
            borderTopColor: 'var(--accent-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Загрузка...</p>
        </div>
      </div>
    );
  }

  return children;
}

export default AppInitializer;
