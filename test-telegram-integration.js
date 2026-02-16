/**
 * Тестовый скрипт для проверки интеграции Telegram Bot с Backend
 * 
 * Этот скрипт тестирует:
 * 1. Отправку уведомлений о реакциях
 * 2. Отправку уведомлений о действиях друзей
 */

import dotenv from 'dotenv';
import { executeQuery } from './server/src/database/db.js';
import { notifyReaction, notifyFriendActivity } from './server/src/services/notificationService.js';

dotenv.config();

const ADMIN_ID = process.env.TELEGRAM_ADMIN_ID;

console.log('🧪 Начинаем тестирование интеграции Telegram Bot с Backend\n');

/**
 * Тест 1: Отправка уведомления о реакции
 */
async function testReactionNotification() {
  console.log('📝 Тест 1: Уведомление о реакции');
  console.log('─────────────────────────────────');

  try {
    // Проверяем, есть ли админ в базе
    const adminCheck = await executeQuery(
      'SELECT * FROM users WHERE id = ?',
      [ADMIN_ID]
    );

    if (!adminCheck.success || adminCheck.data.length === 0) {
      console.log('⚠️  Админ не найден в базе данных');
      console.log('   Создаем тестового пользователя...\n');
      
      // Создаем тестового пользователя
      await executeQuery(
        `INSERT OR IGNORE INTO users (id, telegram_username, display_name, avatar_url, is_admin)
         VALUES (?, ?, ?, ?, ?)`,
        [ADMIN_ID, 'admin', 'Администратор', null, 1]
      );
    }

    // Отправляем тестовое уведомление о реакции
    console.log(`📤 Отправляем уведомление о реакции админу (ID: ${ADMIN_ID})...`);
    
    const result = await notifyReaction(
      ADMIN_ID,           // Владелец поста
      ADMIN_ID,           // Кто поставил реакцию (для теста - тот же пользователь)
      '❤️',               // Эмоджи
      'test-post-id'      // ID поста
    );

    if (result.success) {
      console.log('✅ Уведомление о реакции успешно отправлено!');
      console.log(`   Notification ID: ${result.notification.id}`);
      console.log(`   Содержание: ${result.notification.content}\n`);
    } else {
      console.log('❌ Ошибка отправки уведомления о реакции:', result.error, '\n');
    }

    return result.success;
  } catch (error) {
    console.error('❌ Ошибка в тесте уведомления о реакции:', error.message, '\n');
    return false;
  }
}

/**
 * Тест 2: Отправка уведомления о действии друга
 */
async function testFriendActivityNotification() {
  console.log('📝 Тест 2: Уведомление о действии друга');
  console.log('─────────────────────────────────────────');

  try {
    // Создаем связь "друзья" для теста (админ сам себе друг для теста)
    await executeQuery(
      `INSERT OR IGNORE INTO friends (id, user_id, friend_id)
       VALUES (?, ?, ?)`,
      ['test-friend-id', ADMIN_ID, ADMIN_ID]
    );

    console.log(`📤 Отправляем уведомление о действии друга админу (ID: ${ADMIN_ID})...`);

    const result = await notifyFriendActivity(
      ADMIN_ID,           // ID друга, который совершил действие
      'added_to_list',    // Тип действия
      {
        tmdbId: 550,
        mediaType: 'movie',
        title: 'Бойцовский клуб'
      }
    );

    if (result.success) {
      console.log('✅ Уведомления о действии друга успешно отправлены!');
      console.log(`   Отправлено уведомлений: ${result.notificationsSent}`);
      console.log(`   Результаты:`, result.results, '\n');
    } else {
      console.log('❌ Ошибка отправки уведомлений о действии друга:', result.error, '\n');
    }

    return result.success;
  } catch (error) {
    console.error('❌ Ошибка в тесте уведомления о действии друга:', error.message, '\n');
    return false;
  }
}

/**
 * Тест 3: Проверка создания уведомлений в базе данных
 */
async function testNotificationsInDatabase() {
  console.log('📝 Тест 3: Проверка уведомлений в базе данных');
  console.log('──────────────────────────────────────────────');

  try {
    const result = await executeQuery(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`,
      [ADMIN_ID]
    );

    if (result.success && result.data.length > 0) {
      console.log(`✅ Найдено ${result.data.length} уведомлений в базе данных:`);
      
      result.data.forEach((notif, index) => {
        console.log(`\n   ${index + 1}. ${notif.type}`);
        console.log(`      Содержание: ${notif.content}`);
        console.log(`      Прочитано: ${notif.is_read ? 'Да' : 'Нет'}`);
        console.log(`      Создано: ${notif.created_at}`);
      });
      console.log('');
      return true;
    } else {
      console.log('⚠️  Уведомления не найдены в базе данных\n');
      return false;
    }
  } catch (error) {
    console.error('❌ Ошибка проверки уведомлений в базе данных:', error.message, '\n');
    return false;
  }
}

/**
 * Очистка тестовых данных
 */
async function cleanup() {
  console.log('🧹 Очистка тестовых данных...');
  
  try {
    // Удаляем тестовые уведомления
    await executeQuery(
      `DELETE FROM notifications WHERE user_id = ? AND (content LIKE '%тест%' OR related_post_id = 'test-post-id')`,
      [ADMIN_ID]
    );

    // Удаляем тестовую связь друзей
    await executeQuery(
      `DELETE FROM friends WHERE id = 'test-friend-id'`,
      []
    );

    console.log('✅ Тестовые данные очищены\n');
  } catch (error) {
    console.error('❌ Ошибка очистки тестовых данных:', error.message, '\n');
  }
}

/**
 * Запуск всех тестов
 */
async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ТЕСТИРОВАНИЕ ИНТЕГРАЦИИ TELEGRAM BOT С BACKEND');
  console.log('═══════════════════════════════════════════════════════════\n');

  const results = {
    reactionNotification: false,
    friendActivityNotification: false,
    databaseCheck: false
  };

  // Тест 1: Уведомление о реакции
  results.reactionNotification = await testReactionNotification();
  
  // Небольшая задержка между тестами
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Тест 2: Уведомление о действии друга
  results.friendActivityNotification = await testFriendActivityNotification();
  
  // Небольшая задержка
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Тест 3: Проверка базы данных
  results.databaseCheck = await testNotificationsInDatabase();

  // Очистка
  await cleanup();

  // Итоги
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Уведомление о реакции:        ${results.reactionNotification ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Уведомление о действии друга: ${results.friendActivityNotification ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Проверка базы данных:         ${results.databaseCheck ? '✅ PASSED' : '❌ FAILED'}`);

  const allPassed = Object.values(results).every(r => r === true);
  
  console.log('\n───────────────────────────────────────────────────────────');
  if (allPassed) {
    console.log('🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!');
  } else {
    console.log('⚠️  НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОШЛИ');
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  process.exit(allPassed ? 0 : 1);
}

// Запускаем тесты
runTests().catch(error => {
  console.error('❌ Критическая ошибка при выполнении тестов:', error);
  process.exit(1);
});
