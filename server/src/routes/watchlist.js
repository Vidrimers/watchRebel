import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/watchlist
 * Получить список "Хочу посмотреть" текущего пользователя
 * 
 * Query params:
 * - mediaType: 'movie' | 'tv' (опционально, для фильтрации по типу)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { mediaType } = req.query;

    let query = 'SELECT * FROM watchlist WHERE user_id = ?';
    const params = [userId];

    if (mediaType && (mediaType === 'movie' || mediaType === 'tv')) {
      query += ' AND media_type = ?';
      params.push(mediaType);
    }

    query += ' ORDER BY added_at DESC';

    const watchlistResult = await executeQuery(query, params);

    if (!watchlistResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения списка желаемого',
        code: 'DATABASE_ERROR' 
      });
    }

    // Импортируем tmdbService для получения деталей медиа
    const tmdbService = (await import('../services/tmdbService.js')).default;

    // Обогащаем данные информацией из TMDb
    const enrichedItems = await Promise.all(
      watchlistResult.data.map(async (item) => {
        try {
          let mediaDetails;
          if (item.media_type === 'movie') {
            mediaDetails = await tmdbService.getMovieDetails(item.tmdb_id);
          } else {
            mediaDetails = await tmdbService.getTVDetails(item.tmdb_id);
          }

          return {
            id: item.id,
            userId: item.user_id,
            tmdbId: item.tmdb_id,
            mediaType: item.media_type,
            addedAt: item.added_at,
            // Добавляем данные из TMDb
            title: mediaDetails.title || mediaDetails.name,
            posterPath: mediaDetails.poster_path,
            releaseDate: mediaDetails.release_date || mediaDetails.first_air_date,
            voteAverage: mediaDetails.vote_average || 0,
            overview: mediaDetails.overview
          };
        } catch (error) {
          console.error(`Ошибка получения деталей для ${item.media_type} ${item.tmdb_id}:`, error);
          // Возвращаем базовые данные если не удалось получить детали
          return {
            id: item.id,
            userId: item.user_id,
            tmdbId: item.tmdb_id,
            mediaType: item.media_type,
            addedAt: item.added_at,
            title: 'Неизвестно',
            posterPath: null,
            releaseDate: null,
            voteAverage: 0,
            overview: null
          };
        }
      })
    );

    res.json(enrichedItems);

  } catch (error) {
    console.error('Ошибка получения списка желаемого:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/watchlist
 * Добавить контент в список "Хочу посмотреть"
 * 
 * Body:
 * - tmdbId: number (обязательно)
 * - mediaType: 'movie' | 'tv' (обязательно)
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { tmdbId, mediaType } = req.body;

    // Валидация входных данных
    if (!tmdbId || typeof tmdbId !== 'number') {
      return res.status(400).json({ 
        error: 'tmdbId обязателен и должен быть числом',
        code: 'INVALID_TMDB_ID' 
      });
    }

    if (!mediaType || (mediaType !== 'movie' && mediaType !== 'tv')) {
      return res.status(400).json({ 
        error: 'mediaType должен быть "movie" или "tv"',
        code: 'INVALID_MEDIA_TYPE' 
      });
    }

    // Проверяем, не находится ли контент уже в watchlist
    const existingCheck = await executeQuery(
      'SELECT * FROM watchlist WHERE user_id = ? AND tmdb_id = ? AND media_type = ?',
      [userId, tmdbId, mediaType]
    );

    if (!existingCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки существующих элементов',
        code: 'DATABASE_ERROR' 
      });
    }

    if (existingCheck.data.length > 0) {
      return res.status(400).json({ 
        error: 'Этот контент уже находится в списке желаемого',
        code: 'ALREADY_IN_WATCHLIST' 
      });
    }

    // Добавляем контент в watchlist
    const itemId = uuidv4();

    const insertResult = await executeQuery(
      'INSERT INTO watchlist (id, user_id, tmdb_id, media_type) VALUES (?, ?, ?, ?)',
      [itemId, userId, tmdbId, mediaType]
    );

    if (!insertResult.success) {
      // Проверяем, не нарушено ли ограничение уникальности
      if (insertResult.code === 'SQLITE_CONSTRAINT') {
        return res.status(400).json({ 
          error: 'Этот контент уже находится в списке',
          code: 'DUPLICATE_ITEM' 
        });
      }

      return res.status(500).json({ 
        error: 'Ошибка добавления контента',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем добавленный элемент
    const itemResult = await executeQuery(
      'SELECT * FROM watchlist WHERE id = ?',
      [itemId]
    );

    if (!itemResult.success || itemResult.data.length === 0) {
      return res.status(500).json({ 
        error: 'Ошибка получения добавленного элемента',
        code: 'DATABASE_ERROR' 
      });
    }

    const item = itemResult.data[0];

    res.status(201).json({
      id: item.id,
      userId: item.user_id,
      tmdbId: item.tmdb_id,
      mediaType: item.media_type,
      addedAt: item.added_at
    });

  } catch (error) {
    console.error('Ошибка добавления контента:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/watchlist/export
 * Экспортировать watchlist в различных форматах
 * 
 * Query params:
 * - format: 'json' | 'xlsx' | 'csv' | 'pdf' (обязательно)
 */
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { format } = req.query;

    // Валидация формата
    const validFormats = ['json', 'xlsx', 'csv', 'pdf'];
    if (!format || !validFormats.includes(format)) {
      return res.status(400).json({ 
        error: 'Формат должен быть одним из: json, xlsx, csv, pdf',
        code: 'INVALID_FORMAT' 
      });
    }

    // Увеличиваем timeout для больших списков
    req.setTimeout(60000); // 60 секунд

    // Получаем watchlist
    const watchlistResult = await executeQuery(
      'SELECT * FROM watchlist WHERE user_id = ? ORDER BY added_at DESC',
      [userId]
    );

    if (!watchlistResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения watchlist',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем рейтинги пользователя
    const ratingsResult = await executeQuery(
      'SELECT tmdb_id, media_type, rating FROM ratings WHERE user_id = ?',
      [userId]
    );

    const ratingsMap = {};
    if (ratingsResult.success) {
      ratingsResult.data.forEach(r => {
        ratingsMap[`${r.media_type}_${r.tmdb_id}`] = r.rating;
      });
    }

    // Получаем информацию о пользователе
    const userResult = await executeQuery(
      'SELECT display_name FROM users WHERE id = ?',
      [userId]
    );

    const userName = userResult.success && userResult.data.length > 0 
      ? userResult.data[0].display_name 
      : 'Пользователь';

    const tmdbService = (await import('../services/tmdbService.js')).default;

    // Собираем данные для экспорта
    const exportData = {
      exportDate: new Date().toISOString(),
      userName,
      watchlist: []
    };

    // Кэш для TMDb запросов
    const tmdbCache = new Map();

    // Функция для получения деталей с кэшированием
    const getMediaDetails = async (tmdbId, mediaType) => {
      const cacheKey = `${mediaType}_${tmdbId}`;
      
      if (tmdbCache.has(cacheKey)) {
        return tmdbCache.get(cacheKey);
      }

      try {
        let mediaDetails;
        if (mediaType === 'movie') {
          mediaDetails = await tmdbService.getMovieDetails(tmdbId);
        } else {
          mediaDetails = await tmdbService.getTVDetails(tmdbId);
        }
        
        tmdbCache.set(cacheKey, mediaDetails);
        return mediaDetails;
      } catch (error) {
        console.error(`Ошибка получения деталей для ${mediaType} ${tmdbId}:`, error);
        return null;
      }
    };

    const totalItems = watchlistResult.data.length;
    let processedItems = 0;

    // Обрабатываем watchlist
    for (const item of watchlistResult.data) {
      const mediaDetails = await getMediaDetails(item.tmdb_id, item.media_type);
      
      if (mediaDetails) {
        const genres = mediaDetails.genres 
          ? mediaDetails.genres.map(g => g.name).join(', ') 
          : '';

        const year = mediaDetails.release_date 
          ? new Date(mediaDetails.release_date).getFullYear()
          : (mediaDetails.first_air_date 
              ? new Date(mediaDetails.first_air_date).getFullYear() 
              : '');

        const myRating = ratingsMap[`${item.media_type}_${item.tmdb_id}`] || '';

        exportData.watchlist.push({
          title: mediaDetails.title || mediaDetails.name,
          mediaType: item.media_type === 'movie' ? 'Фильм' : 'Сериал',
          year,
          genres,
          tmdbRating: mediaDetails.vote_average || 0,
          myRating,
          addedAt: item.added_at,
          overview: mediaDetails.overview || ''
        });
      } else {
        exportData.watchlist.push({
          title: 'Неизвестно',
          mediaType: item.media_type === 'movie' ? 'Фильм' : 'Сериал',
          year: '',
          genres: '',
          tmdbRating: 0,
          myRating: ratingsMap[`${item.media_type}_${item.tmdb_id}`] || '',
          addedAt: item.added_at,
          overview: ''
        });
      }

      processedItems++;
      if (processedItems % 10 === 0) {
        console.log(`Экспорт watchlist: обработано ${processedItems} из ${totalItems} элементов`);
      }
    }

    console.log(`Экспорт watchlist завершен: обработано ${processedItems} элементов`);

    const dateStr = new Date().toISOString().split('T')[0];
    
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="watchrebel_watchlist_${dateStr}.json"`);
      
      return res.json({
        metadata: {
          exportDate: exportData.exportDate,
          userName: exportData.userName,
          totalItems: exportData.watchlist.length
        },
        watchlist: exportData.watchlist
      });
    }

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'watchRebel';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Хочу посмотреть');
      
      sheet.columns = [
        { header: 'Название', key: 'title', width: 40 },
        { header: 'Тип', key: 'mediaType', width: 15 },
        { header: 'Год', key: 'year', width: 10 },
        { header: 'Жанры', key: 'genres', width: 30 },
        { header: 'Рейтинг TMDb', key: 'tmdbRating', width: 15 },
        { header: 'Мой рейтинг', key: 'myRating', width: 15 },
        { header: 'Дата добавления', key: 'addedAt', width: 20 }
      ];

      exportData.watchlist.forEach(item => {
        sheet.addRow({
          title: item.title,
          mediaType: item.mediaType,
          year: item.year,
          genres: item.genres,
          tmdbRating: item.tmdbRating,
          myRating: item.myRating,
          addedAt: new Date(item.addedAt).toLocaleString('ru-RU')
        });
      });

      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="watchrebel_watchlist_${dateStr}.xlsx"`);
      
      await workbook.xlsx.write(res);
      return;
    }

    if (format === 'csv') {
      const rows = [];
      rows.push(['Название', 'Тип', 'Год', 'Жанры', 'Рейтинг TMDb', 'Мой рейтинг', 'Дата добавления']);

      exportData.watchlist.forEach(item => {
        rows.push([
          item.title,
          item.mediaType,
          item.year,
          item.genres,
          item.tmdbRating,
          item.myRating || '',
          new Date(item.addedAt).toLocaleString('ru-RU')
        ]);
      });

      const csvContent = rows.map(row => 
        row.map(cell => {
          const cellStr = String(cell || '');
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(',')
      ).join('\n');

      const bom = '\uFEFF';
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="watchrebel_watchlist_${dateStr}.csv"`);
      
      return res.send(bom + csvContent);
    }

    if (format === 'pdf') {
      const doc = new PDFDocument({ 
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="watchrebel_watchlist_${dateStr}.pdf"`);
      
      doc.pipe(res);

      doc.fontSize(24).text('watchRebel', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Хочу посмотреть`, { align: 'center' });
      doc.fontSize(10).text(`Пользователь: ${exportData.userName}`, { align: 'center' });
      doc.text(`Дата: ${new Date(exportData.exportDate).toLocaleString('ru-RU')}`, { align: 'center' });
      doc.moveDown(2);

      if (exportData.watchlist.length === 0) {
        doc.fontSize(10).text('Список пуст', { italic: true });
      } else {
        exportData.watchlist.forEach((item, index) => {
          if (doc.y > 700) {
            doc.addPage();
          }

          doc.fontSize(12).text(`${index + 1}. ${item.title}`, { continued: false });
          
          let details = `   Тип: ${item.mediaType} | Год: ${item.year || 'Н/Д'}`;
          details += ` | Жанры: ${item.genres || 'Н/Д'}`;
          details += ` | TMDb: ${item.tmdbRating || 'Н/Д'}`;
          if (item.myRating) {
            details += ` | Мой рейтинг: ${item.myRating}`;
          }
          
          doc.fontSize(9).text(details, { color: '#666666' });
          doc.moveDown(0.5);
        });
      }

      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).text(
          `Страница ${i + 1} из ${pages.count} | Экспортировано из watchRebel`,
          50,
          doc.page.height - 50,
          { align: 'center' }
        );
      }

      doc.end();
      return;
    }

  } catch (error) {
    console.error('Ошибка экспорта watchlist:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * DELETE /api/watchlist/:itemId
 * Удалить контент из списка желаемого
 */
router.delete('/:itemId', authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user.id;

    // Проверяем, существует ли элемент и принадлежит ли он пользователю
    const itemCheck = await executeQuery(
      'SELECT * FROM watchlist WHERE id = ?',
      [itemId]
    );

    if (!itemCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки элемента',
        code: 'DATABASE_ERROR' 
      });
    }

    if (itemCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Элемент не найден в списке желаемого',
        code: 'ITEM_NOT_FOUND' 
      });
    }

    const item = itemCheck.data[0];

    if (item.user_id !== userId) {
      return res.status(403).json({ 
        error: 'Нет прав на удаление этого элемента',
        code: 'FORBIDDEN' 
      });
    }

    // Удаляем элемент из watchlist
    const deleteResult = await executeQuery(
      'DELETE FROM watchlist WHERE id = ?',
      [itemId]
    );

    if (!deleteResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка удаления элемента из списка желаемого',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json({ 
      message: 'Элемент успешно удален из списка желаемого',
      itemId 
    });

  } catch (error) {
    console.error('Ошибка удаления элемента из списка желаемого:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

export default router;
