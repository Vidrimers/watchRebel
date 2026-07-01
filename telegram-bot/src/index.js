import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createSession } from './sessionService.js';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загрузка переменных окружения из корневой директории
const isProd = process.env.NODE_ENV === 'production';
const envFile = isProd ? '.env.production' : '.env';
dotenv.config({ path: path.join(__dirname, '../../', envFile) });

const token = process.env.TELEGRAM_BOT_TOKEN;
const publicUrl = process.env.PUBLIC_URL || 'http://localhost:1313';
const webhookUrl = process.env.WEBHOOK_URL;
const isProduction = process.env.NODE_ENV === 'production';

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN не найден в .env файле');
  process.exit(1);
}

// Создание бота с polling
// Но не запускаем автоматически если это тестовая среда
const bot = process.env.NODE_ENV === 'test' 
  ? null 
  : new TelegramBot(token, { 
      polling: true,
      webHook: false
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
        { text: '💬 Сообщения', callback_data: 'menu_messages' }
      ],
      [
        { text: '👤 Мой профиль', callback_data: 'menu_profile' }
      ],
      [
        { text: '👥 Пригласить друга', callback_data: 'menu_invite' }
      ],
      [
        { text: '🐛 Багрепорты и предложения', callback_data: 'menu_bug_report' }
      ],
      [
        { text: '⚙️ Настройки', callback_data: 'menu_settings' }
      ],
      [
        { text: '🔔 Настройки уведомлений', callback_data: 'settings_notifications' }
      ]
    ];

    // Добавляем кнопку сайта если не localhost
    if (!publicUrl.includes('localhost')) {
      // Создаем сессию для автоматической авторизации
      const session = await createSession(userId, msg.from);
      const webAppUrl = `${publicUrl}/login?session=${session.token}`;
      
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
  // Если пользователь в состоянии ожидания ответа в групповой чат
  else if (userState && userState.state === 'awaiting_group_message_reply') {
    await handleSendGroupMessageReply(chatId, userId, msg.text, userState.data);
  }
  // Если пользователь в состоянии создания текстового поста
  else if (userState && userState.state === 'awaiting_text_post') {
    await handleSendTextPost(chatId, userId, msg.text, userState.data.userFrom);
  }
  // Если пользователь загружает изображение для поста
  else if (userState && userState.state === 'awaiting_post_image') {
    await handlePostImage(chatId, userId, msg.photo, userState.data);
  }
  // Если пользователь в состоянии создания багрепорта - ожидание заголовка
  else if (userState && userState.state === 'awaiting_bug_report_title') {
    await handleBugReportTitle(chatId, userId, msg.text, userState.data);
  }
  // Если пользователь в состоянии создания багрепорта - ожидание описания
  else if (userState && userState.state === 'awaiting_bug_report_description') {
    await handleBugReportDescription(chatId, userId, msg.text, userState.data);
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
    if (data === 'show_menu') {
      // Показываем главное меню
      await bot.sendMessage(
        chatId,
        '<b>📱 Главное меню</b>\n\nВыберите действие:',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
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
                { text: '🐛 Багрепорты и предложения', callback_data: 'menu_bug_report' }
              ],
              [
                { text: '⚙️ Настройки', callback_data: 'menu_settings' }
              ]
            ]
          }
        }
      );
    } else if (data.startsWith('menu_')) {
      await handleMenuAction(chatId, userId, data, query.from);
    } else if (data.startsWith('settings_')) {
      if (data === 'settings_theme') {
        await handleSettingsTheme(chatId, userId, query.from);
      } else if (data === 'settings_privacy') {
        await handleSettingsPrivacy(chatId, userId, query.from);
      } else {
        await handleSettingsAction(chatId, userId, data, query.from, query.message.message_id);
      }
    } else if (data === 'create_text_post') {
      await handleCreateTextPost(chatId, userId, query.from);
    } else if (data === 'create_photo_post') {
      setUserState(userId, 'awaiting_post_image', {
        userFrom: query.from,
        content: '',
        images: []
      });
      await bot.sendMessage(chatId, '📸 <b>Фото-пост</b>\n\nОтправьте изображение (можно несколько), затем нажмите "✅ Опубликовать".', {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Опубликовать', callback_data: 'post_publish' }]
          ]
        }
      });
    } else if (data === 'post_skip_image') {
      const skipState = getUserState(userId);
      if (skipState && skipState.state === 'awaiting_post_image') {
        await publishPost(chatId, userId, skipState.data.content, null, skipState.data.userFrom);
      }
    } else if (data === 'post_publish') {
      const pubState = getUserState(userId);
      if (pubState && pubState.state === 'awaiting_post_image') {
        const images = pubState.data.images || [];
        await publishPost(chatId, userId, pubState.data.content, images.length > 0 ? images : null, pubState.data.userFrom);
      }
    } else if (data.startsWith('toggle_notif_')) {
      await handleToggleNotification(chatId, userId, data, query.from, query.message.message_id);
    } else if (data.startsWith('set_theme_')) {
      const themeName = data.replace('set_theme_', '');
      await handleSetTheme(chatId, userId, themeName, query.from);
    } else if (data.startsWith('set_privacy_')) {
      const privacyValue = data.replace('set_privacy_', '');
      await handleSetPrivacy(chatId, userId, privacyValue, query.from);
    } else if (data.startsWith('reply_group_')) {
      // Обработка кнопки "Ответить" в групповом чате
      const conversationId = data.replace('reply_group_', '');
      await handleReplyGroupMessageAction(chatId, userId, conversationId, query.from);
    } else if (data.startsWith('reply_message_')) {
      // Обработка кнопки "Ответить" на сообщение (личный чат)
      const receiverId = data.replace('reply_message_', '');
      await handleReplyMessageAction(chatId, userId, receiverId, query.from);
    } else if (data.startsWith('bug_report_')) {
      // Обработка действий багрепорта
      await handleBugReportAction(chatId, userId, data, query.from);
    } else if (data.startsWith('list_')) {
      // Просмотр фильмов в списке: list_{listId}_{page}
      const parts = data.replace('list_', '').split('_');
      const listId = parts[0];
      const page = parseInt(parts[1]) || 0;
      await handleListItemsAction(chatId, userId, listId, page);
    } else if (data.startsWith('wl_page_')) {
      // Пагинация watchlist: wl_page_{type}_{page}
      const parts = data.replace('wl_page_', '').split('_');
      const wlType = parts[0];
      const page = parseInt(parts[1]) || 0;
      const session = await createSession(userId, query.from);
      await handleWatchlistAction(chatId, userId, session.token, page, wlType);
    } else if (data.startsWith('wl_type_')) {
      // Выбор типа в watchlist: wl_type_{type}_{page}
      const parts = data.replace('wl_type_', '').split('_');
      const wlType = parts[0];
      const page = parseInt(parts[1]) || 0;
      const session = await createSession(userId, query.from);
      await handleWatchlistAction(chatId, userId, session.token, page, wlType);
    } else if (data.startsWith('share_movie_')) {
      // Поделиться фильмом: share_movie_{tmdbId}
      const tmdbId = data.replace('share_movie_', '');
      await handleShareMovieAction(chatId, tmdbId);
    } else if (data.startsWith('feed_page_')) {
      // Пагинация ленты: feed_page_{page}
      const feedPage = parseInt(data.replace('feed_page_', '')) || 0;
      const feedSession = await createSession(userId, query.from);
      await handleFeedAction(chatId, userId, feedSession.token, feedPage);
    } else if (data.startsWith('msg_page_')) {
      // Пагинация сообщений: msg_page_{page}
      const msgPage = parseInt(data.replace('msg_page_', '')) || 0;
      const msgSession = await createSession(userId, query.from);
      await handleMessagesAction(chatId, userId, msgSession.token, msgPage);
    } else if (data === 'main_menu') {
      // Возврат в главное меню
      await showMainMenu(chatId, query.from);
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
async function handleFeedAction(chatId, userId, token, page = 0) {
  try {
    const apiUrl = process.env.LOCAL_API_URL || process.env.API_URL || 'http://localhost:1313';
    const limit = 5;
    const offset = page * limit;

    const response = await fetch(`${apiUrl}/api/feed/${userId}?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error(`API: ${response.status}`);
    const data = await response.json();
    const posts = data.posts || [];
    const hasMore = data.hasMore;

    if (!posts || posts.length === 0) {
      await bot.sendMessage(
        chatId,
        '📰 <b>Лента активности</b>\n\nПока нет постов от ваших друзей.\nДобавьте друзей, чтобы видеть их активность!',
        { parse_mode: 'HTML' }
      );
      return;
    }

    let feedText = `📰 <b>Лента активности</b> (стр. ${page + 1}):\n\n`;

    for (const post of posts) {
      const author = post.author?.displayName || 'Неизвестный';
      const date = formatDate(new Date(post.createdAt));
      let content = post.content || '';
      if (content.length > 150) content = content.substring(0, 150) + '...';

      // Название фильма/сериала
      const mediaTitle = post.mediaTitle || '';
      const mediaType = post.mediaType === 'tv' ? '📺' : '🎬';
      const hasMedia = !!post.tmdbId;

      // Тип поста
      const typeLabels = {
        'review': '📝 Рецензия',
        'rating': '⭐ Оценка',
        'media_added': '➕ Добавил в список',
        'media_shared': '🔗 Поделился',
        'status_update': '💬 Статус',
        'text': '📄 Пост',
        'announcement': '📢 Объявление'
      };
      const typeLabel = typeLabels[post.postType] || '';

      // Формируем строку с фильмом и типом
      let movieLine = '';
      if (hasMedia && mediaTitle) {
        movieLine = `${mediaType} <b>${mediaTitle}</b>`;
        if (post.rating) movieLine += ` — ⭐ ${post.rating}`;
        if (post.userListName) movieLine += ` → ${post.userListName}`;
      } else if (hasMedia) {
        movieLine = `${mediaType} (загрузка...)`;
      }

      // Реакции
      const reactionsCount = post.reactions?.length || 0;
      let reactionsText = '';
      if (reactionsCount > 0) {
        const emojiCounts = {};
        post.reactions.forEach(r => {
          emojiCounts[r.emoji] = (emojiCounts[r.emoji] || 0) + 1;
        });
        const topEmojis = Object.entries(emojiCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([emoji, count]) => `${emoji}${count > 1 ? count : ''}`)
          .join(' ');
        reactionsText = ` ${topEmojis}`;
      }

      // Комментарии
      let commentsText = '';
      if (post.commentsCount > 0) {
        commentsText = ` | 💬 ${post.commentsCount}`;
      }

      feedText += `<b>${author}</b> ${typeLabel}\n`;
      if (movieLine) feedText += `${movieLine}\n`;
      feedText += `📅 ${date}${reactionsText}${commentsText}\n`;
      if (content) feedText += `${content}\n`;
      feedText += '\n';
    }

    // Кнопки навигации
    const navRow = [];
    if (page > 0) navRow.push({ text: '◀️ Назад', callback_data: `feed_page_${page - 1}` });
    navRow.push({ text: '🏠 Меню', callback_data: 'main_menu' });
    if (hasMore) navRow.push({ text: '▶️ Вперёд', callback_data: `feed_page_${page + 1}` });

    await bot.sendMessage(chatId, feedText, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [navRow] }
    });
  } catch (error) {
    console.error('Ошибка загрузки ленты:', error.message);
    await bot.sendMessage(chatId, '⚠️ Ошибка загрузки ленты. Попробуйте позже.');
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
      text: '🎬 <b>Мои фильмы</b>\n\nЗагружаю ваши списки...',
      handler: async () => {
        await handleUserListsAction(chatId, userId, session.token, 'movie');
      }
    },
    'menu_tv': {
      text: '📺 <b>Мои сериалы</b>\n\nЗагружаю ваши списки...',
      handler: async () => {
        await handleUserListsAction(chatId, userId, session.token, 'tv');
      }
    },
    'menu_watchlist': {
      text: '⭐ <b>Хочу посмотреть</b>\n\nЧто хотите посмотреть?',
      handler: async () => {
        // Показываем выбор: Фильмы или Сериалы
        await bot.sendMessage(chatId, '⭐ <b>Хочу посмотреть</b>\n\nВыберите:', {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎬 Фильмы', callback_data: 'wl_type_movie_0' }],
              [{ text: '📺 Сериалы', callback_data: 'wl_type_tv_0' }],
              [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
            ]
          }
        });
      }
    },
    'menu_feed': {
      text: '📰 <b>Лента активности</b>\n\nЗагружаю последние посты...',
      handler: async () => {
        await handleFeedAction(chatId, userId, session.token, 0);
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
      text: '👤 <b>Мой профиль</b>\n\nВыберите действие:',
      buttons: [
        [{ text: '📝 Создать пост', callback_data: 'create_text_post' }],
        [{ text: '📸 Фото-пост', callback_data: 'create_photo_post' }],
        [{ text: '💬 Задать статус', callback_data: 'settings_change_status' }],
        [{ text: '🌐 Открыть профиль', url: `${publicUrl}/profile?session=${session.token}` }]
      ]
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
        [{ text: '🎨 Сменить тему', callback_data: 'settings_theme' }],
        [{ text: '🔒 Приватность стены', callback_data: 'settings_privacy' }],
        [{ text: '🔔 Настройки уведомлений', callback_data: 'settings_notifications' }],
        [{ text: '🌐 Открыть настройки на сайте', url: `${publicUrl}/settings` }]
      ]
    },
    'menu_bug_report': {
      text: '🐛 <b>Багрепорты и предложения</b>\n\nВыберите действие:',
      buttons: [
        [{ text: '📝 Создать багрепорт', callback_data: 'bug_report_create' }],
        [{ text: '📋 Мои багрепорты', url: `${publicUrl}/my-bug-reports?session=${session.token}` }]
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
    const apiUrl = process.env.LOCAL_API_URL || process.env.API_URL || 'http://localhost:1313';
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
async function handleMessagesAction(chatId, userId, token, page = 0) {
  try {
    const apiUrl = process.env.LOCAL_API_URL || process.env.API_URL || 'http://localhost:1313';
    const response = await fetch(`${apiUrl}/api/messages/conversations`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error(`API: ${response.status}`);
    const conversations = await response.json();

    if (!conversations || conversations.length === 0) {
      await bot.sendMessage(
        chatId,
        '💬 <b>Сообщения</b>\n\nУ вас пока нет диалогов.\nНайдите пользователя на сайте и отправьте сообщение!',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '🌐 Открыть сайт', url: `${publicUrl}/messages` }
            ]]
          }
        }
      );
      return;
    }

    const limit = 5;
    const offset = page * limit;
    const pageConvs = conversations.slice(offset, offset + limit);
    const hasMore = offset + limit < conversations.length;

    // Считаем непрочитанные
    const unreadTotal = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

    let text = '💬 <b>Сообщения</b>\n\n';
    if (unreadTotal > 0) {
      text += `📬 ${unreadTotal} непрочитанных\n\n`;
    }
    text += `Диалоги ${offset + 1}-${Math.min(offset + limit, conversations.length)} из ${conversations.length}:\n\n`;

    const buttons = [];

    for (const conv of pageConvs) {
      const name = conv.isGroup ? `👥 ${conv.groupName}` : conv.otherUser?.displayName || 'Неизвестный';
      const lastMsg = conv.lastMessage
        ? (conv.lastMessage.length > 40 ? conv.lastMessage.substring(0, 40) + '...' : conv.lastMessage)
        : 'Нет сообщений';
      const unread = conv.unreadCount > 0 ? ` (${conv.unreadCount} new)` : '';
      const time = conv.lastMessageAt
        ? formatDate(new Date(conv.lastMessageAt))
        : '';

      text += `💬 <b>${name}</b>${unread}\n`;
      if (time) text += `📅 ${time}\n`;
      text += `${lastMsg}\n\n`;

      // Кнопка "Ответить" — для всех диалогов
      if (conv.isGroup) {
        buttons.push([{ text: `💬 ${name.substring(0, 30)}`, callback_data: `reply_group_${conv.id}` }]);
      } else {
        buttons.push([{ text: `💬 Ответить ${name.substring(0, 25)}`, callback_data: `reply_message_${conv.otherUser.id}` }]);
      }
    }

    // Навигация
    const navRow = [];
    if (page > 0) navRow.push({ text: '◀️ Назад', callback_data: `msg_page_${page - 1}` });
    navRow.push({ text: '🏠 Меню', callback_data: 'main_menu' });
    if (hasMore) navRow.push({ text: '▶️ Вперёд', callback_data: `msg_page_${page + 1}` });
    buttons.push(navRow);

    // Кнопка "Открыть все на сайте"
    buttons.push([{ text: '🌐 Открыть на сайте', url: `${publicUrl}/messages` }]);

    await bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  } catch (error) {
    console.error('Ошибка загрузки сообщений:', error.message);
    await bot.sendMessage(chatId, '⚠️ Ошибка загрузки сообщений. Попробуйте позже.');
  }
}

/**
 * Получить списки пользователя (фильмы или сериалы)
 * @param {number} chatId - ID чата Telegram
 * @param {string} userId - ID пользователя
 * @param {string} token - Токен сессии
 * @param {string} mediaType - 'movie' или 'tv'
 */
async function handleUserListsAction(chatId, userId, token, mediaType) {
  try {
    const apiUrl = process.env.LOCAL_API_URL || process.env.API_URL || 'http://localhost:1313';
    const response = await fetch(`${apiUrl}/api/lists?mediaType=${mediaType}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error(`API: ${response.status}`);
    const lists = await response.json();

    const typeLabel = mediaType === 'movie' ? 'фильмов' : 'сериалов';
    const emoji = mediaType === 'movie' ? '🎬' : '📺';

    if (!lists || lists.length === 0) {
      await bot.sendMessage(
        chatId,
        `${emoji} <b>Мои ${typeLabel}</b>\n\nУ вас пока нет списков.\nСоздайте списки на сайте.`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '🌐 Открыть на сайте', url: `${publicUrl}/lists/${mediaType === 'movie' ? 'movies' : 'tv'}` }
            ]]
          }
        }
      );
      return;
    }

    // Формируем кнопки списков (по 2 в ряд)
    const buttons = [];
    for (let i = 0; i < lists.length; i += 2) {
      const row = [];
      row.push({ text: lists[i].name, callback_data: `list_${lists[i].id}_0` });
      if (i + 1 < lists.length) {
        row.push({ text: lists[i + 1].name, callback_data: `list_${lists[i + 1].id}_0` });
      }
      buttons.push(row);
    }
    buttons.push([{ text: '🏠 Главное меню', callback_data: 'main_menu' }]);

    await bot.sendMessage(
      chatId,
      `${emoji} <b>Мои ${typeLabel}</b>\n\nВыберите список:`,
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      }
    );
  } catch (error) {
    console.error('Ошибка загрузки списков:', error.message);
    await bot.sendMessage(chatId, '⚠️ Ошибка загрузки списков. Попробуйте позже.');
  }
}

