import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

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
import passport from 'passport';
import { configurePassport } from './config/passport.js';
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
import { initWebSocket } from './services/websocketService.js';
import { createLoginAttemptsTable } from './middleware/loginAttempts.js';
import { startTokenCleanupScheduler } from './middleware/tokenCleanup.js';
import { runMigrations } from './database/migrations.js';
import { addWallPrivacyMigration } from './database/migrations/add_wall_privacy.js';
import { 
  configureHelmet, 
  configureCORS, 
  secureSessionMiddleware, 
  securityLogger 
} from './middleware/security.js';

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

// Helmet для улучшения безопасности
app.use(configureHelmet());

// Логирование подозрительных запросов
app.use(securityLogger);

// CORS настройки
const corsOptions = configureCORS();
app.use(cors(corsOptions));

// Secure session middleware
app.use(secureSessionMiddleware);

// Middleware
app.use(express.json({ limit: '10mb' })); // Ограничение размера JSON
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Инициализация Passport
configurePassport();
app.use(passport.initialize());

// HTTP логирование
app.use(httpLogger);

// Раздача статических файлов (аватарки)
// Добавляем заголовки CORS для статических файлов
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});
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

// Отдача статических файлов фронтенда (production build)
if (process.env.NODE_ENV === 'production' || process.env.SERVE_FRONTEND === 'true') {
  const frontendPath = path.join(__dirname, '../../client/dist');
  
  // Статические файлы (JS, CSS, изображения) с правильными MIME типами
  app.use(express.static(frontendPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      }
    }
  }));
  
  // SPA fallback - все остальные запросы (не /api/*) отдаем index.html
  app.get('*', (req, res, next) => {
    // Пропускаем API, uploads, webhook
    if (req.url.startsWith('/api') || req.url.startsWith('/uploads') || req.url.startsWith('/webhook')) {
      return next();
    }
    
    // Пропускаем запросы к файлам с расширениями (статика)
    if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
      return next();
    }
    
    // Отдаем index.html для всех остальных маршрутов (React Router)
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

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
  const server = http.createServer(app);
  
  // Запуск миграций базы данных
  runMigrations().then(async (result) => {
    if (result.success) {
      logger.info('Миграции базы данных выполнены успешно');
      
      // Запуск дополнительных миграций
      try {
        const wallPrivacyResult = await addWallPrivacyMigration();
        if (wallPrivacyResult.success) {
          logger.info('Миграция wall_privacy выполнена успешно');
        }
      } catch (err) {
        logger.error('Ошибка выполнения дополнительных миграций:', err);
      }
    } else {
      logger.error('Ошибка выполнения миграций:', result.error);
    }
  }).catch(err => {
    logger.error('Критическая ошибка при выполнении миграций:', err);
  });
  
  // Инициализация таблицы для отслеживания попыток входа
  createLoginAttemptsTable().then(() => {
    logger.info('Таблица login_attempts инициализирована');
  }).catch(err => {
    logger.error('Ошибка инициализации таблицы login_attempts:', err);
  });
  
  // Запуск планировщика очистки истекших токенов
  startTokenCleanupScheduler(1); // Очистка каждый час
  
  // Инициализация WebSocket
  initWebSocket(server);
  
  server.listen(PORT, () => {
    logger.info(`Сервер запущен на порту ${PORT}`, { 
      port: PORT, 
      env: process.env.NODE_ENV || 'development' 
    });
  });
}

export default app;
