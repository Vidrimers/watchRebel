import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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
import logger, { httpLogger, cleanOldLogs } from './utils/logger.js';

// Загрузка переменных окружения
dotenv.config();

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
