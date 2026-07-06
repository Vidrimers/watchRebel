import { executeQuery } from '../database/db.js';
import { notifyFeedNewAdPost, notifyFeedNewAnnouncement } from './websocketService.js';

let intervalId = null;

export function startSchedulerService() {
  if (intervalId) return;
  console.log('⏰ SchedulerService запущен');
  intervalId = setInterval(checkScheduledPosts, 60 * 1000);
  checkScheduledPosts();
}

export function stopSchedulerService() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('🛑 SchedulerService остановлен');
  }
}

async function checkScheduledPosts() {
  try {
    const now = new Date().toISOString();

    // Рекламные посты — публикуем (ставим scheduled_at = NULL)
    const adResult = await executeQuery(
      `SELECT * FROM advertising_posts WHERE scheduled_at IS NOT NULL AND scheduled_at <= ?`,
      [now]
    );
    if (adResult.success && adResult.data.length > 0) {
      for (const post of adResult.data) {
        await executeQuery(
          `UPDATE advertising_posts SET scheduled_at = NULL WHERE id = ?`,
          [post.id]
        );
        console.log(`📢 Опубликован отложенный рекламный пост ${post.id}`);

        // Отправляем WebSocket уведомление
        const adPost = {
          id: post.id,
          userId: post.created_by,
          postType: 'advertising',
          content: post.content,
          linkUrl: post.link_url,
          linkLabel: post.link_label,
          imageUrls: post.image_urls ? JSON.parse(post.image_urls) : [],
          createdAt: new Date().toISOString(),
          author: { id: post.created_by },
          pinDuration: post.pin_duration,
          repeatCount: post.repeat_count,
          repeatIntervalHours: post.repeat_interval_hours,
          autoDelete: post.auto_delete
        };
        notifyFeedNewAdPost(adPost);
      }
    }

    // Объявления — публикуем
    const annResult = await executeQuery(
      `SELECT * FROM announcements WHERE scheduled_at IS NOT NULL AND scheduled_at <= ?`,
      [now]
    );
    if (annResult.success && annResult.data.length > 0) {
      for (const post of annResult.data) {
        await executeQuery(
          `UPDATE announcements SET scheduled_at = NULL WHERE id = ?`,
          [post.id]
        );
        console.log(`📢 Опубликовано отложенный объявление ${post.id}`);

        // Отправляем WebSocket уведомление
        notifyFeedNewAnnouncement({
          id: post.id,
          content: post.content,
          imageUrls: post.image_url ? [post.image_url] : [],
          createdAt: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error('Ошибка SchedulerService:', error);
  }
}
