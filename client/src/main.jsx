import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store';
import App from './App.jsx';
import { loadIconSprite } from './utils/loadIconSprite';
import './index.css';

/**
 * Точка входа в React приложение
 * 
 * Инициализирует:
 * - React StrictMode для выявления потенциальных проблем
 * - Redux Provider для глобального состояния
 * - Главный компонент App
 * - Загрузка SVG sprite для иконок
 */

// Загружаем SVG sprite перед рендером
loadIconSprite();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);
