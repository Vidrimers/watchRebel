import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppSelector } from './hooks/useAppSelector';
import AppInitializer from './components/AppInitializer';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy loading для всех страниц
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const RegisterEmailPage = lazy(() => import('./pages/RegisterEmailPage'));
const LoginEmailPage = lazy(() => import('./pages/LoginEmailPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const PublicCatalogPage = lazy(() => import('./pages/PublicCatalogPage'));
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const MediaDetailPage = lazy(() => import('./pages/MediaDetailPage'));
const ListsPage = lazy(() => import('./pages/ListsPage'));
const ListDetailPage = lazy(() => import('./pages/ListDetailPage'));
const WatchlistPage = lazy(() => import('./pages/WatchlistPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const FeedPage = lazy(() => import('./pages/FeedPage'));
const CatalogPage = lazy(() => import('./pages/CatalogPage'));
const IntegrationTestPage = lazy(() => import('./pages/IntegrationTestPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const AdvertisingContactsPage = lazy(() => import('./pages/AdvertisingContactsPage'));
const UsersManagementPage = lazy(() => import('./pages/UsersManagementPage'));
const AnnouncementsPage = lazy(() => import('./pages/AnnouncementsPage'));

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

// Временный компонент главной страницы - редирект на ленту или публичный каталог
function HomePage() {
  const { user } = useAppSelector((state) => state.auth);

  if (user) {
    return <Navigate to="/feed" replace />;
  }

  // Для неавторизованных пользователей - редирект на публичный каталог
  return <Navigate to="/catalog" replace />;
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
              
              {/* Публичный маршрут - страница входа через Email */}
              <Route path="/login-email" element={<LoginEmailPage />} />
              
              {/* Публичный маршрут - страница регистрации */}
              <Route path="/register" element={<RegisterPage />} />
              
              {/* Публичный маршрут - страница регистрации через Email */}
              <Route path="/register-email" element={<RegisterEmailPage />} />
              
              {/* Публичный маршрут - подтверждение email */}
              <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
              
              {/* Публичный маршрут - забыли пароль */}
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              
              {/* Публичный маршрут - сброс пароля */}
              <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
              
              {/* Публичный маршрут - каталог для незарегистрированных */}
              <Route path="/catalog" element={<PublicCatalogPage />} />
              
              {/* Публичный маршрут - тестирование интеграции */}
              <Route path="/integration-test" element={<IntegrationTestPage />} />
              
              {/* Публичные страницы Footer */}
              <Route path="/about" element={<AboutPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/advertising-contacts" element={<AdvertisingContactsPage />} />
              
              {/* Главная страница - редирект на профиль или каталог */}
              <Route path="/" element={<HomePage />} />

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

              {/* Страница каталога (защищенная версия с возможностью добавления в списки) */}
              <Route 
                path="/my-catalog" 
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

              {/* Страница конкретного списка */}
              <Route 
                path="/lists/:id" 
                element={
                  <ProtectedRoute>
                    <ListDetailPage />
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

              {/* Страница ленты друзей */}
              <Route 
                path="/feed" 
                element={
                  <ProtectedRoute>
                    <FeedPage />
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

              {/* Страница управления пользователями (только для админа) */}
              <Route 
                path="/admin/users" 
                element={
                  <ProtectedRoute>
                    <UsersManagementPage />
                  </ProtectedRoute>
                } 
              />

              {/* Страница управления объявлениями (только для админа) */}
              <Route 
                path="/admin/announcements" 
                element={
                  <ProtectedRoute>
                    <AnnouncementsPage />
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
