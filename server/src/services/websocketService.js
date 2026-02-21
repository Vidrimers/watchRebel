import { WebSocketServer } from 'ws';
import { executeQuery } from '../database/db.js';

let wss = null;
const clients = new Map(); // userId -> WebSocket connection

/**
 * Инициализация WebSocket сервера
 */
export function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws, req) => {
    console.log('🔌 Новое WebSocket подключение');

    // Ждем аутентификации
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());

        // Аутентификация по токену
        if (data.type === 'auth' && data.token) {
          const userId = await authenticateWebSocket(data.token);
          
          if (userId) {
            ws.userId = userId;
            clients.set(userId, ws);
            ws.send(JSON.stringify({ type: 'auth', success: true, userId }));
            console.log(`✅ WebSocket аутентифицирован: user ${userId}`);
          } else {
            ws.send(JSON.stringify({ type: 'auth', success: false, error: 'Invalid token' }));
            ws.close();
          }
        }
      } catch (error) {
        console.error('❌ Ошибка обработки WebSocket сообщения:', error);
      }
    });

    ws.on('close', () => {
      if (ws.userId) {
        clients.delete(ws.userId);
        console.log(`🔌 WebSocket отключен: user ${ws.userId}`);
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket ошибка:', error);
    });
  });

  console.log('🚀 WebSocket сервер запущен на /ws');
}

/**
 * Аутентификация WebSocket соединения по токену
 */
async function authenticateWebSocket(token) {
  try {
    const result = await executeQuery(
      `SELECT u.id
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = ? AND s.expires_at > datetime('now')`,
      [token]
    );

    if (result.success && result.data.length > 0) {
      return result.data[0].id;
    }
    return null;
  } catch (error) {
    console.error('Ошибка аутентификации WebSocket:', error);
    return null;
  }
}

/**
 * Отправить новое сообщение пользователю через WebSocket
 */
export function sendMessageToUser(userId, message) {
  const ws = clients.get(userId);
  
  if (ws && ws.readyState === 1) { // 1 = OPEN
    ws.send(JSON.stringify({
      type: 'new_message',
      message
    }));
    return true;
  }
  
  return false;
}

/**
 * Отправить уведомление о прочтении сообщения
 */
export function sendReadNotification(userId, conversationId) {
  const ws = clients.get(userId);
  
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({
      type: 'messages_read',
      conversationId
    }));
    return true;
  }
  
  return false;
}

/**
 * Получить количество активных подключений
 */
export function getActiveConnections() {
  return clients.size;
}