/**
 * Показать фильмы в списке (пагинация по 5)
 */
async function handleListItemsAction(chatId, userId, listId, page) {
  try {
    const session = await createSession(userId, { id: userId });
    const token = session.token;
    const apiUrl = process.env.LOCAL_API_URL || process.env.API_URL || 'http://localhost:1313';
    const limit = 5;

    const response = await fetch(`${apiUrl}/api/lists/${listId}/items`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error(`API: ${response.status}`);
    const allItems = await response.json();
    const items = Array.isArray(allItems) ? allItems : (allItems.items || []);
    const total = items.length;
    const offset = page * limit;
    const pageItems = items.slice(offset, offset + limit);

    if (!pageItems || pageItems.length === 0) {
      await bot.sendMessage(
        chatId,
        '📋 Список пуст.',
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'menu_movies' }]] } }
      );
      return;
    }

    // Формируем сообщение с фильмами
    let text = `📋 <b>Список</b> (фильмы ${offset + 1}-${Math.min(offset + limit, total)} из ${total}):\n\n`;
    const buttons = [];

    for (const item of pageItems) {
      const title = item.title || item.name || 'Без названия';
      const originalTitle = item.originalTitle || item.original_title || '';
      const year = item.releaseDate ? new Date(item.releaseDate).getFullYear() : (item.release_date ? new Date(item.release_date).getFullYear() : '');
      const rating = item.voteAverage || item.vote_average || item.rating || '';
      const genres = item.genres || '';

      text += `🎬 <b>${title}</b>`;
      if (originalTitle && originalTitle !== title) text += ` (${originalTitle})`;
      text += '\n';
      if (genres) text += `   Жанр: ${genres}`;
      if (year) text += ` | Год: ${year}`;
      if (rating) text += ` | ⭐ ${typeof rating === 'number' ? rating.toFixed(1) : rating}`;
      text += '\n';
      text += `   👉 ${publicUrl}/media/movie/${item.tmdbId || item.id}\n\n`;

      // Кнопка "Поделиться" для каждого фильма
      buttons.push([
        { text: `🌐 ${title.substring(0, 30)}`, url: `${publicUrl}/media/movie/${item.tmdbId || item.id}` },
        { text: '📤 Поделиться', url: `https://t.me/share/url?url=${encodeURIComponent(`${publicUrl}/media/movie/${item.tmdbId || item.id}`)}&text=${encodeURIComponent(`Посмотри "${title}" на watchRebel`)}` }
      ]);
    }

    // Кнопки навигации
    const navRow = [];
    if (page > 0) navRow.push({ text: '◀️ Назад', callback_data: `list_${listId}_${page - 1}` });
    navRow.push({ text: '🏠 Меню', callback_data: 'main_menu' });
    if (offset + limit < total) navRow.push({ text: '▶️ Вперёд', callback_data: `list_${listId}_${page + 1}` });
    buttons.push(navRow);

    await bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  } catch (error) {
    console.error('Ошибка загрузки фильмов списка:', error.message);
    await bot.sendMessage(chatId, '⚠️ Ошибка загрузки фильмов. Попробуйте позже.');
  }
}

