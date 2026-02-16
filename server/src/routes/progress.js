import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/progress/:seriesId
 * Получить прогресс просмотра сериала
 * 
 * Params:
 * - seriesId: number (TMDb ID сериала)
 */
router.get('/:seriesId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { seriesId } = req.params;

    // Валидация seriesId
    const tmdbId = parseInt(seriesId, 10);
    if (isNaN(tmdbId)) {
      return res.status(400).json({ 
        error: 'ID сериала должен быть числом',
        code: 'INVALID_SERIES_ID' 
      });
    }

    // Получаем весь прогресс для данного сериала
    const progressResult = await executeQuery(
      `SELECT * FROM episode_progress 
       WHERE user_id = ? AND tmdb_id = ? 
       ORDER BY season_number, episode_number`,
      [userId, tmdbId]
    );

    if (!progressResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения прогресса',
        code: 'DATABASE_ERROR' 
      });
    }

    const progress = progressResult.data.map(p => ({
      id: p.id,
      userId: p.user_id,
      tmdbId: p.tmdb_id,
      seasonNumber: p.season_number,
      episodeNumber: p.episode_number,
      watchedAt: p.watched_at
    }));

    res.json(progress);

  } catch (error) {
    console.error('Ошибка получения прогресса сериала:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/progress
 * Отметить серию как просмотренную
 * 
 * Body:
 * - tmdbId: number (обязательно)
 * - seasonNumber: number (обязательно)
 * - episodeNumber: number (обязательно)
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { tmdbId, seasonNumber, episodeNumber } = req.body;

    // Валидация входных данных
    if (!tmdbId || typeof tmdbId !== 'number') {
      return res.status(400).json({ 
        error: 'tmdbId обязателен и должен быть числом',
        code: 'INVALID_TMDB_ID' 
      });
    }

    if (seasonNumber === undefined || seasonNumber === null || typeof seasonNumber !== 'number') {
      return res.status(400).json({ 
        error: 'seasonNumber обязателен и должен быть числом',
        code: 'INVALID_SEASON_NUMBER' 
      });
    }

    if (!episodeNumber || typeof episodeNumber !== 'number') {
      return res.status(400).json({ 
        error: 'episodeNumber обязателен и должен быть числом',
        code: 'INVALID_EPISODE_NUMBER' 
      });
    }

    // Проверяем, не отмечена ли уже эта серия
    const existingCheck = await executeQuery(
      `SELECT * FROM episode_progress 
       WHERE user_id = ? AND tmdb_id = ? AND season_number = ? AND episode_number = ?`,
      [userId, tmdbId, seasonNumber, episodeNumber]
    );

    if (!existingCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки существующего прогресса',
        code: 'DATABASE_ERROR' 
      });
    }

    // Если серия уже отмечена, возвращаем существующую запись
    if (existingCheck.data.length > 0) {
      const existing = existingCheck.data[0];
      return res.status(200).json({
        id: existing.id,
        userId: existing.user_id,
        tmdbId: existing.tmdb_id,
        seasonNumber: existing.season_number,
        episodeNumber: existing.episode_number,
        watchedAt: existing.watched_at
      });
    }

    // Создаем новую запись о прогрессе
    const progressId = uuidv4();

    const insertResult = await executeQuery(
      `INSERT INTO episode_progress (id, user_id, tmdb_id, season_number, episode_number)
       VALUES (?, ?, ?, ?, ?)`,
      [progressId, userId, tmdbId, seasonNumber, episodeNumber]
    );

    if (!insertResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка создания записи о прогрессе',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем созданную запись
    const progressResult = await executeQuery(
      'SELECT * FROM episode_progress WHERE id = ?',
      [progressId]
    );

    if (!progressResult.success || progressResult.data.length === 0) {
      return res.status(500).json({ 
        error: 'Ошибка получения созданного прогресса',
        code: 'DATABASE_ERROR' 
      });
    }

    const savedProgress = progressResult.data[0];

    res.status(201).json({
      id: savedProgress.id,
      userId: savedProgress.user_id,
      tmdbId: savedProgress.tmdb_id,
      seasonNumber: savedProgress.season_number,
      episodeNumber: savedProgress.episode_number,
      watchedAt: savedProgress.watched_at
    });

  } catch (error) {
    console.error('Ошибка создания записи о прогрессе:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * PUT /api/progress/:id
 * Обновить запись о прогрессе
 * 
 * Body:
 * - seasonNumber: number (опционально)
 * - episodeNumber: number (опционально)
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { seasonNumber, episodeNumber } = req.body;

    // Проверяем, существует ли запись и принадлежит ли она пользователю
    const progressCheck = await executeQuery(
      'SELECT * FROM episode_progress WHERE id = ?',
      [id]
    );

    if (!progressCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки прогресса',
        code: 'DATABASE_ERROR' 
      });
    }

    if (progressCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Запись о прогрессе не найдена',
        code: 'PROGRESS_NOT_FOUND' 
      });
    }

    const existingProgress = progressCheck.data[0];

    if (existingProgress.user_id !== userId) {
      return res.status(403).json({ 
        error: 'Нет прав на изменение этой записи',
        code: 'FORBIDDEN' 
      });
    }

    // Валидация новых значений
    if (seasonNumber !== undefined && (typeof seasonNumber !== 'number')) {
      return res.status(400).json({ 
        error: 'seasonNumber должен быть числом',
        code: 'INVALID_SEASON_NUMBER' 
      });
    }

    if (episodeNumber !== undefined && (typeof episodeNumber !== 'number')) {
      return res.status(400).json({ 
        error: 'episodeNumber должен быть числом',
        code: 'INVALID_EPISODE_NUMBER' 
      });
    }

    // Формируем запрос на обновление
    const updates = [];
    const params = [];

    if (seasonNumber !== undefined) {
      updates.push('season_number = ?');
      params.push(seasonNumber);
    }

    if (episodeNumber !== undefined) {
      updates.push('episode_number = ?');
      params.push(episodeNumber);
    }

    // Если нет изменений, возвращаем текущую запись
    if (updates.length === 0) {
      return res.json({
        id: existingProgress.id,
        userId: existingProgress.user_id,
        tmdbId: existingProgress.tmdb_id,
        seasonNumber: existingProgress.season_number,
        episodeNumber: existingProgress.episode_number,
        watchedAt: existingProgress.watched_at
      });
    }

    // Добавляем обновление времени
    updates.push('watched_at = CURRENT_TIMESTAMP');
    params.push(id);

    const updateQuery = `UPDATE episode_progress SET ${updates.join(', ')} WHERE id = ?`;

    const updateResult = await executeQuery(updateQuery, params);

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка обновления прогресса',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем обновленную запись
    const updatedProgressResult = await executeQuery(
      'SELECT * FROM episode_progress WHERE id = ?',
      [id]
    );

    if (!updatedProgressResult.success || updatedProgressResult.data.length === 0) {
      return res.status(500).json({ 
        error: 'Ошибка получения обновленного прогресса',
        code: 'DATABASE_ERROR' 
      });
    }

    const updatedProgress = updatedProgressResult.data[0];

    res.json({
      id: updatedProgress.id,
      userId: updatedProgress.user_id,
      tmdbId: updatedProgress.tmdb_id,
      seasonNumber: updatedProgress.season_number,
      episodeNumber: updatedProgress.episode_number,
      watchedAt: updatedProgress.watched_at
    });

  } catch (error) {
    console.error('Ошибка обновления прогресса:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

export default router;
