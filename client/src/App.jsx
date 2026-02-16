import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppSelector } from './hooks/useAppSelector';
import AppInitializer from './components/AppInitializer';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import UserPageLayout from './components/Layout/UserPageLayout';

// Временный компонент главной страницы
function HomePage() {
  const { user } = useAppSelector((state) => state.auth);

  return (
    <UserPageLayout user={user}>
      {/* Здесь будет Wall компонент */}
      <div style={{ 
        background: 'var(--bg-secondary)', 
        padding: '20px', 
        borderRadius: '12px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <h1>watchRebel</h1>
        <p>Социальная сеть для любителей кино</p>
        <p style={{ marginTop: '20px', color: 'var(--text-secondary)' }}>
          Добро пожаловать, {user?.displayName || 'Пользователь'}!
        </p>
        <p style={{ marginTop: '10px', color: 'var(--text-secondary)' }}>
          Здесь будет отображаться Wall пользователя.
        </p>
      </div>
    </UserPageLayout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppInitializer>
        <Routes>
          {/* Публичный маршрут - страница логина */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* Защищенные маршруты */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            } 
          />
          
          {/* Перенаправление всех неизвестных маршрутов на главную */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppInitializer>
    </BrowserRouter>
  );
}

export default App;
