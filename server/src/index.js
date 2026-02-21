import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ВАЖНО: Загрузка переменных окружения ПЕРЕД всеми остальными импортами
const envPath = path.join(__dirname, '../../.env');
console.log('📁 Загрузка .env из:', envPath);
const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.error('❌ Ошибка загрузки .env:', envResult.error);
} else {
  console.log('✅ .env загружен успешно');
  console.log('🔑 TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'Есть' : 'Отсутствует');
  console.log('🎬 TMDB_API_KEY:', process.env.TMDB_API_KEY ? `Есть (${process.env.TMDB_API_KEY.substring(0, 10)}...)` : 'Отсутствует');
  console.log('🎬 TMDB_API_ACCESS_KEY:', process.env.TMDB_API_ACCESS_KEY ? `Есть (${process.env.TMDB_API_ACCESS_KEY.substring(0, 20)}...)` : 'Отсутствует');
}

// Теперь импортируем остальные модули, которые используют process.env
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import listsRoutes from './routes/lists.js';
import watchlistRoutes from './routes/watchlist.js';
import ratingsRoutes from './routes/ratings.js';
import wallRoutes from './routes/wall.js';
import progressRoutes from './routes/progress.js';
import notificationsRoutes from './routes/notifications.js';
import mediaRoutes from './routes/media.js';
import adminRoutes from './routes/admin.js';
import webhookRoutes from './routes/webhook.js';
import feedRoutes from './routes/feed.js';
import messagesRoutes from './routes/messages.js';
import settingsRoutes from './routes/settings.js';
import logger, { httpLogger, cleanOldLogs } from './utils/logger.js';

if (envResult.error) {
  console.error('❌ Ошибка загрузки .env:', envResult.error);
} else {
  console.log('✅ .env загружен успешно');
  console.log('🔑 TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'Есть' : 'Отсутствует');
  console.log('🎬 TMDB_API_KEY:', process.env.TMDB_API_KEY ? `Есть (${process.env.TMDB_API_KEY.substring(0, 10)}...)` : 'Отсутствует');
  console.log('🎬 TMDB_API_ACCESS_KEY:', process.env.TMDB_API_ACCESS_KEY ? `Есть (${process.env.TMDB_API_ACCESS_KEY.substring(0, 20)}...)` : 'Отсутствует');
}

// Очистка старых логов при запуске (в production)
if (process.env.NODE_ENV === 'production') {
  cleanOldLogs(30); // Храним логи за последние 30 дней
}

const app = express();
const PORT = process.env.PORT || 1313;

// CORS настройки для development и production
const corsOptions = {
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (например, мобильные приложения, Postman)
    if (!origin) return callback(null, true);
    
    // Список разрешенных origins
    const allowedOrigins = [
      'http://localhost:3000',           // Vite dev server
      'http://localhost:1313',           // Backend server
      'http://127.0.0.1:3000',
      'http://127.0.0.1:1313',
      'http://192.168.1.162:3000',       // Local network IP
      'http://172.19.0.1:3000',          // Docker network IP
      'https://prosurrender-rickety-brenda.ngrok-free.dev', // ngrok URL
      process.env.PUBLIC_URL,            // Production URL
    ].filter(Boolean); // Убираем undefined значения
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS: Запрос от неразрешенного origin: ${origin}`);
      callback(null, true); // В development разрешаем все
    }
  },
  credentials: true, // Разрешаем отправку cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP логирование
app.use(httpLogger);

// Раздача статических файлов (аватарки)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/lists', listsRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/wall', wallRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/webhook', webhookRoutes);

// Базовый route для проверки
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'watchRebel API работает' });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  logger.error('Необработанная ошибка', { 
    error: err.message, 
    stack: err.stack,
    url: req.url,
    method: req.method
  });
  res.status(500).json({ error: 'Что-то пошло не так!' });
});

// Запуск сервера только если это не тестовая среда
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`Сервер запущен на порту ${PORT}`, { 
      port: PORT, 
      env: process.env.NODE_ENV || 'development' 
    });
  });
}

export default app;
