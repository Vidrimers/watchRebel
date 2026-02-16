import axios from 'axios';

// Кастомные классы ошибок
export class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

export class NetworkError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NetworkError';
  }
}

// Создаем экземпляр axios с базовой конфигурацией
const apiClient = axios.create({
  baseURL: '/api', // Vite proxy перенаправит на http://localhost:1313/api
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - добавляем токен к каждому запросу
apiClient.interceptors.request.use(
  (config) => {
    // Получаем токен из localStorage
    const token = localStorage.getItem('authToken');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - обрабатываем ошибки
apiClient.interceptors.response.use(
  (response) => {
    // Успешный ответ - возвращаем данные
    return response;
  },
  (error) => {
    // Обработка ошибок
    if (error.response) {
      // Сервер ответил с кодом ошибки (4xx, 5xx)
      const { status, data } = error.response;
      const message = data?.message || data?.error || 'Произошла ошибка на сервере';
      
      // Если 401 - токен невалиден, очищаем localStorage
      if (status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        // Можно добавить редирект на страницу логина
        window.location.href = '/login';
      }
      
      throw new APIError(message, status, data);
    } else if (error.request) {
      // Запрос был отправлен, но ответа не получено (проблемы с сетью)
      throw new NetworkError('Не удалось подключиться к серверу. Проверьте интернет-соединение.');
    } else {
      // Ошибка при настройке запроса
      throw new NetworkError(error.message || 'Произошла неизвестная ошибка');
    }
  }
);

// Экспортируем API методы
const api = {
  // GET запрос
  get: async (url, config = {}) => {
    try {
      const response = await apiClient.get(url, config);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // POST запрос
  post: async (url, data = {}, config = {}) => {
    try {
      const response = await apiClient.post(url, data, config);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // PUT запрос
  put: async (url, data = {}, config = {}) => {
    try {
      const response = await apiClient.put(url, data, config);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // DELETE запрос
  delete: async (url, config = {}) => {
    try {
      const response = await apiClient.delete(url, config);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // PATCH запрос (может пригодиться)
  patch: async (url, data = {}, config = {}) => {
    try {
      const response = await apiClient.patch(url, data, config);
      return response;
    } catch (error) {
      throw error;
    }
  }
};

export default api;
