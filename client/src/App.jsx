import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppSelector } from './hooks/useAppSelector';
import AppInitializer from './components/AppInitializer';
import LoginPage from './pages/LoginPage';
import UserProfilePage from './pages/UserProfilePage';
import SearchPage from './pages/SearchPage';
import MediaDetailPage from './pages/MediaDetailPage';
import ProtectedRoute from './components/ProtectedRoute';

// Временный компонент главной страницы - редирект на профиль пользователя
function HomePage() {
  const { user } = useAppSelector((state) => state.auth);

  if (user) {
    return <Navigate to={`/user/${user.id}`} replace />;
  }

  return <Navigate to="/login" replace />;
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

          {/* Страница профиля пользователя */}
          <Route 
            path="/user/:userId" 
            element={
              <ProtectedRoute>
                <UserProfilePage />
              </ProtectedRoute>
            } 
          />

          {/* Страница поиска */}
          <Route 
            path="/search" 
            element={
              <ProtectedRoute>
                <SearchPage />
              </ProtectedRoute>
            } 
          />

          {/* Детальная страница медиа-контента */}
          <Route 
            path="/media/:mediaType/:mediaId" 
            element={
              <ProtectedRoute>
                <MediaDetailPage />
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