/**
 * Показать watchlist (пагинация по 5)
 */
async function handleWatchlistAction(chatId, userId, token, page, mediaType) {
  try {
    const apiUrl = process.env.LOCAL_API_URL || process.env.API_URL || 'http://localhost:1313';
    const limit = 5;
    const offset = page * limit;

    const response = await fetch(`${apiUrl}/api/watchlist?limit=${limit}&offset=${offset}&mediaType=${mediaType}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error(`API: ${response.status}`);
    const data = await response.json();
    const allItems = data.items || data || [];
    const items = Array.isArray(allItems) ? allItems : [];
    const total = items.length;
    const pageItems = items.slice(offset, offset + limit);

    if (!pageItems || pageItems.length === 0) {
      await bot.sendMessage(
        chatId,
        '⭐ <b>Хочу посмотреть</b>\n\nСписок пуст.\nДобавьте фильмы на сайте.',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '🌐 Открыть на сайте', url: `${publicUrl}/watchlist` }
            ]]
          }
        }
      );
      return;
    }

    let text = `⭐ <b>Хочу посмотреть</b> (${offset + 1}-${Math.min(offset + limit, total)} из ${total}):\n\n`;
    const buttons = [];

    for (const item of pageItems) {
      const title = item.title || item.name || 'Без названия';
      const originalTitle = item.originalTitle || item.original_title || '';
      const year = item.releaseDate ? new Date(item.releaseDate).getFullYear() : (item.release_date ? new Date(item.release_date).getFullYear() : '');
      const rating = item.voteAverage || item.vote_average || item.rating || '';
      const typeLabel = mediaType === 'tv' ? '📺 Сериал' : '🎬 Фильм';

      text += `${typeLabel} <b>${title}</b>`;
      if (originalTitle && originalTitle !== title) text += ` (${originalTitle})`;
      text += '\n';
      if (year) text += `   Год: ${year}`;
      if (rating) text += ` | ⭐ ${typeof rating === 'number' ? rating.toFixed(1) : rating}`;
      text += '\n';
      text += `   👉 ${publicUrl}/media/${mediaType}/${item.tmdbId || item.id}\n\n`;

      buttons.push([
        { text: `🌐 ${title.substring(0, 30)}`, url: `${publicUrl}/media/${mediaType}/${item.tmdbId || item.id}` },
        { text: '📤 Поделиться', url: `https://t.me/share/url?url=${encodeURIComponent(`${publicUrl}/media/${mediaType}/${item.tmdbId || item.id}`)}&text=${encodeURIComponent(`Посмотри "${title}" на watchRebel`)}` }
      ]);
    }

    const navRow = [];
    if (page > 0) navRow.push({ text: '◀️ Назад', callback_data: `wl_page_${mediaType}_${page - 1}` });
    navRow.push({ text: '🏠 Меню', callback_data: 'main_menu' });
    if (offset + limit < total) navRow.push({ text: '▶️ Вперёд', callback_data: `wl_page_${mediaType}_${page + 1}` });
    buttons.push(navRow);

    await bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  } catch (error) {
    console.error('Ошибка загрузки watchlist:', error.message);
    await bot.sendMessage(chatId, '⚠️ Ошибка загрузки. Попробуйте позже.');
  }
}

