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

// Система состояний пользователей для отслеживания процессов (например, смена имени)
const userStates = new Map();

/**
 * Установить состояние пользователя
 * @param {string} userId - ID пользователя
 * @param {string} state - Состояние (например, 'awaiting_name_change')
 * @param {Object} data - Дополнительные данные состояния
 */
function setUserState(userId, state, data = {}) {
  userStates.set(userId, { state, data, timestamp: Date.now() });
  console.log(`📝 Установлено состояние для пользователя ${userId}: ${state}`);
}

/**
 * Получить состояние пользователя
 * @param {string} userId - ID пользователя
 * @returns {Object|null} Объект состояния или null
 */
function getUserState(userId) {
  return userStates.get(userId) || null;
}

/**
 * Очистить состояние пользователя
 * @param {string} userId - ID пользователя
 */
function clearUserState(userId) {
  userStates.delete(userId);
  console.log(`🗑️ Очищено состояние пользователя ${userId}`);
}

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
  bot.onText(/\/start(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const username = msg.from.username || msg.from.first_name;
    const startParam = match[1].trim(); // Получаем параметр после /start

    try {
      console.log(`📥 Команда /start от пользователя ${username} (ID: ${userId})`);

      // Проверяем, есть ли реферальный код
      let referralCode = null;
      if (startParam && startParam.startsWith('ref_')) {
        referralCode = startParam.substring(4); // Убираем префикс "ref_"
        console.log(`🔗 Обнаружен реферальный код: ${referralCode}`);
      }

      // Создаем сессию с реферальным кодом
      const session = await createSession(userId, msg.from, referralCode);
      
      // Формируем ссылку на сайт с токеном и данными пользователя
      const webAppUrl = `${publicUrl}/login?token=${session.token}&userId=${userId}&username=${encodeURIComponent(username)}&displayName=${encodeURIComponent(msg.from.first_name || username)}&avatarUrl=${encodeURIComponent(msg.from.photo_url || '')}`;
      
      // Отправляем приветственное сообщение с кнопкой
      let welcomeMessage = `🎬 <b>Добро пожаловать в watchRebel!</b>\n\n` +
        `Привет, ${username}! 👋\n\n`;

      // Если регистрация по реферальной ссылке
      if (referralCode && session.referralUsed) {
        welcomeMessage += `✨ Вы зарегистрировались по приглашению друга!\n` +
          `Вы автоматически добавлены в друзья. 🤝\n\n`;
      }

      welcomeMessage += `watchRebel - это социальная сеть для любителей кино и сериалов, где ты можешь:\n` +
        `• 📝 Вести списки просмотренных фильмов и сериалов\n` +
        `• ⭐ Оценивать контент от 1 до 10\n` +
        `• 💬 Делиться отзывами на своей стене\n` +
        `• 👥 Следить за активностью друзей\n` +
        `• 🔔 Получать уведомления о новинках\n\n` +
        `Нажми на кнопку ниже, чтобы начать!`;

      await bot.sendMessage(
        chatId,
        welcomeMessage,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '🌐 Открыть watchRebel', url: webAppUrl }
            ]]
          }
        }
      );

      console.log(`✅ Сессия создана для пользователя ${username}${referralCode ? ' (с реферальным кодом)' : ''}`);
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
        { text: '⭐ Хочу посмотреть', callback_data: 'menu_watchlist' },
        { text: '📰 Лента', callback_data: 'menu_feed' }
      ],
      [
        { text: '💬 Сообщения', callback_data: 'menu_messages' },
        { text: '🔔 Уведомления', callback_data: 'menu_notifications' }
      ],
      [
        { text: '👤 Мой профиль', callback_data: 'menu_profile' }
      ],
      [
        { text: '👥 Пригласить друга', callback_data: 'menu_invite' }
      ],
      [
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
 * Команда /cancel - отмена текущего действия
 */
bot.onText(/\/cancel/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();

  const userState = getUserState(userId);
  if (userState) {
    clearUserState(userId);
    await bot.sendMessage(
      chatId,
      '❌ Действие отменено.',
      { parse_mode: 'HTML' }
    );
  } else {
    await bot.sendMessage(
      chatId,
      'ℹ️ Нет активных действий для отмены.',
      { parse_mode: 'HTML' }
    );
  }
});

