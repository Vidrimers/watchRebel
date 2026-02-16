import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createSession } from './sessionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загрузка переменных окружения из корневой директории
dotenv.config({ path: path.join(__dirname, '../../.env') });

const token = process.env.TELEGRAM_BOT_TOKEN;
const publicUrl = process.env.PUBLIC_URL || 'http://localhost:1313';
const webhookUrl = process.env.WEBHOOK_URL;
const isProduction = process.env.NODE_ENV === 'production';

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN не найден в .env файле');
  process.exit(1);
}

// Создание бота с polling для development, webhook для production
// Но не запускаем автоматически если это тестовая среда
const bot = process.env.NODE_ENV === 'test' 
  ? null 
  : new TelegramBot(token, { 
      polling: !isProduction,
      webHook: false // Webhook настраивается отдельно через setWebhook
    });

if (bot) {
  console.log('🤖 Telegram бот запущен в режиме:', isProduction ? 'production (webhook)' : 'development (polling)');
  
  // В production режиме настраиваем webhook
  if (isProduction && webhookUrl) {
    setupWebhook();
  }
}

/**
 * Настройка команд бота и меню
 */
async function setupCommands() {
  if (!bot) return;
  
  try {
    // Устанавливаем список команд
    await bot.setMyCommands([
      { command: 'start', description: '🚀 Начать работу' },
      { command: 'menu', description: '📱 Главное меню' },
      { command: 'help', description: '❓ Справка' }
    ]);

    // Настраиваем кнопку меню
    await bot.setChatMenuButton({
      menu_button: { type: 'commands' }
    });

    console.log('✅ Команды бота настроены');
  } catch (error) {
    console.error('❌ Ошибка настройки команд:', error.message);
  }
}

/**
 * Настройка webhook для production
 */
async function setupWebhook() {
  if (!bot || !webhookUrl) return;
  
  try {
    const fullWebhookUrl = `${webhookUrl}/webhook/${token}`;
    await bot.setWebHook(fullWebhookUrl);
    console.log('✅ Webhook настроен:', fullWebhookUrl);
  } catch (error) {
    console.error('❌ Ошибка настройки webhook:', error.message);
  }
}

/**
 * Команда /start - создание сессии и отправка ссылки
 */
if (bot) {
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const username = msg.from.username || msg.from.first_name;

    try {
      console.log(`📥 Команда /start от пользователя ${username} (ID: ${userId})`);

      // Создаем сессию
      const session = await createSession(userId, msg.from);
      
      // Формируем ссылку на сайт с токеном
      const webAppUrl = `${publicUrl}?session=${session.token}`;
      
      // Отправляем приветственное сообщение с кнопкой
      await bot.sendMessage(
        chatId,
        `🎬 <b>Добро пожаловать в watchRebel!</b>\n\n` +
        `Привет, ${username}! 👋\n\n` +
        `watchRebel - это социальная сеть для любителей кино, где ты можешь:\n` +
        `• 📝 Вести списки просмотренных фильмов и сериалов\n` +
        `• ⭐ Оценивать контент от 1 до 10\n` +
        `• 💬 Делиться отзывами на своей стене\n` +
        `• 👥 Следить за активностью друзей\n` +
        `• 🔔 Получать уведомления о новинках\n\n` +
        `Нажми на кнопку ниже, чтобы начать!`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '🌐 Открыть watchRebel', url: webAppUrl }
            ]]
          }
        }
      );

      console.log(`✅ Сессия создана для пользователя ${username}`);
    } catch (error) {
      console.error('Ошибка обработки /start:', error.message);
      await bot.sendMessage(
        chatId,
        '⚠️ Произошла ошибка при создании сессии. Попробуйте позже.'
      );
    }
  });
}

/**
 * Команда /menu - отображение главного меню
 */
bot.onText(/\/menu/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const username = msg.from.username || msg.from.first_name;

  try {
    console.log(`📥 Команда /menu от пользователя ${username}`);

    // Формируем кнопки меню
    const menuButtons = [
      [
        { text: '🎬 Мои фильмы', callback_data: 'menu_movies' },
        { text: '📺 Мои сериалы', callback_data: 'menu_tv' }
      ],
      [
        { text: '⭐ Список желаемого', callback_data: 'menu_watchlist' },
        { text: '🔔 Уведомления', callback_data: 'menu_notifications' }
      ],
      [
        { text: '👤 Мой профиль', callback_data: 'menu_profile' },
        { text: '⚙️ Настройки', callback_data: 'menu_settings' }
      ]
    ];

    // Добавляем кнопку сайта если не localhost
    if (!publicUrl.includes('localhost')) {
      // Создаем сессию для автоматической авторизации
      const session = await createSession(userId, msg.from);
      const webAppUrl = `${publicUrl}?session=${session.token}`;
      
      menuButtons.push([
        { text: '🌐 Открыть сайт', url: webAppUrl }
      ]);
    }

    await bot.sendMessage(
      chatId,
      '<b>📱 Главное меню</b>\n\nВыберите действие:',
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: menuButtons }
      }
    );
  } catch (error) {
    console.error('Ошибка обработки /menu:', error.message);
    await bot.sendMessage(
      chatId,
      '⚠️ Произошла ошибка. Попробуйте позже.'
    );
  }
});

/**
 * Команда /help - справка
 */
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;

  await bot.sendMessage(
    chatId,
    '<b>❓ Справка по командам</b>\n\n' +
    '/start - Начать работу с ботом\n' +
    '/menu - Открыть главное меню\n' +
    '/help - Показать эту справку\n\n' +
    '<b>Возможности watchRebel:</b>\n' +
    '• Создавайте списки фильмов и сериалов\n' +
    '• Оценивайте просмотренное\n' +
    '• Делитесь отзывами\n' +
    '• Следите за друзьями\n' +
    '• Получайте уведомления\n\n' +
    'Используйте /menu для быстрого доступа к функциям.',
    { parse_mode: 'HTML' }
  );
});