/**
 * Показать список тем для выбора
 */
async function handleSettingsTheme(chatId, userId, userFrom) {
  const themes = [
    { value: 'light-cream', label: '☀️ Светлая (Кремовая)' },
    { value: 'dark', label: '🌙 Тёмная' },
    { value: 'material-light', label: '🎨 Material Light' },
    { value: 'material-dark', label: '🎨 Material Dark' },
    { value: 'die-my-darling', label: '❤️ Die My Darling' },
    { value: 'steam', label: '🎮 Steam' },
    { value: 'discord', label: '💬 Discord' },
    { value: 'metal-and-glass', label: '🔮 Metal & Glass' },
    { value: 'cyberpunk', label: '🌆 Cyberpunk' },
    { value: 'dark-neon-obsidian', label: '💎 Dark Neon Obsidian' }
  ];

  const buttons = [];
  for (let i = 0; i < themes.length; i += 2) {
    const row = [];
    row.push({ text: themes[i].label, callback_data: `set_theme_${themes[i].value}` });
    if (i + 1 < themes.length) {
      row.push({ text: themes[i + 1].label, callback_data: `set_theme_${themes[i + 1].value}` });
    }
    buttons.push(row);
  }
  buttons.push([{ text: '🏠 Главное меню', callback_data: 'main_menu' }]);

  await bot.sendMessage(chatId, '🎨 <b>Выберите тему оформления:</b>', {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: buttons }
  });
}

/**
 * Установить тему
 */
async function handleSetTheme(chatId, userId, themeName, userFrom) {
  try {
    const session = await createSession(userId, userFrom);
    const apiUrl = process.env.LOCAL_API_URL || process.env.API_URL || 'http://localhost:1313';

    await fetch(`${apiUrl}/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`
      },
      body: JSON.stringify({ theme: themeName })
    });

    await bot.sendMessage(chatId, `✅ Тема изменена на "<b>${themeName}</b>".\n\nОбновите страницу на сайте, чтобы увидеть изменения.`, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '🏠 Главное меню', callback_data: 'main_menu' }]] }
    });
  } catch (error) {
    console.error('Ошибка смены темы:', error.message);
    await bot.sendMessage(chatId, '⚠️ Ошибка смены темы. Попробуйте позже.');
  }
}

/**
 * Показать настройки приватности стены
 */