/**
 * Обработчик текстовых сообщений (не команд)
 */
bot.on('message', async (msg) => {
  // Игнорируем команды (они обрабатываются отдельно)
  if (msg.text && msg.text.startsWith('/')) {
    return;
  }

  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const userState = getUserState(userId);

  // Если пользователь в состоянии ожидания нового имени
  if (userState && userState.state === 'awaiting_name_change') {
    await handleNameChange(chatId, userId, msg.text, userState.data.userFrom);
  }
  // Если пользователь в состоянии ожидания нового статуса
  else if (userState && userState.state === 'awaiting_status_change') {
    await handleStatusChange(chatId, userId, msg.text, userState.data.userFrom);
  }
  // Если пользователь в состоянии ожидания ответа на сообщение
  else if (userState && userState.state === 'awaiting_message_reply') {
    await handleSendMessageReply(chatId, userId, msg.text, userState.data);
  }
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
    } else if (data.startsWith('settings_')) {
      await handleSettingsAction(chatId, userId, data, query.from);
    } else if (data.startsWith('reply_message_')) {
      // Обработка кнопки "Ответить" на сообщение
      const receiverId = data.replace('reply_message_', '');
      await handleReplyMessageAction(chatId, userId, receiverId, query.from);
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
 * Обработка действия "Лента"
 * @param {number} chatId - ID чата
 * @param {string} userId - ID пользователя
 * @param {string} token - Токен сессии для авторизации
 */
async function handleFeedAction(chatId, userId, token) {
  try {
    // Получаем ленту активности через API
    const apiUrl = process.env.API_URL || 'http://localhost:1313';
    const response = await fetch(`${apiUrl}/api/feed/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`API вернул ошибку: ${response.status}`);
    }

    const feed = await response.json();

    // Если лента пуста
    if (feed.length === 0) {
      await bot.sendMessage(
        chatId,
        '📰 <b>Лента активности</b>\n\n' +
        'Пока нет постов от ваших друзей.\n\n' +
        'Добавьте друзей, чтобы видеть их активность!',
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Форматируем посты
    let feedText = '📰 <b>Лента активности</b>\n\n';
    feedText += `Последние ${feed.length} постов от ваших друзей:\n\n`;

    feed.forEach((post, index) => {
      // Форматируем дату
      const date = new Date(post.createdAt);
      const formattedDate = formatDate(date);

      // Обрезаем длинные посты до 100 символов
      let content = post.content || '';
      if (content.length > 100) {
        content = content.substring(0, 100) + '...';
      }

      // Добавляем пост в текст
      feedText += `${index + 1}. <b>${post.author.displayName}</b>\n`;
      feedText += `   ${formattedDate}\n`;
      feedText += `   ${content}\n\n`;
    });

    // Добавляем кнопку "Открыть на сайте"
    const session = await createSession(userId, { id: userId });
    const webAppUrl = `${publicUrl}?session=${session.token}`;

    await bot.sendMessage(
      chatId,
      feedText,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '🌐 Открыть на сайте', url: webAppUrl }
          ]]
        }
      }
    );

    console.log(`✅ Лента отправлена пользователю ${userId}`);
  } catch (error) {
    console.error('❌ Ошибка получения ленты:', error.message);
    
    await bot.sendMessage(
      chatId,
      '⚠️ Произошла ошибка при загрузке ленты. Попробуйте позже.',
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * Форматирование даты для отображения
 * @param {Date} date - Дата для форматирования
 * @returns {string} Отформатированная дата
 */
function formatDate(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'только что';
  } else if (diffMins < 60) {
    return `${diffMins} мин. назад`;
  } else if (diffHours < 24) {
    return `${diffHours} ч. назад`;
  } else if (diffDays < 7) {
    return `${diffDays} дн. назад`;
  } else {
    // Форматируем как "ДД.ММ.ГГГГ"
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }
}

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
      text: '⭐ <b>Хочу посмотреть</b>\n\nЗдесь будут фильмы и сериалы, которые вы хотите посмотреть.\nОткройте сайт для полного функционала.',
      button: { text: '🌐 Открыть на сайте', url: `${publicUrl}/watchlist?session=${session.token}` }
    },
    'menu_feed': {
      text: '📰 <b>Лента активности</b>\n\nЗагружаю последние посты ваших друзей...',
      handler: async () => {
        await handleFeedAction(chatId, userId, session.token);
      }
    },
    'menu_messages': {
      text: '💬 <b>Сообщения</b>\n\nЗагружаю ваши диалоги...',
      handler: async () => {
        await handleMessagesAction(chatId, userId, session.token);
      }
    },
    'menu_notifications': {
      text: '🔔 <b>Уведомления</b>\n\nЗдесь будут уведомления о действиях ваших друзей.\nОткройте сайт для полного функционала.',
      button: { text: '🌐 Открыть на сайте', url: `${publicUrl}/notifications?session=${session.token}` }
    },
    'menu_profile': {
      text: '👤 <b>Мой профиль</b>\n\nОткройте сайт чтобы увидеть свой профиль и стену.',
      button: { text: '🌐 Открыть профиль', url: `${publicUrl}/profile?session=${session.token}` }
    },
    'menu_invite': {
      text: '👥 <b>Пригласить друга</b>\n\nГенерирую вашу реферальную ссылку...',
      handler: async () => {
        await handleInviteAction(chatId, userId, session.token);
      }
    },
    'menu_settings': {
      text: '⚙️ <b>Настройки</b>\n\nВыберите действие:',
      buttons: [
        [{ text: '✏️ Сменить имя', callback_data: 'settings_change_name' }],
        [{ text: '💬 Изменить статус', callback_data: 'settings_change_status' }],
        [{ text: '🌐 Открыть настройки на сайте', url: `${publicUrl}/settings?session=${session.token}` }]
      ]
    }
  };

  const actionData = actionMap[action];
  if (actionData) {
    // Если есть специальный обработчик, вызываем его
    if (actionData.handler) {
      await actionData.handler();
      return;
    }

    // Формируем inline_keyboard в зависимости от структуры данных
    let inlineKeyboard;
    if (actionData.buttons) {
      // Если есть массив кнопок (для настроек)
      inlineKeyboard = actionData.buttons;
    } else if (actionData.button) {
      // Если одна кнопка (для остальных пунктов меню)
      inlineKeyboard = [[actionData.button]];
    }

    await bot.sendMessage(
      chatId,
      actionData.text,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      }
    );
  }
}

/**
 * Обработка действия "Пригласить друга"
 * @param {number} chatId - ID чата
 * @param {string} userId - ID пользователя
 * @param {string} token - Токен сессии для авторизации
 */
async function handleInviteAction(chatId, userId, token) {
  try {
    console.log(`📝 Запрос реферальной ссылки для пользователя ${userId}`);
    
    // Получаем реферальный код через API
    const apiUrl = process.env.API_URL || 'http://localhost:1313';
    const url = `${apiUrl}/api/users/${userId}/referral-code`;
    console.log(`📡 Отправка запроса к: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`📥 Ответ API: статус ${response.status}`);

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`❌ API ошибка ${response.status}:`, errorData);
      throw new Error(`API вернул ошибку: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Получены данные:`, data);
    
    const { referralCode, referralsCount } = data;

    // Формируем реферальную ссылку
    const botUsername = (await bot.getMe()).username;
    const referralLink = `https://t.me/${botUsername}?start=ref_${referralCode}`;

    // Формируем текст сообщения
    let messageText = '👥 <b>Пригласить друга</b>\n\n';
    messageText += `Ваша реферальная ссылка:\n<code>${referralLink}</code>\n\n`;
    messageText += `📊 Приглашено друзей: <b>${referralsCount}</b>\n\n`;
    messageText += 'Когда друг зарегистрируется по вашей ссылке:\n';
    messageText += '• Вы автоматически станете друзьями\n';
    messageText += '• Оба получите уведомление\n';
    messageText += '• Сможете видеть активность друг друга\n\n';
    messageText += 'Поделитесь ссылкой с друзьями!';

    // Отправляем сообщение с кнопкой "Поделиться"
    await bot.sendMessage(
      chatId,
      messageText,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { 
              text: '📤 Поделиться ссылкой', 
              url: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('Присоединяйся к watchRebel - социальной сети для любителей кино! 🎬')}` 
            }
          ]]
        }
      }
    );

    console.log(`✅ Реферальная ссылка отправлена пользователю ${userId}`);
  } catch (error) {
    console.error('❌ Ошибка получения реферальной ссылки:', error.message);
    
    await bot.sendMessage(
      chatId,
      '⚠️ Произошла ошибка при генерации реферальной ссылки. Попробуйте позже.',
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * Обработка действия "Сообщения"
 * @param {number} chatId - ID чата
 * @param {string} userId - ID пользователя
 * @param {string} token - Токен сессии для авторизации
 */
async function handleMessagesAction(chatId, userId, token) {
  try {
    console.log(`📝 Запрос диалогов для пользователя ${userId}`);
    
    // Получаем список диалогов через API
    const apiUrl = process.env.API_URL || 'http://localhost:1313';
    const url = `${apiUrl}/api/messages/conversations`;
    console.log(`📡 Отправка запроса к: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`📥 Ответ API: статус ${response.status}`);

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`❌ API ошибка ${response.status}:`, errorData);
      throw new Error(`API вернул ошибку: ${response.status}`);
    }

    const conversations = await response.json();
    console.log(`✅ Получено диалогов: ${conversations.length}`);

    // Если нет диалогов
    if (conversations.length === 0) {
      await bot.sendMessage(
        chatId,
        '💬 <b>Сообщения</b>\n\n' +
        'У вас пока нет диалогов.\n\n' +
        'Найдите пользователя на сайте и отправьте ему сообщение!',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '🌐 Открыть сайт', url: `${publicUrl}/messages?session=${token}` }
            ]]
          }
        }
      );
      return;
    }

    // Фильтруем только диалоги с непрочитанными сообщениями
    const unreadConversations = conversations.filter(c => c.unreadCount > 0);

    if (unreadConversations.length === 0) {
      // Если нет непрочитанных, показываем все диалоги
      let messageText = '💬 <b>Сообщения</b>\n\n';
      messageText += `У вас ${conversations.length} диалог(ов), но нет новых сообщений.\n\n`;
      messageText += '<b>Последние диалоги:</b>\n\n';

      // Показываем первые 5 диалогов
      const displayConversations = conversations.slice(0, 5);
      displayConversations.forEach((conv, index) => {
        const lastMessage = conv.lastMessage ? 
          (conv.lastMessage.length > 30 ? conv.lastMessage.substring(0, 30) + '...' : conv.lastMessage) : 
          'Нет сообщений';
        
        messageText += `${index + 1}. <b>${conv.otherUser.displayName}</b>\n`;
        messageText += `   ${lastMessage}\n\n`;
      });

      await bot.sendMessage(
        chatId,
        messageText,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '🌐 Открыть все сообщения', url: `${publicUrl}/messages?session=${token}` }
            ]]
          }
        }
      );
      return;
    }

    // Формируем сообщение с непрочитанными диалогами
    let messageText = '💬 <b>Новые сообщения</b>\n\n';
    messageText += `У вас ${unreadConversations.length} диалог(ов) с новыми сообщениями:\n\n`;

    // Формируем инлайн-кнопки для каждого диалога
    const inlineButtons = [];

    unreadConversations.forEach((conv, index) => {
      const lastMessage = conv.lastMessage ? 
        (conv.lastMessage.length > 50 ? conv.lastMessage.substring(0, 50) + '...' : conv.lastMessage) : 
        'Нет сообщений';
      
      messageText += `${index + 1}. <b>${conv.otherUser.displayName}</b> (${conv.unreadCount} нов.)\n`;
      messageText += `   ${lastMessage}\n\n`;

      // Добавляем кнопки для каждого диалога
      inlineButtons.push([
        { 
          text: `💬 Ответить ${conv.otherUser.displayName}`, 
          callback_data: `reply_message_${conv.otherUser.id}` 
        }
      ]);
    });

    // Добавляем кнопку "Открыть на сайте"
    inlineButtons.push([
      { text: '🌐 Открыть все сообщения', url: `${publicUrl}/messages?session=${token}` }
    ]);

    await bot.sendMessage(
      chatId,
      messageText,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: inlineButtons
        }
      }
    );

    console.log(`✅ Список сообщений отправлен пользователю ${userId}`);
  } catch (error) {
    console.error('❌ Ошибка получения сообщений:', error.message);
    
    await bot.sendMessage(
      chatId,
      '⚠️ Произошла ошибка при загрузке сообщений. Попробуйте позже.',
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * Обработка действия "Ответить на сообщение"
 * @param {number} chatId - ID чата
 * @param {string} userId - ID пользователя
 * @param {string} receiverId - ID получателя сообщения
 * @param {Object} userFrom - Объект пользователя из Telegram
 */
async function handleReplyMessageAction(chatId, userId, receiverId, userFrom) {
  try {
    console.log(`📝 Пользователь ${userId} хочет ответить пользователю ${receiverId}`);
    
    // Получаем информацию о получателе
    const session = await createSession(userId, userFrom);
    const apiUrl = process.env.API_URL || 'http://localhost:1313';
    
    const response = await fetch(`${apiUrl}/api/users/${receiverId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.token}`
      }
    });

    if (!response.ok) {
      throw new Error(`API вернул ошибку: ${response.status}`);
    }

    const receiverData = await response.json();
    
    // Устанавливаем состояние ожидания ответа
    setUserState(userId, 'awaiting_message_reply', { 
      chatId, 
      userFrom, 
      receiverId,
      receiverName: receiverData.displayName 
    });
    
    await bot.sendMessage(
      chatId,
      `💬 <b>Ответ для ${receiverData.displayName}</b>\n\n` +
      'Отправьте текст сообщения.\n\n' +
      'Для отмены отправьте /cancel',
      { parse_mode: 'HTML' }
    );

    console.log(`✅ Состояние установлено для пользователя ${userId}`);
  } catch (error) {
    console.error('❌ Ошибка обработки ответа на сообщение:', error.message);
    
    await bot.sendMessage(
      chatId,
      '⚠️ Произошла ошибка. Попробуйте позже.',
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * Обработка действий настроек
 * @param {number} chatId - ID чата
 * @param {string} userId - ID пользователя
 * @param {string} action - Действие (settings_change_name и т.д.)
 * @param {Object} userFrom - Объект пользователя из Telegram
 */
async function handleSettingsAction(chatId, userId, action, userFrom) {
  if (action === 'settings_change_name') {
    // Устанавливаем состояние ожидания нового имени
    setUserState(userId, 'awaiting_name_change', { chatId, userFrom });
    
    await bot.sendMessage(
      chatId,
      '✏️ <b>Смена имени</b>\n\n' +
      'Отправьте новое имя (от 2 до 50 символов).\n\n' +
      'Для отмены отправьте /cancel',
      { parse_mode: 'HTML' }
    );
  } else if (action === 'settings_change_status') {
    // Устанавливаем состояние ожидания нового статуса
    setUserState(userId, 'awaiting_status_change', { chatId, userFrom });
    
    await bot.sendMessage(
      chatId,
      '💬 <b>Изменение статуса</b>\n\n' +
      'Отправьте новый статус (до 100 символов).\n' +
      'Чтобы удалить статус, отправьте пустое сообщение или точку.\n\n' +
      'Для отмены отправьте /cancel',
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * Обработка смены имени пользователя
 * @param {number} chatId - ID чата
 * @param {string} userId - ID пользователя
 * @param {string} newName - Новое имя
 * @param {Object} userFrom - Объект пользователя из Telegram
 */
async function handleNameChange(chatId, userId, newName, userFrom) {
  try {
    // Валидация имени
    if (!newName || newName.trim().length < 2) {
      await bot.sendMessage(
        chatId,
        '⚠️ Имя слишком короткое. Минимум 2 символа.\n\nПопробуйте еще раз или отправьте /cancel для отмены.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    if (newName.trim().length > 50) {
      await bot.sendMessage(
        chatId,
        '⚠️ Имя слишком длинное. Максимум 50 символов.\n\nПопробуйте еще раз или отправьте /cancel для отмены.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Очищаем имя от лишних пробелов
    const trimmedName = newName.trim();

    // Отправляем запрос на обновление имени через API
    console.log(`📝 Обновление имени для пользователя ${userId}: "${trimmedName}"`);

    // Создаем сессию для авторизации запроса
    const session = await createSession(userId, userFrom);
    
    // Отправляем PUT запрос к API
    const apiUrl = process.env.API_URL || 'http://localhost:1313';
    const response = await fetch(`${apiUrl}/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`
      },
      body: JSON.stringify({
        displayName: trimmedName
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`❌ API ошибка ${response.status}:`, errorData);
      throw new Error(`API вернул ошибку: ${response.status}`);
    }
    
    const responseData = await response.json();
    console.log('✅ API ответ:', responseData);

    // Очищаем состояние пользователя
    clearUserState(userId);

    // Отправляем подтверждение
    await bot.sendMessage(
      chatId,
      `✅ <b>Имя успешно изменено!</b>\n\nВаше новое имя: <b>${trimmedName}</b>`,
      { parse_mode: 'HTML' }
    );

    console.log(`✅ Имя пользователя ${userId} обновлено на "${trimmedName}"`);
  } catch (error) {
    console.error('❌ Ошибка обновления имени:', error.message);
    
    // Очищаем состояние пользователя
    clearUserState(userId);
    
    await bot.sendMessage(
      chatId,
      '⚠️ Произошла ошибка при обновлении имени. Попробуйте позже или обратитесь к администратору.',
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * Обработка смены статуса пользователя
 * @param {number} chatId - ID чата
 * @param {string} userId - ID пользователя
 * @param {string} newStatus - Новый статус
 * @param {Object} userFrom - Объект пользователя из Telegram
 */
async function handleStatusChange(chatId, userId, newStatus, userFrom) {
  try {
    // Валидация статуса
    if (newStatus && newStatus.trim().length > 100) {
      await bot.sendMessage(
        chatId,
        '⚠️ Статус слишком длинный. Максимум 100 символов.\n\nПопробуйте еще раз или отправьте /cancel для отмены.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Очищаем статус от лишних пробелов
    // Если статус пустой или точка - удаляем статус (null)
    const trimmedStatus = newStatus.trim();
    const finalStatus = (trimmedStatus === '' || trimmedStatus === '.') ? '' : trimmedStatus;

    // Отправляем запрос на обновление статуса через API
    console.log(`💬 Обновление статуса для пользователя ${userId}: "${finalStatus}"`);

    // Создаем сессию для авторизации запроса
    const session = await createSession(userId, userFrom);
    
    // Отправляем PUT запрос к API
    const apiUrl = process.env.API_URL || 'http://localhost:1313';
    const response = await fetch(`${apiUrl}/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`
      },
      body: JSON.stringify({
        userStatus: finalStatus
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`❌ API ошибка ${response.status}:`, errorData);
      throw new Error(`API вернул ошибку: ${response.status}`);
    }
    
    const responseData = await response.json();
    console.log('✅ API ответ:', responseData);

    // Очищаем состояние пользователя
    clearUserState(userId);

    // Отправляем подтверждение
    if (finalStatus === '') {
      await bot.sendMessage(
        chatId,
        `✅ <b>Статус удален!</b>`,
        { parse_mode: 'HTML' }
      );
    } else {
      await bot.sendMessage(
        chatId,
        `✅ <b>Статус успешно изменен!</b>\n\nВаш новый статус: <i>${finalStatus}</i>`,
        { parse_mode: 'HTML' }
      );
    }

    console.log(`✅ Статус пользователя ${userId} обновлен на "${finalStatus}"`);
  } catch (error) {
    console.error('❌ Ошибка обновления статуса:', error.message);
    
    // Очищаем состояние пользователя
    clearUserState(userId);
    
    await bot.sendMessage(
      chatId,
      '⚠️ Произошла ошибка при обновлении статуса. Попробуйте позже или обратитесь к администратору.',
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * Обработка отправки ответа на сообщение
 * @param {number} chatId - ID чата
 * @param {string} userId - ID пользователя (отправителя)
 * @param {string} messageText - Текст сообщения
 * @param {Object} stateData - Данные состояния (receiverId, receiverName, userFrom)
 */
async function handleSendMessageReply(chatId, userId, messageText, stateData) {
  try {
    // Валидация сообщения
    if (!messageText || messageText.trim().length === 0) {
      await bot.sendMessage(
        chatId,
        '⚠️ Сообщение не может быть пустым.\n\nПопробуйте еще раз или отправьте /cancel для отмены.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    if (messageText.trim().length > 1000) {
      await bot.sendMessage(
        chatId,
        '⚠️ Сообщение слишком длинное. Максимум 1000 символов.\n\nПопробуйте еще раз или отправьте /cancel для отмены.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    console.log(`📝 Отправка сообщения от ${userId} к ${stateData.receiverId}`);

    // Создаем сессию для авторизации запроса
    const session = await createSession(userId, stateData.userFrom);
    
    // Отправляем POST запрос к API
    const apiUrl = process.env.API_URL || 'http://localhost:1313';
    const response = await fetch(`${apiUrl}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`
      },
      body: JSON.stringify({
        receiverId: stateData.receiverId,
        content: messageText.trim(),
        sentViaBot: true
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`❌ API ошибка ${response.status}:`, errorData);
      throw new Error(`API вернул ошибку: ${response.status}`);
    }
    
    const responseData = await response.json();
    console.log('✅ API ответ:', responseData);

    // Очищаем состояние пользователя
    clearUserState(userId);

    // Отправляем подтверждение
    await bot.sendMessage(
      chatId,
      `✅ <b>Сообщение отправлено!</b>\n\n` +
      `Получатель: <b>${stateData.receiverName}</b>\n\n` +
      `Ваше сообщение:\n${messageText.trim()}`,
      { parse_mode: 'HTML' }
    );

    console.log(`✅ Сообщение от ${userId} к ${stateData.receiverId} отправлено`);
  } catch (error) {
    console.error('❌ Ошибка отправки сообщения:', error.message);
    
    // Очищаем состояние пользователя
    clearUserState(userId);
    
    await bot.sendMessage(
      chatId,
      '⚠️ Произошла ошибка при отправке сообщения. Попробуйте позже или обратитесь к администратору.',
      { parse_mode: 'HTML' }
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

