import React, { useEffect, useRef } from 'react';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { checkSession } from '../store/slices/authSlice';
import { connectWebSocket, disconnectWebSocket } from '../services/websocket';
import { fetchNicknames, setNicknames, setNicknameDisplayMode } from '../utils/nicknameResolver';

/**
 * Компонент для инициализации приложения
 * Проверяет сессию пользователя при загрузке
 */
function AppInitializer({ children }) {
  const dispatch = useAppDispatch();
  const { loading, user } = useAppSelector((state) => state.auth);
  const [initialized, setInitialized] = React.useState(false);
  const wsConnectedRef = useRef(false);
  const currentUserIdRef = useRef(null);

  useEffect(() => {
    const initializeAuth = async () => {
      await dispatch(checkSession());
      setInitialized(true);
    };

    initializeAuth();
  }, [dispatch]);

  // Загружаем ники и настройки отображения когда пользователь авторизован
  useEffect(() => {
    if (user?.id) {
      fetchNicknames();
      setNicknameDisplayMode(user.nicknameDisplay || 'name');
    }
  }, [user?.id, user?.nicknameDisplay]);

  // Подключаем WebSocket когда пользователь авторизован
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userId = user?.id;
    
    // Если пользователь изменился - отключаем старое соединение
    if (currentUserIdRef.current && currentUserIdRef.current !== userId) {
      console.log('🔌 Пользователь изменился, отключаем старое соединение');
      disconnectWebSocket();
      wsConnectedRef.current = false;
    }
    
    // Подключаем WebSocket только если еще не подключен
    if (userId && token && !wsConnectedRef.current) {
      console.log('🔌 Инициализация WebSocket для пользователя:', userId);
      connectWebSocket(token);
      wsConnectedRef.current = true;
      currentUserIdRef.current = userId;
    }
  }, [user?.id]);

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
