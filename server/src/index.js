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

// Загрузка переменных окружения
dotenv.config();

const app = express();
const PORT = process.env.PORT || 1313;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/lists', listsRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/wall', wallRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/notifications', notificationsRoutes);

// Базовый route для проверки
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'watchRebel API работает' });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Что-то пошло не так!' });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});

export default app;
