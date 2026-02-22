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
    // Логирование исходящего запроса
    console.log('[API] Исходящий запрос:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`,
      params: config.params,
      data: config.data,
      headers: config.headers
    });

    // Получаем токен из localStorage
    const token = localStorage.getItem('authToken');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('[API] Токен добавлен к запросу');
    } else {
      console.log('[API] Токен отсутствует');
    }
    
    return config;
  },
  (error) => {
    console.error('[API] Ошибка при подготовке запроса:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - обрабатываем ответы и ошибки
apiClient.interceptors.response.use(
  (response) => {
    // Логирование успешного ответа
    console.log('[API] Успешный ответ:', {
      status: response.status,
      statusText: response.statusText,
      url: response.config.url,
      method: response.config.method?.toUpperCase(),
      dataType: typeof response.data,
      isArray: Array.isArray(response.data),
      dataLength: Array.isArray(response.data) ? response.data.length : 'не массив',
      data: response.data
    });

    // Успешный ответ - возвращаем данные
    return response;
  },
  (error) => {
    // Обработка ошибок
    if (error.response) {
      // Сервер ответил с кодом ошибки (4xx, 5xx)
      const { status, data } = error.response;
      const message = data?.message || data?.error || 'Произошла ошибка на сервере';
      
      console.error('[API] Ошибка от сервера:', {
        status,
        statusText: error.response.statusText,
        url: error.config?.url,
        method: error.config?.method?.toUpperCase(),
        message,
        data
      });
      
      // Если 401 - токен невалиден, очищаем localStorage
      if (status === 401) {
        console.warn('[API] 401 Unauthorized - очищаем токен и редиректим на логин');
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        // Можно добавить редирект на страницу логина
        window.location.href = '/login';
      }
      
      throw new APIError(message, status, data);
    } else if (error.request) {
      // Запрос был отправлен, но ответа не получено (проблемы с сетью)
      console.error('[API] Ошибка сети - ответ не получен:', {
        request: error.request,
        message: error.message
      });
      throw new NetworkError('Не удалось подключиться к серверу. Проверьте интернет-соединение.');
    } else {
      // Ошибка при настройке запроса
      console.error('[API] Ошибка настройки запроса:', error);
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
  },

  // PUT запрос с FormData (для загрузки файлов)
  putFormData: async (url, formData, config = {}) => {
    try {
      const response = await apiClient.put(url, formData, {
        ...config,
        headers: {
          ...config.headers,
          'Content-Type': 'multipart/form-data'
        }
      });
      return response;
    } catch (error) {
      throw error;
    }
  }
};

export default api;
