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
  console.log(`📤 Попытка отправить сообщение через WebSocket пользователю ${userId}`);
  console.log(`📊 Активных подключений: ${clients.size}`);
  console.log(`📋 Подключенные пользователи:`, Array.from(clients.keys()));
  
  const ws = clients.get(userId);
  
  if (!ws) {
    console.log(`❌ WebSocket соединение не найдено для пользователя ${userId}`);
    return false;
  }
  
  if (ws.readyState !== 1) {
    console.log(`❌ WebSocket не в состоянии OPEN для пользователя ${userId}, состояние: ${ws.readyState}`);
    return false;
  }
  
  ws.send(JSON.stringify({
    type: 'new_message',
    message
  }));
  
  console.log(`✅ Сообщение отправлено через WebSocket пользователю ${userId}`);
  return true;
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

/**
 * Отправить уведомление о новом посте в ленте друзьям пользователя
 */
export async function notifyFeedNewPost(authorId, post) {
  try {
    // Получаем список друзей автора поста
    const friendsResult = await executeQuery(
      `SELECT DISTINCT 
        CASE 
          WHEN user_id = ? THEN friend_id 
          ELSE user_id 
        END as friend_id
       FROM friends 
       WHERE user_id = ? OR friend_id = ?`,
      [authorId, authorId, authorId]
    );

    if (!friendsResult.success) {
      console.error('Ошибка получения списка друзей для уведомления о посте');
      return;
    }

    const friends = friendsResult.data;
    console.log(`📢 Отправка уведомления о новом посте ${friends.length} друзьям`);

    // Отправляем уведомление каждому другу
    friends.forEach(friend => {
      const ws = clients.get(friend.friend_id);
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'feed_new_post',
          post
        }));
        console.log(`✅ Уведомление о посте отправлено пользователю ${friend.friend_id}`);
      }
    });
  } catch (error) {
    console.error('Ошибка отправки уведомления о новом посте:', error);
  }
}

/**
 * Отправить уведомление об обновлении поста (лайк, комментарий)
 */
export async function notifyFeedPostUpdate(postId, updateType, data) {
  try {
    // Получаем информацию о посте и его авторе
    const postResult = await executeQuery(
      `SELECT user_id, wall_owner_id FROM wall_posts WHERE id = ?`,
      [postId]
    );

    if (!postResult.success || postResult.data.length === 0) {
      return;
    }

    const post = postResult.data[0];
    
    // Получаем список друзей автора и владельца стены
    const friendsResult = await executeQuery(
      `SELECT DISTINCT 
        CASE 
          WHEN user_id IN (?, ?) THEN friend_id 
          ELSE user_id 
        END as friend_id
       FROM friends 
       WHERE user_id IN (?, ?) OR friend_id IN (?, ?)`,
      [post.user_id, post.wall_owner_id, post.user_id, post.wall_owner_id, post.user_id, post.wall_owner_id]
    );

    if (!friendsResult.success) {
      return;
    }

    const friends = friendsResult.data;

    // Отправляем уведомление каждому другу
    friends.forEach(friend => {
      const ws = clients.get(friend.friend_id);
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'feed_post_update',
          postId,
          updateType, // 'reaction' | 'comment'
          data
        }));
      }
    });
  } catch (error) {
    console.error('Ошибка отправки уведомления об обновлении поста:', error);
  }
}