async function handleSettingsPrivacy(chatId, userId, userFrom) {
  try {
    const session = await createSession(userId, userFrom);
    const apiUrl = process.env.LOCAL_API_URL || process.env.API_URL || 'http://localhost:1313';

    const response = await fetch(`${apiUrl}/api/users/${userId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${session.token}` }
    });

    let currentPrivacy = 'all';
    if (response.ok) {
      const data = await response.json();
      currentPrivacy = data.wallPrivacy || 'all';
    }

    const labels = { 'all': '🌐 Все', 'friends': '👥 Только друзья', 'none': '🔒 Никто' };

    await bot.sendMessage(chatId, `🔒 <b>Приватность стены</b>\n\nТекущий режим: <b>${labels[currentPrivacy]}</b>\n\nВыберите:`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: `🌐 Все${currentPrivacy === 'all' ? ' ✓' : ''}`, callback_data: 'set_privacy_all' }],
          [{ text: `👥 Только друзья${currentPrivacy === 'friends' ? ' ✓' : ''}`, callback_data: 'set_privacy_friends' }],
          [{ text: `🔒 Никто${currentPrivacy === 'none' ? ' ✓' : ''}`, callback_data: 'set_privacy_none' }],
          [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
        ]
      }
    });
  } catch (error) {
    console.error('Ошибка загрузки приватности:', error.message);
    await bot.sendMessage(chatId, '⚠️ Ошибка. Попробуйте позже.');
  }
}

/**
 * Установить приватность стены
 */
async function handleSetPrivacy(chatId, userId, privacyValue, userFrom) {
  try {
    const session = await createSession(userId, userFrom);
    const apiUrl = process.env.LOCAL_API_URL || process.env.API_URL || 'http://localhost:1313';

    await fetch(`${apiUrl}/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`
      },
      body: JSON.stringify({ wallPrivacy: privacyValue })
    });

    const labels = { 'all': '🌐 Все', 'friends': '👥 Только друзья', 'none': '🔒 Никто' };

    await bot.sendMessage(chatId, `✅ Приватность стены изменена на "<b>${labels[privacyValue]}</b>".`, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '🏠 Главное меню', callback_data: 'main_menu' }]] }
    });
  } catch (error) {
    console.error('Ошибка смены приватности:', error.message);
    await bot.sendMessage(chatId, '⚠️ Ошибка. Попробуйте позже.');
  }
}

/**
 * Показать главное меню
 */
async function showMainMenu(chatId, userFrom) {
  const session = await createSession(userFrom.id.toString(), userFrom);
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
      { text: '💬 Сообщения', callback_data: 'menu_messages' }
    ],
    [
      { text: '👤 Мой профиль', callback_data: 'menu_profile' }
    ],
    [
      { text: '👥 Пригласить друга', callback_data: 'menu_invite' }
    ],
    [
      { text: '🐛 Багрепорты и предложения', callback_data: 'menu_bug_report' }
    ],
    [
      { text: '⚙️ Настройки', callback_data: 'menu_settings' }
    ],
    [
      { text: '🔔 Настройки уведомлений', callback_data: 'settings_notifications' }
    ]
  ];

  if (!publicUrl.includes('localhost')) {
    menuButtons.push([
      { text: '🌐 Открыть сайт', url: `${publicUrl}?session=${session.token}` }
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
}

/**
 * Обработка загрузки изображения для поста — скачивает во временную папку
 */
async function handlePostImage(chatId, userId, photos, stateData) {
  try {
    if (!photos || photos.length === 0) return;

    const photo = photos[photos.length - 1];
    const fileId = photo.file_id;

    // Дедупликация — не обрабатываем одно фото дважды
    stateData.processedFiles = stateData.processedFiles || [];
    if (stateData.processedFiles.includes(fileId)) return;
    stateData.processedFiles.push(fileId);

    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    const response = await fetch(fileUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    // Сохраняем во временную папку
    const fs = await import('fs');
    const path = await import('path');
    const tmpDir = '/tmp/watchrebel_bot';
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const fileName = `post_${userId}_${Date.now()}.jpg`;
    const filePath = path.join(tmpDir, fileName);
    fs.writeFileSync(filePath, buffer);

    // Сохраняем путь в состояние
    stateData.images = stateData.images || [];
    stateData.images.push(filePath);
    setUserState(userId, 'awaiting_post_image', stateData);

    if (stateData.images.length === 1) {
      // Первое фото — показываем кнопки
      await bot.sendMessage(chatId, `✅ Изображение добавлено. Можно отправить ещё или нажать "Опубликовать".`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '⏩ Опубликовать без изображения', callback_data: 'post_skip_image' }],
            [{ text: '✅ Опубликовать', callback_data: 'post_publish' }]
          ]
        }
      });
    } else {
      // Последующие фото — только подтверждение
      await bot.sendMessage(chatId, `✅ Изображение ${stateData.images.length} добавлено.`);
    }
  } catch (error) {
    console.error('Ошибка загрузки изображения:', error.message);
    await bot.sendMessage(chatId, '⚠️ Ошибка загрузки изображения. Попробуйте ещё раз.');
  }
}

/**
 * Опубликовать пост
 */
