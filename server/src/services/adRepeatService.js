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

    // Получаем настройку автоудаления
    const autoDeleteResult = await executeQuery(
      "SELECT value FROM site_settings WHERE key = 'ad_auto_delete'"
    );
    const autoDelete = autoDeleteResult.success && autoDeleteResult.data[0]?.value === '1';

    // Находим посты, которые нужно повторить
    const result = await executeQuery(
      `SELECT * FROM advertising_posts 
       WHERE repeat_count > 0 
       AND repeat_interval_hours > 0 
       AND (last_repeated_at IS NULL OR datetime(last_repeated_at, '+' || repeat_interval_hours || ' hours') <= datetime('now'))`
    );

    if (result.success && result.data.length > 0) {
      for (const post of result.data) {
        const channel = post.repeat_channel || 'site';

        if (channel === 'site' || channel === 'both') {
          await repeatOnSite(post);
        }

        if (channel === 'telegram' || channel === 'both') {
          await repeatOnTelegram(post);
        }

        const newCount = post.repeat_count - 1;
        await executeQuery(
          `UPDATE advertising_posts 
           SET repeat_count = ?, last_repeated_at = datetime('now') 
           WHERE id = ?`,
          [newCount, post.id]
        );

        console.log(`🔄 Повтор рекламного поста ${post.id}, осталось повторов: ${newCount}`);

        // Автоудаление если повторы закончились и включено автоудаление
        if (newCount <= 0 && autoDelete) {
          await deletePost(post);
          console.log(`🗑️ Автоудаление поста ${post.id} (повторы исчерпаны)`);
        }
      }
    }

    // Проверяем посты, у которых повторы уже 0, но pin_duration тоже истёк — автоудаление
    if (autoDelete) {
      const expiredResult = await executeQuery(
        `SELECT * FROM advertising_posts 
         WHERE repeat_count <= 0 
         AND repeat_channel IS NOT NULL AND repeat_channel != ''`
      );

      if (expiredResult.success) {
        for (const post of expiredResult.data) {
          // Проверяем pin_duration
          if (post.pin_duration > 0) {
            const postsSinceAd = await executeQuery(
              `SELECT COUNT(*) as cnt FROM wall_posts WHERE created_at > ?`,
              [post.created_at]
            );
            if (postsSinceAd.success && postsSinceAd.data[0].cnt < post.pin_duration) {
              continue; // pin ещё не истёк
            }
          }
          await deletePost(post);
          console.log(`🗑️ Автоудаление поста ${post.id} (условия выполнены)`);
        }
      }
    }
  } catch (error) {
    console.error('Ошибка AdRepeatService:', error);
  }
}

async function deletePost(post) {
  // Удаляем файлы изображений
  const imageUrls = JSON.parse(post.image_urls || '[]');
  const fs = await import('fs/promises');
  const path = await import('path');
  for (const imageUrl of imageUrls) {
    const filePath = path.join(process.cwd(), imageUrl);
    await fs.unlink(filePath).catch(() => {});
  }
  // Удаляем пост
  await executeQuery('DELETE FROM advertising_posts WHERE id = ?', [post.id]);
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
