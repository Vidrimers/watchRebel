import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppSelector } from './hooks/useAppSelector';
import AppInitializer from './components/AppInitializer';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy loading для всех страниц
const LoginPage = lazy(() => import('./pages/LoginPage'));
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const MediaDetailPage = lazy(() => import('./pages/MediaDetailPage'));
const ListsPage = lazy(() => import('./pages/ListsPage'));
const WatchlistPage = lazy(() => import('./pages/WatchlistPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const CatalogPage = lazy(() => import('./pages/CatalogPage'));
const IntegrationTestPage = lazy(() => import('./pages/IntegrationTestPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));

// Компонент загрузки для Suspense
function LoadingFallback() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontSize: '18px',
      color: '#666'
    }}>
      Загрузка...
    </div>
  );
}

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
    <ErrorBoundary>
      <BrowserRouter>
        <AppInitializer>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Публичный маршрут - страница логина */}
              <Route path="/login" element={<LoginPage />} />
              
              {/* Публичный маршрут - тестирование интеграции */}
              <Route path="/integration-test" element={<IntegrationTestPage />} />
              
              {/* Публичные страницы Footer */}
              <Route path="/about" element={<AboutPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              
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

              {/* Страница каталога */}
              <Route 
                path="/catalog" 
                element={
                  <ProtectedRoute>
                    <CatalogPage />
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

              {/* Страница списков */}
              <Route 
                path="/lists" 
                element={
                  <ProtectedRoute>
                    <ListsPage />
                  </ProtectedRoute>
                } 
              />

              {/* Страница списка желаемого */}
              <Route 
                path="/watchlist" 
                element={
                  <ProtectedRoute>
                    <WatchlistPage />
                  </ProtectedRoute>
                } 
              />

              {/* Страница уведомлений */}
              <Route 
                path="/notifications" 
                element={
                  <ProtectedRoute>
                    <NotificationsPage />
                  </ProtectedRoute>
                } 
              />

              {/* Страница сообщений */}
              <Route 
                path="/messages" 
                element={
                  <ProtectedRoute>
                    <MessagesPage />
                  </ProtectedRoute>
                } 
              />

              {/* Страница друзей */}
              <Route 
                path="/friends" 
                element={
                  <ProtectedRoute>
                    <FriendsPage />
                  </ProtectedRoute>
                } 
              />

              {/* Страница настроек */}
              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                } 
              />
              
              {/* Перенаправление всех неизвестных маршрутов на главную */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AppInitializer>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
