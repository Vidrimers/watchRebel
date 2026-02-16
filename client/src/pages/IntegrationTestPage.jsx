import React, { useState } from 'react';
import api from '../services/api';
import styles from './IntegrationTestPage.module.css';

/**
 * Страница для тестирования интеграции Frontend и Backend
 * Проверяет все основные API endpoints
 */
const IntegrationTestPage = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const addResult = (endpoint, status, message, data = null) => {
    setResults(prev => [...prev, {
      endpoint,
      status,
      message,
      data,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const clearResults = () => {
    setResults([]);
  };

  // Тест 1: Health check
  const testHealthCheck = async () => {
    try {
      const response = await api.get('/health');
      addResult('GET /api/health', 'success', 'Сервер работает', response.data);
    } catch (error) {
      addResult('GET /api/health', 'error', error.message);
    }
  };

  // Тест 2: Auth - получение сессии (без токена)
  const testAuthSession = async () => {
    try {
      const response = await api.get('/auth/session');
      addResult('GET /api/auth/session', 'success', 'Сессия получена', response.data);
    } catch (error) {
      addResult('GET /api/auth/session', 'error', error.message);
    }
  };

  // Тест 3: Media - поиск
  const testMediaSearch = async () => {
    try {
      const response = await api.get('/media/search', {
        params: { query: 'Матрица', type: 'movie' }
      });
      addResult('GET /api/media/search', 'success', `Найдено ${response.data.results?.length || 0} результатов`, response.data);
    } catch (error) {
      addResult('GET /api/media/search', 'error', error.message);
    }
  };

  // Тест 4: Lists - получение списков (требует авторизации)
  const testGetLists = async () => {
    try {
      const response = await api.get('/lists');
      addResult('GET /api/lists', 'success', `Получено ${response.data.length || 0} списков`, response.data);
    } catch (error) {
      addResult('GET /api/lists', 'error', error.message);
    }
  };

  // Тест 5: Watchlist - получение (требует авторизации)
  const testGetWatchlist = async () => {
    try {
      const response = await api.get('/watchlist');
      addResult('GET /api/watchlist', 'success', `Получено ${response.data.length || 0} элементов`, response.data);
    } catch (error) {
      addResult('GET /api/watchlist', 'error', error.message);
    }
  };

  // Тест 6: Users - поиск пользователей
  const testSearchUsers = async () => {
    try {
      const response = await api.get('/users/search', {
        params: { query: 'test' }
      });
      addResult('GET /api/users/search', 'success', `Найдено ${response.data.length || 0} пользователей`, response.data);
    } catch (error) {
      addResult('GET /api/users/search', 'error', error.message);
    }
  };

  // Тест 7: Notifications - получение (требует авторизации)
  const testGetNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      addResult('GET /api/notifications', 'success', `Получено ${response.data.length || 0} уведомлений`, response.data);
    } catch (error) {
      addResult('GET /api/notifications', 'error', error.message);
    }
  };

  // Тест 8: CORS - проверка заголовков
  const testCORS = async () => {
    try {
      const response = await fetch('http://localhost:1313/api/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      addResult('CORS Test', 'success', 'CORS настроен правильно', data);
    } catch (error) {
      addResult('CORS Test', 'error', error.message);
    }
  };

  // Запуск всех тестов
  const runAllTests = async () => {
    setLoading(true);
    clearResults();
    
    await testHealthCheck();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testCORS();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testMediaSearch();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testAuthSession();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testGetLists();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testGetWatchlist();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testSearchUsers();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testGetNotifications();
    
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>🔧 Тестирование интеграции Frontend ↔ Backend</h1>
        <p>Проверка всех основных API endpoints</p>
      </div>

      <div className={styles.controls}>
        <button 
          onClick={runAllTests} 
          disabled={loading}
          className={styles.btnPrimary}
        >
          {loading ? '⏳ Тестирование...' : '▶️ Запустить все тесты'}
        </button>
        <button 
          onClick={clearResults}
          className={styles.btnSecondary}
        >
          🗑️ Очистить результаты
        </button>
      </div>

      <div className={styles.individualTests}>
        <h3>Индивидуальные тесты:</h3>
        <div className={styles.testButtons}>
          <button onClick={testHealthCheck}>Health Check</button>
          <button onClick={testCORS}>CORS Test</button>
          <button onClick={testMediaSearch}>Media Search</button>
          <button onClick={testAuthSession}>Auth Session</button>
          <button onClick={testGetLists}>Get Lists</button>
          <button onClick={testGetWatchlist}>Get Watchlist</button>
          <button onClick={testSearchUsers}>Search Users</button>
          <button onClick={testGetNotifications}>Get Notifications</button>
        </div>
      </div>

      <div className={styles.results}>
        <h3>Результаты тестов ({results.length}):</h3>
        {results.length === 0 ? (
          <p className={styles.noResults}>Нет результатов. Запустите тесты.</p>
        ) : (
          <div className={styles.resultsList}>
            {results.map((result, index) => (
              <div 
                key={index} 
                className={`${styles.resultItem} ${styles[result.status]}`}
              >
                <div className={styles.resultHeader}>
                  <span className={styles.endpoint}>{result.endpoint}</span>
                  <span className={styles.timestamp}>{result.timestamp}</span>
                  <span className={styles.status}>
                    {result.status === 'success' ? '✅' : '❌'}
                  </span>
                </div>
                <div className={styles.resultMessage}>{result.message}</div>
                {result.data && (
                  <details className={styles.resultData}>
                    <summary>Данные ответа</summary>
                    <pre>{JSON.stringify(result.data, null, 2)}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.info}>
        <h3>ℹ️ Информация:</h3>
        <ul>
          <li>✅ Зеленые тесты - успешно выполнены</li>
          <li>❌ Красные тесты - ошибка (это нормально для endpoints, требующих авторизации)</li>
          <li>🔒 Endpoints с замком требуют авторизации через Telegram</li>
          <li>🌐 CORS тест проверяет настройку cross-origin запросов</li>
        </ul>
      </div>
    </div>
  );
};

export default IntegrationTestPage;
