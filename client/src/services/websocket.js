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
    return;
  }

  if (isConnecting) {
    return;
  }

  isConnecting = true;
  
  let wsUrl;
  if (import.meta.env.VITE_WS_URL) {
    wsUrl = import.meta.env.VITE_WS_URL;
  } else {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    wsUrl = `${protocol}//${host}/ws`;
  }
  
  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      isConnecting = false;
      ws.send(JSON.stringify({
        type: 'auth',
        token
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        messageHandlers.forEach(handler => handler(data));
      } catch (error) {
        console.error('WebSocket ошибка обработки:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket ошибка:', error);
      isConnecting = false;
    };

    ws.onclose = () => {
      isConnecting = false;
      ws = null;

      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      
      reconnectTimeout = setTimeout(() => {
        connectWebSocket(token);
      }, 3000);
    };
  } catch (error) {
    console.error('WebSocket ошибка создания:', error);
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
