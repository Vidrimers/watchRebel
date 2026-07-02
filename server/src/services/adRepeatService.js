import { executeQuery } from '../database/db.js';
import { sendTelegramNotification } from './notificationService.js';

/**
 * Сервис автоматических повторений рекламных постов
 * Проверяет каждые 10 минут, нужно ли повторить какой-либо пост
 */

let intervalId = null;

export function startAdRepeatService() {
  if (intervalId) return;
  
  console.log('🔄 AdRepeatService запущен');
  intervalId = setInterval(checkAndRepeat, 10 * 60 * 1000); // каждые 10 минут
  checkAndRepeat(); // первая проверка сразу
}

export function stopAdRepeatService() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('🛑 AdRepeatService остановлен');
  }
}

async function checkAndRepeat() {
  try {
    const now = new Date().toISOString();

    // Находим посты, которые нужно повторить
    const result = await executeQuery(
      `SELECT * FROM advertising_posts 
       WHERE repeat_count > 0 
       AND repeat_interval_hours > 0 
       AND (last_repeated_at IS NULL OR datetime(last_repeated_at, '+' || repeat_interval_hours || ' hours') <= datetime('now'))`
    );

    if (!result.success || result.data.length === 0) return;

    for (const post of result.data) {
      const channel = post.repeat_channel || 'site';

      // Повтор на сайте — создаём копию поста
      if (channel === 'site' || channel === 'both') {
        await repeatOnSite(post);
      }

      // Повтор в ТГ — отправляем сообщение
      if (channel === 'telegram' || channel === 'both') {
        await repeatOnTelegram(post);
      }

      // Обновляем счётчик и время
      await executeQuery(
        `UPDATE advertising_posts 
         SET repeat_count = repeat_count - 1, last_repeated_at = datetime('now') 
         WHERE id = ?`,
        [post.id]
      );

      console.log(`🔄 Повтор рекламного поста ${post.id}, осталось повторов: ${post.repeat_count - 1}`);
    }
  } catch (error) {
    console.error('Ошибка AdRepeatService:', error);
  }
}

async function repeatOnSite(post) {
  // Создаём новый пост в advertising_posts (копия)
  const { v4: uuidv4 } = await import('uuid');
  const newId = uuidv4();
  await executeQuery(
    `INSERT INTO advertising_posts (id, content, link_url, link_label, image_urls, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [newId, post.content, post.link_url, post.link_label, post.image_urls, post.created_by]
  );

  // Сохраняем в историю
  await executeQuery(
    `INSERT INTO sent_posts (id, content, image_url, type, channel, sent_to, created_by, created_at)
     VALUES (?, ?, ?, 'advertising', 'site', 0, ?, datetime('now'))`,
    [newId, post.content, post.image_urls ? JSON.parse(post.image_urls)[0] || null : null, post.created_by]
  );
}

async function repeatOnTelegram(post) {
  const publicUrl = process.env.PUBLIC_URL || 'http://localhost:1313';
  const imageUrl = post.image_urls ? JSON.parse(post.image_urls)[0] : null;
  const fullImageUrl = imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `${publicUrl}${imageUrl}`) : null;

  const { executeQuery: eq } = await import('../database/db.js');
  const usersResult = await eq('SELECT id FROM users WHERE is_blocked = 0');

  if (!usersResult.success) return;

  let successCount = 0;
  for (const user of usersResult.data) {
    try {
      const { checkNotificationEnabled } = await import('./notificationService.js');
      const isEnabled = await checkNotificationEnabled(user.id, 'admin_announcement');
      if (!isEnabled) continue;

      const header = '📣 *Реклама*';
      const fullMessage = `${header}\n\n${post.content}`;

      if (fullImageUrl) {
        await sendTelegramNotification(user.id, fullMessage, {
          parse_mode: 'MarkdownV2',
          photo: fullImageUrl
        });
      } else {
        const { notifyModeration } = await import('./notificationService.js');
        await notifyModeration(user.id, 'announcement', { content: fullMessage });
      }
      successCount++;
    } catch (err) {
      console.error(`Ошибка отправки пользователю ${user.id}:`, err);
    }
  }

  // Сохраняем в историю
  const { v4: uuidv4 } = await import('uuid');
  await executeQuery(
    `INSERT INTO sent_posts (id, content, image_url, type, channel, sent_to, created_by, created_at)
     VALUES (?, ?, ?, 'advertising', 'telegram', ?, ?, datetime('now'))`,
    [uuidv4(), post.content, fullImageUrl, successCount, post.created_by]
  );
}
