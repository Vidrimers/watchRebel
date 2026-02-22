import React, { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';

// Lazy loading для всех страниц
const LoginPage = lazy(() => import('../pages/LoginPage'));
const UserProfilePage = lazy(() => import('../pages/UserProfilePage'));
const SearchPage = lazy(() => import('../pages/SearchPage'));
const MediaDetailPage = lazy(() => import('../pages/MediaDetailPage'));
const CatalogPage = lazy(() => import('../pages/CatalogPage'));
const ListsPage = lazy(() => import('../pages/ListsPage'));
const WatchlistPage = lazy(() => import('../pages/WatchlistPage'));
const NotificationsPage = lazy(() => import('../pages/NotificationsPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const MessagesPage = lazy(() => import('../pages/MessagesPage'));

/**
 * Конфигурация маршрутов приложения
 * Все маршруты используют lazy loading для оптимизации загрузки
 */
export const routes = [
  {
    path: '/login',
    element: <LoginPage />,
    protected: false,
    title: 'Вход'
  },
  {
    path: '/user/:userId',
    element: <UserProfilePage />,
    protected: true,
    title: 'Профиль пользователя'
  },
  {
    path: '/search',
    element: <SearchPage />,
    protected: true,
    title: 'Поиск'
  },
  {
    path: '/my-catalog',
    element: <CatalogPage />,
    protected: true,
    title: 'Каталог'
  },
  {
    path: '/media/:mediaType/:mediaId',
    element: <MediaDetailPage />,
    protected: true,
    title: 'Детали контента'
  },
  {
    path: '/lists',
    element: <ListsPage />,
    protected: true,
    title: 'Списки'
  },
  {
    path: '/watchlist',
    element: <WatchlistPage />,
    protected: true,
    title: 'Список желаемого'
  },
  {
    path: '/notifications',
    element: <NotificationsPage />,
    protected: true,
    title: 'Уведомления'
  },
  {
    path: '/messages',
    element: <MessagesPage />,
    protected: true,
    title: 'Сообщения'
  },
  {
    path: '/settings',
    element: <SettingsPage />,
    protected: true,
    title: 'Настройки'
  }
];

/**
 * Обертка для защищенных маршрутов
 */
export function wrapRoute(route) {
  if (route.protected) {
    return <ProtectedRoute>{route.element}</ProtectedRoute>;
  }
  return route.element;
}