/**
 * Обработчик callback кнопок
 */
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const userId = query.from.id.toString();

  try {
    // Отвечаем на callback чтобы убрать "часики"
    await bot.answerCallbackQuery(query.id);

    console.log(`📥 Callback: ${data} от пользователя ${userId}`);

    // Обрабатываем различные действия меню
    if (data.startsWith('menu_')) {
      await handleMenuAction(chatId, userId, data, query.from);
    }
  } catch (error) {
    console.error('Ошибка обработки callback:', error.message);
    await bot.sendMessage(
      chatId,
      '⚠️ Произошла ошибка. Попробуйте позже.'
    );
  }
});

/**
 * Обработка действий меню
 * @param {number} chatId - ID чата
 * @param {string} userId - ID пользователя
 * @param {string} action - Действие (menu_movies, menu_tv и т.д.)
 * @param {Object} userFrom - Объект пользователя из Telegram
 */
async function handleMenuAction(chatId, userId, action, userFrom) {
  // Создаем сессию для автоматической авторизации
  const session = await createSession(userId, userFrom);
  
  const actionMap = {
    'menu_movies': {
      text: '🎬 <b>Мои фильмы</b>\n\nЗдесь будут отображаться ваши списки фильмов.\nОткройте сайт для полного функционала.',
      button: { text: '🌐 Открыть на сайте', url: `${publicUrl}/lists/movies?session=${session.token}` }
    },
    'menu_tv': {
      text: '📺 <b>Мои сериалы</b>\n\nЗдесь будут отображаться ваши списки сериалов.\nОткройте сайт для полного функционала.',
      button: { text: '🌐 Открыть на сайте', url: `${publicUrl}/lists/tv?session=${session.token}` }
    },
    'menu_watchlist': {
      text: '⭐ <b>Список желаемого</b>\n\nЗдесь будут фильмы и сериалы, которые вы хотите посмотреть.\nОткройте сайт для полного функционала.',
      button: { text: '🌐 Открыть на сайте', url: `${publicUrl}/watchlist?session=${session.token}` }
    },
    'menu_notifications': {
      text: '🔔 <b>Уведомления</b>\n\nЗдесь будут уведомления о действиях ваших друзей.\nОткройте сайт для полного функционала.',
      button: { text: '🌐 Открыть на сайте', url: `${publicUrl}/notifications?session=${session.token}` }
    },
    'menu_profile': {
      text: '👤 <b>Мой профиль</b>\n\nОткройте сайт чтобы увидеть свой профиль и стену.',
      button: { text: '🌐 Открыть профиль', url: `${publicUrl}/profile?session=${session.token}` }
    },
    'menu_settings': {
      text: '⚙️ <b>Настройки</b>\n\nОткройте сайт для настройки темы и других параметров.',
      button: { text: '🌐 Открыть настройки', url: `${publicUrl}/settings?session=${session.token}` }
    }
  };

  const actionData = actionMap[action];
  if (actionData) {
    await bot.sendMessage(
      chatId,
      actionData.text,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[actionData.button]]
        }
      }
    );
  }
}

/**
 * Отправка уведомления пользователю
 * @param {string} userId - Telegram ID пользователя
 * @param {string} message - Текст уведомления
 * @param {Object} options - Дополнительные опции (кнопки, parse_mode и т.д.)
 */
export async function sendNotification(userId, message, options = {}) {
  try {
    console.log(`📤 Отправка уведомления пользователю ${userId}`);
    
    await bot.sendMessage(userId, message, {
      parse_mode: 'HTML',
      ...options
    });

    console.log(`✅ Уведомление отправлено пользователю ${userId}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Ошибка отправки уведомления пользователю ${userId}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Обработка webhook для production
 * @param {Object} update - Объект обновления от Telegram
 */
export async function handleWebhook(update) {
  try {
    console.log('📥 Получен webhook update');

    // Обрабатываем сообщения
    if (update.message) {
      const text = update.message.text;
      
      if (text && text.startsWith('/')) {
        // Обрабатываем команды
        const command = text.split(' ')[0];
        
        if (command === '/start') {
          bot.emit('text', update.message);
        } else if (command === '/menu') {
          bot.emit('text', update.message);
        } else if (command === '/help') {
          bot.emit('text', update.message);
        }
      }
      
      bot.processUpdate(update);
    }
    
    // Обрабатываем callback кнопки
    if (update.callback_query) {
      bot.processUpdate(update);
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка обработки webhook:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Установка webhook для production
 * @param {string} webhookUrl - URL для webhook
 */
export async function setWebhook(webhookUrl) {
  try {
    await bot.setWebHook(`${webhookUrl}/webhook/${token}`);
    console.log(`✅ Webhook установлен: ${webhookUrl}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка установки webhook:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Удаление webhook
 */
export async function deleteWebhook() {
  try {
    await bot.deleteWebHook();
    console.log('✅ Webhook удален');
    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка удаления webhook:', error.message);
    return { success: false, error: error.message };
  }
}

// Обработка ошибок polling
bot.on('polling_error', (error) => {
  console.error('❌ Ошибка polling:', error.message);
});

// Обработка ошибок webhook
bot.on('webhook_error', (error) => {
  console.error('❌ Ошибка webhook:', error.message);
});

// Настройка команд при запуске
setupCommands();

// Экспортируем бот и функции
export default bot;
export { bot, createSession, handleMenuAction };

