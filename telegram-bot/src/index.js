import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

// Загрузка переменных окружения
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN не найден в .env файле');
  process.exit(1);
}

// Создание бота
const bot = new TelegramBot(token, { polling: true });

console.log('🤖 Telegram бот запущен');

// Команда /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name;

  bot.sendMessage(
    chatId,
    `Привет, ${username}! 👋\n\nДобро пожаловать в watchRebel - социальную сеть для любителей кино!`
  );
});

// Обработка ошибок
bot.on('polling_error', (error) => {
  console.error('Ошибка polling:', error);
});

export default bot;