async function publishPost(chatId, userId, content, imageUrls, userFrom) {
  try {
    const session = await createSession(userId, userFrom);
    const apiUrl = process.env.LOCAL_API_URL || process.env.API_URL || 'http://localhost:1313';

    // 1. Создаём пост
    const response = await fetch(`${apiUrl}/api/wall`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`
      },
      body: JSON.stringify({
        content: content || null,
        postType: 'text',
        wallOwnerId: userId
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`❌ API ошибка ${response.status}:`, errorData);
      throw new Error(`API: ${response.status}`);
    }

    const postData = await response.json();
    const postId = postData.id;

    // 2. Если есть изображения — загружаем к посту
    if (imageUrls && imageUrls.length > 0 && postId) {
      const fs = await import('fs');
      for (const filePath of imageUrls) {
        try {
          if (!fs.existsSync(filePath)) continue;
          const buffer = fs.readFileSync(filePath);

          const FormData = (await import('form-data')).default;
          const formData = new FormData();
          formData.append('postId', postId);
          formData.append('images', buffer, {
            filename: path.basename(filePath),
            contentType: 'image/jpeg'
          });

          await axios.post(`${apiUrl}/api/wall/images`, formData, {
            headers: {
              'Authorization': `Bearer ${session.token}`,
              ...formData.getHeaders()
            }
          });

          // Удаляем временный файл
          fs.unlinkSync(filePath);
        } catch (imgErr) {
          console.error('Ошибка загрузки изображения к посту:', imgErr.message);
        }
      }
    }

    clearUserState(userId);

    let replyText = `✅ <b>Пост опубликован!</b>\n\n${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`;
    if (imageUrls && imageUrls.length > 0) replyText += `\n\n🖼️ ${imageUrls.length} изображение(ий)`;

    await bot.sendMessage(chatId, replyText, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Ошибка публикации поста:', error.message);
    clearUserState(userId);
    await bot.sendMessage(chatId, '⚠️ Ошибка публикации поста. Попробуйте позже.');
  }
}

/**
 * Действие "Поделиться фильмом" — просто открывает share URL
 */
async function handleShareMovieAction(chatId, tmdbId) {
  // share URL обрабатывается Telegram нативно, ничего делать не нужно
  // Эта функция нужна на случай если захотим добавить доп. логику
}

/**
 * Создание текстового поста через бота
 */
async function handleCreateTextPost(chatId, userId, userFrom) {
  setUserState(userId, 'awaiting_text_post', { userFrom });
  await bot.sendMessage(
    chatId,
    '📝 <b>Создание поста</b>\n\n' +
    'Напишите текст вашего поста.\n\n' +
    'Для отмены отправьте /cancel',
    { parse_mode: 'HTML' }
  );
}

/**
 * Обработка отправки текстового поста
 */
async function handleSendTextPost(chatId, userId, messageText, userFrom) {
  try {
    if (!messageText || messageText.trim().length === 0) {
      await bot.sendMessage(chatId, '⚠️ Пост не может быть пустым. Попробуйте еще раз или /cancel');
      return;
    }

    if (messageText.trim().length > 2000) {
      await bot.sendMessage(chatId, '⚠️ Пост слишком длинный. Максимум 2000 символов. Попробуйте еще раз или /cancel');
      return;
    }

    // Сохраняем текст и переходим к шагу загрузки изображения
    setUserState(userId, 'awaiting_post_image', {
      userFrom,
      content: messageText.trim(),
      images: []
    });

    await bot.sendMessage(
      chatId,
      '📸 <b>Изображение</b>\n\n' +
      'Отправьте изображение (можно несколько) или нажмите кнопку ниже, чтобы опубликовать без картинки.',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⏩ Опубликовать без изображения', callback_data: 'post_skip_image' }],
            [{ text: '✅ Опубликовать', callback_data: 'post_publish' }]
          ]
        }
      }
    );
  } catch (error) {
    console.error('Ошибка создания поста:', error.message);
    clearUserState(userId);
    await bot.sendMessage(chatId, '⚠️ Ошибка создания поста. Попробуйте позже.');
  }
}

/**
 * Обработка действия "Ответить в групповой чат"
 * @param {number} chatId - ID чата Telegram
 * @param {string} userId - ID пользователя
 * @param {string} conversationId - ID группового диалога
 * @param {Object} userFrom - Объект пользователя из Telegram
 */
async function handleReplyGroupMessageAction(chatId, userId, conversationId, userFrom) {
  try {
    console.log(`📝 Пользователь ${userId} хочет ответить в групповой чат ${conversationId}`);

    // Получаем информацию о группе
    const session = await createSession(userId, userFrom);
    const apiUrl = process.env.LOCAL_API_URL || process.env.API_URL || 'http://localhost:1313';

    const response = await fetch(`${apiUrl}/api/messages/${conversationId}?limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.token}`
      }
    });

    let groupName = 'группу';
    if (response.ok) {
      const data = await response.json();
      groupName = data.group?.groupName || 'группу';
    }

    // Устанавливаем состояние ожидания ответа в группу
    setUserState(userId, 'awaiting_group_message_reply', {
      chatId,
      userFrom,
      conversationId,
      groupName
    });

    await bot.sendMessage(
      chatId,
      `💬 <b>Ответ в "${groupName}"</b>\n\n` +
      'Отправьте текст сообщения.\n\n' +
      'Для отмены отправьте /cancel',
      { parse_mode: 'HTML' }
    );

    console.log(`✅ Состояние установлено для пользователя ${userId} (группа ${conversationId})`);
  } catch (error) {
    console.error('❌ Ошибка обработки ответа в группу:', error.message);

    await bot.sendMessage(
      chatId,
      '⚠️ Произошла ошибка. Попробуйте позже.',
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
    const apiUrl = process.env.LOCAL_API_URL || process.env.API_URL || 'http://localhost:1313';
    
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
 * @param {number} messageId - ID сообщения для редактирования (опционально)
 */
async function handleSettingsAction(chatId, userId, action, userFrom, messageId = null) {
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
  } else if (action === 'settings_notifications') {
    // Показываем настройки уведомлений
    await handleNotificationSettingsMenu(chatId, userId, userFrom, messageId);
  }
}

/**
 * Отображение меню настроек уведомлений
 * @param {number} chatId - ID чата
 * @param {string} userId - ID пользователя
 * @param {Object} userFrom - Объект пользователя из Telegram
 * @param {number} messageId - ID сообщения для редактирования (опционально)
 */
async function handleNotificationSettingsMenu(chatId, userId, userFrom, messageId = null) {
  try {
    console.log(`🔔 Запрос настроек уведомлений для пользователя ${userId}`);
    
    // Создаем сессию для авторизации
    const session = await createSession(userId, userFrom);
    const apiUrl = process.env.LOCAL_API_URL || process.env.API_URL || 'http://localhost:1313';
    
    // Получаем текущие настройки уведомлений
    const response = await fetch(`${apiUrl}/api/users/${userId}/notification-settings`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.token}`
      }
    });

    if (!response.ok) {
      throw new Error(`API вернул ошибку: ${response.status}`);
    }

    const settings = await response.json();
    console.log('✅ Получены настройки:', settings);

    // Формируем текст сообщения
    let messageText = '🔔 <b>Настройки уведомлений</b>\n\n';
    messageText += 'Выберите, какие уведомления вы хотите получать в Telegram:\n\n';

    // Группа: Активность друзей
    messageText += '<b>Активность друзей:</b>\n';
    messageText += `${settings.friendAddedToList ? '✅' : '❌'} Друг добавил фильм/сериал\n`;
    messageText += `${settings.friendRatedMedia ? '✅' : '❌'} Друг поставил оценку\n`;
    messageText += `${settings.friendPostedReview ? '✅' : '❌'} Друг написал отзыв\n\n`;

    // Группа: Личные
    messageText += '<b>Личные:</b>\n';
    messageText += `${settings.friendReactedToPost ? '✅' : '❌'} Реакция на ваш пост\n`;
    messageText += `${settings.newMessage ? '✅' : '❌'} Новое личное сообщение\n`;
    messageText += `${settings.newFriendRequest ? '✅' : '❌'} Новый запрос в друзья\n\n`;

    // Группа: Системные
    messageText += '<b>Системные:</b>\n';
    messageText += `${settings.adminAnnouncement ? '✅' : '❌'} Объявления от администрации\n\n`;

    messageText += 'Нажмите на кнопку, чтобы включить/выключить уведомление:';

    // Формируем инлайн-кнопки
    const inlineButtons = [
      // Активность друзей
      [{ 
        text: `${settings.friendAddedToList ? '✅' : '❌'} Друг добавил контент`, 
        callback_data: 'toggle_notif_friendAddedToList' 
      }],
      [{ 
        text: `${settings.friendRatedMedia ? '✅' : '❌'} Друг поставил оценку`, 
        callback_data: 'toggle_notif_friendRatedMedia' 
      }],
      [{ 
        text: `${settings.friendPostedReview ? '✅' : '❌'} Друг написал отзыв`, 
        callback_data: 'toggle_notif_friendPostedReview' 
      }],
      // Личные
      [{ 
        text: `${settings.friendReactedToPost ? '✅' : '❌'} Реакция на пост`, 
        callback_data: 'toggle_notif_friendReactedToPost' 
      }],
      [{ 
        text: `${settings.newMessage ? '✅' : '❌'} Новое сообщение`, 
        callback_data: 'toggle_notif_newMessage' 
      }],
      [{ 
        text: `${settings.newFriendRequest ? '✅' : '❌'} Запрос в друзья`, 
        callback_data: 'toggle_notif_newFriendRequest' 
      }],
      // Системные
      [{ 
        text: `${settings.adminAnnouncement ? '✅' : '❌'} Объявления админа`, 
        callback_data: 'toggle_notif_adminAnnouncement' 
      }],
      // Кнопка "Назад"
      [{ text: '◀️ Назад', callback_data: 'main_menu' }]
    ];

    // Если есть messageId, редактируем сообщение, иначе отправляем новое
    if (messageId) {
      await bot.editMessageText(messageText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: inlineButtons
        }
      });
    } else {
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
    }

    console.log(`✅ Меню настроек уведомлений отправлено пользователю ${userId}`);
  } catch (error) {
    console.error('❌ Ошибка получения настроек уведомлений:', error.message);
    
    await bot.sendMessage(
      chatId,
      '⚠️ Произошла ошибка при загрузке настроек. Попробуйте позже.',
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * Переключение настройки уведомления
 * @param {number} chatId - ID чата
 * @param {string} userId - ID пользователя
 * @param {string} callbackData - Данные callback (toggle_notif_{type})
 * @param {Object} userFrom - Объект пользователя из Telegram
 * @param {number} messageId - ID сообщения для редактирования
 */
async function handleToggleNotification(chatId, userId, callbackData, userFrom, messageId) {
  try {
    // Извлекаем тип уведомления из callback_data
    const notificationType = callbackData.replace('toggle_notif_', '');
    console.log(`🔄 Переключение настройки "${notificationType}" для пользователя ${userId}`);
    
    // Создаем сессию для авторизации
    const session = await createSession(userId, userFrom);
    const apiUrl = process.env.LOCAL_API_URL || process.env.API_URL || 'http://localhost:1313';
    
    // Получаем текущие настройки
    const getResponse = await fetch(`${apiUrl}/api/users/${userId}/notification-settings`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.token}`
      }
    });

    if (!getResponse.ok) {
      throw new Error(`API вернул ошибку: ${getResponse.status}`);
    }

    const currentSettings = await getResponse.json();
    
    // Переключаем значение
    const newValue = !currentSettings[notificationType];
    console.log(`📝 Изменение ${notificationType}: ${currentSettings[notificationType]} → ${newValue}`);

    // Отправляем обновление
    const updateResponse = await fetch(`${apiUrl}/api/users/${userId}/notification-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`
      },
      body: JSON.stringify({
        [notificationType]: newValue
      })
    });

    if (!updateResponse.ok) {
      throw new Error(`API вернул ошибку: ${updateResponse.status}`);
    }

    console.log(`✅ Настройка "${notificationType}" обновлена на ${newValue}`);

    // Обновляем меню с новыми настройками
    await handleNotificationSettingsMenu(chatId, userId, userFrom, messageId);
  } catch (error) {
    console.error('❌ Ошибка переключения настройки уведомления:', error.message);
    
    await bot.sendMessage(
      chatId,
      '⚠️ Произошла ошибка при обновлении настройки. Попробуйте позже.',
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
    const apiUrl = process.env.LOCAL_API_URL || process.env.API_URL || 'http://localhost:1313';
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
    const apiUrl = process.env.LOCAL_API_URL || process.env.API_URL || 'http://localhost:1313';
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
    const apiUrl = process.env.LOCAL_API_URL || process.env.API_URL || 'http://localhost:1313';
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
 * Обработка отправки ответа в групповой чат
 * @param {number} chatId - ID чата Telegram
 * @param {string} userId - ID пользователя
 * @param {string} messageText - Текст сообщения
 * @param {Object} stateData - Данные состояния (conversationId, groupName, userFrom)
 */
async function handleSendGroupMessageReply(chatId, userId, messageText, stateData) {
  try {
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

    console.log(`📝 Отправка сообщения от ${userId} в группу ${stateData.conversationId}`);

    const session = await createSession(userId, stateData.userFrom);
    const apiUrl = process.env.LOCAL_API_URL || process.env.API_URL || 'http://localhost:1313';

    const response = await fetch(`${apiUrl}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`
      },
      body: JSON.stringify({
        receiverId: stateData.conversationId,
        content: messageText.trim(),
        sentViaBot: true
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`❌ API ошибка ${response.status}:`, errorData);
      throw new Error(`API вернул ошибку: ${response.status}`);
    }

    clearUserState(userId);

    await bot.sendMessage(
      chatId,
      `✅ <b>Сообщение отправлено в "${stateData.groupName}"!</b>\n\n` +
      `Ваше сообщение:\n${messageText.trim()}`,
      { parse_mode: 'HTML' }
    );

    console.log(`✅ Сообщение от ${userId} отправлено в группу ${stateData.conversationId}`);
  } catch (error) {
    console.error('❌ Ошибка отправки сообщения в группу:', error.message);

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

/**
 * Обработчик фото для багрепортов
 */
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const userState = getUserState(userId);

  // Если пользователь загружает изображение для поста
  if (userState && userState.state === 'awaiting_post_image') {
    await handlePostImage(chatId, userId, msg.photo, userState.data);
  }
  // Если пользователь в состоянии добавления изображений к багрепорту
  else if (userState && userState.state === 'awaiting_bug_report_images') {
    await handleBugReportImage(chatId, userId, msg.photo, userState.data);
  }
});

/**
 * Обработка действий багрепорта
 */
async function handleBugReportAction(chatId, userId, action, userFrom) {
  if (action === 'bug_report_create') {
    // Начинаем процесс создания багрепорта
    setUserState(userId, 'awaiting_bug_report_title', { userFrom });
    
    await bot.sendMessage(
      chatId,
      '🐛 <b>Создание багрепорта</b>\n\n' +
      'Шаг 1/3: Введите заголовок проблемы\n\n' +
      'Кратко опишите суть проблемы (до 200 символов)\n\n' +
      'Используйте /cancel для отмены',
      { parse_mode: 'HTML' }
    );
  } else if (action === 'bug_report_skip_images') {
    // Пропускаем изображения и отправляем багрепорт
    const userState = getUserState(userId);
    if (userState && userState.data) {
      await submitBugReport(chatId, userId, userState.data, userFrom);
    }
  } else if (action === 'bug_report_submit') {
    // Отправляем багрепорт с изображениями
    const userState = getUserState(userId);
    if (userState && userState.data) {
      await submitBugReport(chatId, userId, userState.data, userFrom);
    }
  }
}

/**
 * Обработка заголовка багрепорта
 */
async function handleBugReportTitle(chatId, userId, title, data) {
  if (title.length > 200) {
    await bot.sendMessage(
      chatId,
      '⚠️ Заголовок слишком длинный. Максимум 200 символов.\n\nПопробуйте еще раз:',
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Сохраняем заголовок и переходим к описанию
  setUserState(userId, 'awaiting_bug_report_description', {
    ...data,
    title: title.trim()
  });

  await bot.sendMessage(
    chatId,
    '✅ Заголовок сохранен!\n\n' +
    '🐛 <b>Создание багрепорта</b>\n\n' +
    'Шаг 2/3: Введите подробное описание проблемы\n\n' +
    'Опишите:\n' +
    '• Что произошло\n' +
    '• Что вы ожидали\n' +
    '• Шаги для воспроизведения\n\n' +
    'Максимум 2000 символов\n\n' +
    'Используйте /cancel для отмены',
    { parse_mode: 'HTML' }
  );
}

/**
 * Обработка описания багрепорта
 */
async function handleBugReportDescription(chatId, userId, description, data) {
  if (description.length > 2000) {
    await bot.sendMessage(
      chatId,
      '⚠️ Описание слишком длинное. Максимум 2000 символов.\n\nПопробуйте еще раз:',
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Сохраняем описание и переходим к изображениям
  setUserState(userId, 'awaiting_bug_report_images', {
    ...data,
    description: description.trim(),
    images: []
  });

  await bot.sendMessage(
    chatId,
    '✅ Описание сохранено!\n\n' +
    '🐛 <b>Создание багрепорта</b>\n\n' +
    'Шаг 3/3: Прикрепите изображения (опционально)\n\n' +
    'Отправьте до 5 изображений со скриншотами проблемы.\n' +
    'Можно отправлять по одному или несколько сразу.\n\n' +
    'Когда закончите, нажмите кнопку ниже:',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '⏭️ Пропустить изображения', callback_data: 'bug_report_skip_images' }],
          [{ text: '✅ Отправить багрепорт', callback_data: 'bug_report_submit' }]
        ]
      }
    }
  );
}

/**
 * Обработка изображения для багрепорта
 */
async function handleBugReportImage(chatId, userId, photos, data) {
  const userState = getUserState(userId);
  if (!userState || !userState.data) return;

  const images = userState.data.images || [];

  // Проверяем лимит
  if (images.length >= 5) {
    await bot.sendMessage(
      chatId,
      '⚠️ Достигнут лимит изображений (максимум 5).\n\n' +
      'Нажмите кнопку "Отправить багрепорт" для завершения.',
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Берем фото наилучшего качества
  const photo = photos[photos.length - 1];
  images.push(photo.file_id);

  // Обновляем состояние
  setUserState(userId, 'awaiting_bug_report_images', {
    ...userState.data,
    images
  });

  await bot.sendMessage(
    chatId,
    `✅ Изображение ${images.length}/5 добавлено!\n\n` +
    (images.length < 5 
      ? 'Можете отправить еще изображения или нажать кнопку для завершения.'
      : 'Достигнут лимит. Нажмите кнопку "Отправить багрепорт".'),
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Отправить багрепорт', callback_data: 'bug_report_submit' }]
        ]
      }
    }
  );
}

/**
 * Отправка багрепорта на сервер
 */
async function submitBugReport(chatId, userId, data, userFrom) {
  try {
    await bot.sendMessage(chatId, '⏳ Отправка багрепорта...', { parse_mode: 'HTML' });

    // Создаем сессию для авторизации
    const session = await createSession(userId, userFrom);
    const apiUrl = process.env.LOCAL_API_URL || process.env.API_URL || 'http://localhost:1313';

    // Загружаем изображения если есть
    let imagePaths = [];
    if (data.images && data.images.length > 0) {
      console.log(`📸 Начинаем загрузку ${data.images.length} изображений`);
      const FormData = (await import('form-data')).default;
      const formData = new FormData();

      for (const fileId of data.images) {
        try {
          console.log(`📥 Загружаем файл ${fileId} из Telegram`);
          // Получаем файл из Telegram
          const file = await bot.getFile(fileId);
          const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
          console.log(`🔗 URL файла: ${fileUrl}`);
          
          // Скачиваем файл через axios
          const fileResponse = await axios.get(fileUrl, { responseType: 'arraybuffer' });
          console.log(`✅ Файл скачан, размер: ${fileResponse.data.byteLength} байт`);
          
          // Добавляем в FormData
          formData.append('images', Buffer.from(fileResponse.data), {
            filename: `image_${Date.now()}_${fileId.slice(-8)}.jpg`,
            contentType: 'image/jpeg'
          });
        } catch (err) {
          console.error('❌ Ошибка загрузки изображения:', err);
        }
      }

      // Отправляем изображения через axios
      try {
        console.log(`📤 Отправляем изображения на сервер: ${apiUrl}/api/bug-reports/upload-images`);
        const uploadResponse = await axios.post(
          `${apiUrl}/api/bug-reports/upload-images`,
          formData,
          {
            headers: {
              'Authorization': `Bearer ${session.token}`,
              ...formData.getHeaders()
            }
          }
        );

        console.log(`📡 Ответ сервера: ${uploadResponse.status} ${uploadResponse.statusText}`);
        imagePaths = uploadResponse.data.images;
        console.log(`✅ Изображения загружены: ${JSON.stringify(imagePaths)}`);
      } catch (err) {
        console.error(`❌ Ошибка загрузки изображений на сервер:`, err.response?.data || err.message);
      }
    }

    // Создаем багрепорт
    console.log(`📝 Создаем багрепорт с ${imagePaths.length} изображениями`);
    const response = await axios.post(
      `${apiUrl}/api/bug-reports`,
      {
        title: data.title,
        description: data.description,
        images: imagePaths
      },
      {
        headers: {
          'Authorization': `Bearer ${session.token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`📡 Ответ создания багрепорта: ${response.status} ${response.statusText}`);
    const bugReportData = response.data;
    console.log(`✅ Багрепорт создан: ${JSON.stringify(bugReportData)}`);

    // Очищаем состояние
    clearUserState(userId);

    await bot.sendMessage(
      chatId,
      '✅ <b>Багрепорт успешно отправлен!</b>\n\n' +
      `📋 <b>Ваш багрепорт:</b>\n<i>"${data.title}"</i>\n\n` +
      '🆕 <b>Статус:</b> Новый\n\n' +
      'Спасибо за обратную связь! 🙏\n' +
      'Мы рассмотрим вашу проблему и уведомим вас об изменении статуса.',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Мои багрепорты', url: `${publicUrl}/my-bug-reports?session=${session.token}` }],
            [{ text: '📱 Главное меню', callback_data: 'show_menu' }]
          ]
        }
      }
    );

  } catch (error) {
    console.error('Ошибка отправки багрепорта:', error);
    clearUserState(userId);
    
    await bot.sendMessage(
      chatId,
      '❌ <b>Ошибка отправки багрепорта</b>\n\n' +
      'Произошла ошибка при отправке. Попробуйте позже или создайте багрепорт на сайте.',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌐 Открыть сайт', url: `${publicUrl}` }]
          ]
        }
      }
    );
  }
}

// Настройка команд при запуске
setupCommands();

// Экспортируем бот и функции
export default bot;
export { bot, createSession, handleMenuAction };

