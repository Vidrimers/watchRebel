/**
 * WebSocket клиент для реалтайм сообщений
 */

let ws = null;
let reconnectTimeout = null;
let messageHandlers = [];
let isConnecting = false;

/**
 * Подключение к WebSocket серверу
 */
export function connectWebSocket(token) {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    console.log('WebSocket уже подключен или подключается');
    return;
  }

  if (isConnecting) {
    console.log('WebSocket подключение уже в процессе');
    return;
  }

  isConnecting = true;
  
  // Определяем протокол автоматически (ws для http, wss для https)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const wsUrl = import.meta.env.VITE_WS_URL || `${protocol}//${host}/ws`;
  
  console.log('🔌 Подключение к WebSocket:', wsUrl);
  
  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('✅ WebSocket подключен');
      isConnecting = false;
      
      // Отправляем токен для аутентификации
      ws.send(JSON.stringify({
        type: 'auth',
        token
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 WebSocket сообщение:', data);

        // Вызываем все зарегистрированные обработчики
        messageHandlers.forEach(handler => handler(data));
      } catch (error) {
        console.error('❌ Ошибка обработки WebSocket сообщения:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket ошибка:', error);
      isConnecting = false;
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket отключен');
      isConnecting = false;
      ws = null;

      // Переподключение через 3 секунды
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      
      reconnectTimeout = setTimeout(() => {
        console.log('🔄 Переподключение к WebSocket...');
        connectWebSocket(token);
      }, 3000);
    };
  } catch (error) {
    console.error('❌ Ошибка создания WebSocket:', error);
    isConnecting = false;
  }
}

/**
 * Отключение от WebSocket сервера
 */
export function disconnectWebSocket() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (ws) {
    ws.close();
    ws = null;
  }

  messageHandlers = [];
  console.log('🔌 WebSocket отключен вручную');
}

/**
 * Добавить обработчик сообщений
 */
export function addMessageHandler(handler) {
  if (typeof handler === 'function') {
    messageHandlers.push(handler);
  }
}

/**
 * Удалить обработчик сообщений
 */
export function removeMessageHandler(handler) {
  messageHandlers = messageHandlers.filter(h => h !== handler);
}

/**
 * Проверка состояния подключения
 */
export function isConnected() {
  return ws && ws.readyState === WebSocket.OPEN;
}
