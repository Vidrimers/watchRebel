import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store';
import App from './App.jsx';
import './index.css';

/**
 * Точка входа в React приложение
 * 
 * Инициализирует:
 * - React StrictMode для выявления потенциальных проблем
 * - Redux Provider для глобального состояния
 * - Главный компонент App
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);
