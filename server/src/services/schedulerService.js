import { executeQuery } from '../database/db.js';

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
      `SELECT id, content FROM advertising_posts WHERE scheduled_at IS NOT NULL AND scheduled_at <= ?`,
      [now]
    );
    if (adResult.success && adResult.data.length > 0) {
      for (const post of adResult.data) {
        await executeQuery(
          `UPDATE advertising_posts SET scheduled_at = NULL WHERE id = ?`,
          [post.id]
        );
        console.log(`📢 Опубликован отложенный рекламный пост ${post.id}`);
      }
    }

    // Объявления — публикуем
    const annResult = await executeQuery(
      `SELECT id, content FROM announcements WHERE scheduled_at IS NOT NULL AND scheduled_at <= ?`,
      [now]
    );
    if (annResult.success && annResult.data.length > 0) {
      for (const post of annResult.data) {
        await executeQuery(
          `UPDATE announcements SET scheduled_at = NULL WHERE id = ?`,
          [post.id]
        );
        console.log(`📢 Опубликовано отложенный объявление ${post.id}`);
      }
    }
  } catch (error) {
    console.error('Ошибка SchedulerService:', error);
  }
}
