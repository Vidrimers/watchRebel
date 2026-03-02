import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { notifyFriendActivity } from '../services/notificationService.js';

const router = express.Router();

/**
 * GET /api/lists
 * Получить все пользовательские списки текущего пользователя
 * 
 * Query params:
 * - mediaType: 'movie' | 'tv' (опционально, для фильтрации по типу)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { mediaType } = req.query;

    let query = 'SELECT * FROM custom_lists WHERE user_id = ?';
    const params = [userId];

    if (mediaType && (mediaType === 'movie' || mediaType === 'tv')) {
      query += ' AND media_type = ?';
      params.push(mediaType);
    }

    query += ' ORDER BY created_at DESC';

    const listsResult = await executeQuery(query, params);

    if (!listsResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения списков',
        code: 'DATABASE_ERROR' 
      });
    }

    // Для каждого списка получаем его элементы
    const tmdbService = (await import('../services/tmdbService.js')).default;
    
    const listsWithItems = await Promise.all(
      listsResult.data.map(async (list) => {
        const itemsResult = await executeQuery(
          'SELECT * FROM list_items WHERE list_id = ? ORDER BY added_at DESC',
          [list.id]
        );

        let items = [];
        if (itemsResult.success) {
          // Обогащаем данные информацией из TMDb
          items = await Promise.all(
            itemsResult.data.map(async (item) => {
              try {
                let mediaDetails;
                if (item.media_type === 'movie') {
                  mediaDetails = await tmdbService.getMovieDetails(item.tmdb_id);
                } else {
                  mediaDetails = await tmdbService.getTVDetails(item.tmdb_id);
                }

                return {
                  id: item.id,
                  listId: item.list_id,
                  tmdbId: item.tmdb_id,
                  mediaType: item.media_type,
                  addedAt: item.added_at,
                  title: mediaDetails.title || mediaDetails.name,
                  posterPath: mediaDetails.poster_path,
                  releaseDate: mediaDetails.release_date || mediaDetails.first_air_date,
                  voteAverage: mediaDetails.vote_average || 0,
                  overview: mediaDetails.overview
                };
              } catch (error) {
                console.error(`Ошибка получения деталей для ${item.media_type} ${item.tmdb_id}:`, error);
                return {
                  id: item.id,
                  listId: item.list_id,
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
        }

        return {
          id: list.id,
          userId: list.user_id,
          name: list.name,
          mediaType: list.media_type,
          createdAt: list.created_at,
          items
        };
      })
    );

    res.json(listsWithItems);

  } catch (error) {
    console.error('Ошибка получения списков:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/lists
 * Создать новый пользовательский список
 * 
 * Body:
 * - name: string (обязательно)
 * - mediaType: 'movie' | 'tv' (обязательно)
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, mediaType } = req.body;

    // Валидация входных данных
    if (!name || !name.trim()) {
      return res.status(400).json({ 
        error: 'Название списка не может быть пустым',
        code: 'EMPTY_NAME' 
      });
    }

    if (!mediaType || (mediaType !== 'movie' && mediaType !== 'tv')) {
      return res.status(400).json({ 
        error: 'mediaType должен быть "movie" или "tv"',
        code: 'INVALID_MEDIA_TYPE' 
      });
    }

    // Создаем новый список
    const listId = uuidv4();

    const insertResult = await executeQuery(
      'INSERT INTO custom_lists (id, user_id, name, media_type) VALUES (?, ?, ?, ?)',
      [listId, userId, name.trim(), mediaType]
    );

    if (!insertResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка создания списка',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем созданный список
    const listResult = await executeQuery(
      'SELECT * FROM custom_lists WHERE id = ?',
      [listId]
    );

    if (!listResult.success || listResult.data.length === 0) {
      return res.status(500).json({ 
        error: 'Ошибка получения созданного списка',
        code: 'DATABASE_ERROR' 
      });
    }

    const list = listResult.data[0];

    res.status(201).json({
      id: list.id,
      userId: list.user_id,
      name: list.name,
      mediaType: list.media_type,
      createdAt: list.created_at
    });

  } catch (error) {
    console.error('Ошибка создания списка:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * PUT /api/lists/:id
 * Переименовать пользовательский список
 * Пользователь может переименовать только свой список
 * 
 * Body:
 * - name: string (обязательно)
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name } = req.body;

    // Валидация входных данных
    if (!name || !name.trim()) {
      return res.status(400).json({ 
        error: 'Название списка не может быть пустым',
        code: 'EMPTY_NAME' 
      });
    }

    // Проверяем, существует ли список и принадлежит ли он пользователю
    const listCheck = await executeQuery(
      'SELECT * FROM custom_lists WHERE id = ?',
      [id]
    );

    if (!listCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки списка',
        code: 'DATABASE_ERROR' 
      });
    }

    if (listCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Список не найден',
        code: 'LIST_NOT_FOUND' 
      });
    }

    const list = listCheck.data[0];

    if (list.user_id !== userId) {
      return res.status(403).json({ 
        error: 'Нет прав на изменение этого списка',
        code: 'FORBIDDEN' 
      });
    }

    // Обновляем название списка
    const updateResult = await executeQuery(
      'UPDATE custom_lists SET name = ? WHERE id = ?',
      [name.trim(), id]
    );

    if (!updateResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка обновления списка',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем обновленный список
    const updatedListResult = await executeQuery(
      'SELECT * FROM custom_lists WHERE id = ?',
      [id]
    );

    if (!updatedListResult.success || updatedListResult.data.length === 0) {
      return res.status(500).json({ 
        error: 'Ошибка получения обновленного списка',
        code: 'DATABASE_ERROR' 
      });
    }

    const updatedList = updatedListResult.data[0];

    res.json({
      id: updatedList.id,
      userId: updatedList.user_id,
      name: updatedList.name,
      mediaType: updatedList.media_type,
      createdAt: updatedList.created_at
    });

  } catch (error) {
    console.error('Ошибка переименования списка:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * DELETE /api/lists/:id
 * Удалить пользовательский список
 * Пользователь может удалить только свой список
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Проверяем, существует ли список и принадлежит ли он пользователю
    const listCheck = await executeQuery(
      'SELECT * FROM custom_lists WHERE id = ?',
      [id]
    );

    if (!listCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки списка',
        code: 'DATABASE_ERROR' 
      });
    }

    if (listCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Список не найден',
        code: 'LIST_NOT_FOUND' 
      });
    }

    const list = listCheck.data[0];

    if (list.user_id !== userId) {
      return res.status(403).json({ 
        error: 'Нет прав на удаление этого списка',
        code: 'FORBIDDEN' 
      });
    }

    // Удаляем список (элементы списка удалятся автоматически благодаря ON DELETE CASCADE)
    const deleteResult = await executeQuery(
      'DELETE FROM custom_lists WHERE id = ?',
      [id]
    );

    if (!deleteResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка удаления списка',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json({ 
      message: 'Список успешно удален',
      id 
    });

  } catch (error) {
    console.error('Ошибка удаления списка:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * POST /api/lists/:id/items
 * Добавить контент в список
 * 
 * Body:
 * - tmdbId: number (обязательно)
 * - mediaType: 'movie' | 'tv' (обязательно)
 */
router.post('/:id/items', authenticateToken, async (req, res) => {
  try {
    const listId = req.params.id;
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

    // Проверяем, существует ли список и принадлежит ли он пользователю
    const listCheck = await executeQuery(
      'SELECT * FROM custom_lists WHERE id = ?',
      [listId]
    );

    if (!listCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки списка',
        code: 'DATABASE_ERROR' 
      });
    }

    if (listCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Список не найден',
        code: 'LIST_NOT_FOUND' 
      });
    }

    const list = listCheck.data[0];

    if (list.user_id !== userId) {
      return res.status(403).json({ 
        error: 'Нет прав на добавление в этот список',
        code: 'FORBIDDEN' 
      });
    }

    // Проверяем, что mediaType соответствует типу списка
    if (list.media_type !== mediaType) {
      return res.status(400).json({ 
        error: `Этот список предназначен для ${list.media_type === 'movie' ? 'фильмов' : 'сериалов'}`,
        code: 'MEDIA_TYPE_MISMATCH' 
      });
    }

    // Проверяем, не находится ли контент уже в другом списке пользователя
    // Требование 3.3: контент может быть только в одном списке одновременно
    const existingItemCheck = await executeQuery(
      `SELECT li.*, cl.name as list_name 
       FROM list_items li
       JOIN custom_lists cl ON li.list_id = cl.id
       WHERE cl.user_id = ? AND li.tmdb_id = ? AND li.media_type = ?`,
      [userId, tmdbId, mediaType]
    );

    if (!existingItemCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки существующих элементов',
        code: 'DATABASE_ERROR' 
      });
    }

    // Если элемент уже в другом списке - автоматически удаляем его оттуда
    if (existingItemCheck.data.length > 0) {
      const existingItem = existingItemCheck.data[0];
      
      // Если это тот же список - возвращаем ошибку
      if (existingItem.list_id === listId) {
        return res.status(400).json({ 
          error: `Этот контент уже находится в данном списке`,
          code: 'ALREADY_IN_LIST',
          existingListId: existingItem.list_id,
          existingListName: existingItem.list_name
        });
      }
      
      // Удаляем из старого списка
      console.log(`Автоматическое удаление ${tmdbId} из списка "${existingItem.list_name}" перед добавлением в новый список`);
      await executeQuery(
        'DELETE FROM list_items WHERE id = ?',
        [existingItem.id]
      );
    }

    // Добавляем контент в список
    const itemId = uuidv4();

    const insertResult = await executeQuery(
      'INSERT INTO list_items (id, list_id, tmdb_id, media_type) VALUES (?, ?, ?, ?)',
      [itemId, listId, tmdbId, mediaType]
    );

    if (!insertResult.success) {
      // Проверяем, не нарушено ли ограничение уникальности
      if (insertResult.code === 'SQLITE_CONSTRAINT') {
        return res.status(400).json({ 
          error: 'Этот контент уже находится в данном списке',
          code: 'DUPLICATE_ITEM' 
        });
      }

      return res.status(500).json({ 
        error: 'Ошибка добавления контента в список',
        code: 'DATABASE_ERROR' 
      });
    }

    // Получаем добавленный элемент
    const itemResult = await executeQuery(
      'SELECT * FROM list_items WHERE id = ?',
      [itemId]
    );

    if (!itemResult.success || itemResult.data.length === 0) {
      return res.status(500).json({ 
        error: 'Ошибка получения добавленного элемента',
        code: 'DATABASE_ERROR' 
      });
    }

    const item = itemResult.data[0];

    // Автоматически удаляем из "Хочу посмотреть" если там есть
    // Не блокируем ответ, если удаление не удастся
    try {
      await executeQuery(
        'DELETE FROM watchlist WHERE user_id = ? AND tmdb_id = ? AND media_type = ?',
        [userId, tmdbId, mediaType]
      );
      console.log(`Элемент ${tmdbId} автоматически удален из watchlist пользователя ${userId}`);
    } catch (err) {
      console.error('Ошибка удаления из watchlist:', err);
      // Не прерываем выполнение, это не критично
    }

    // Получаем название контента из TMDb для уведомления
    let mediaTitle = `контент #${tmdbId}`;
    let posterPath = null;
    let localPosterPath = null;
    try {
      const tmdbService = (await import('../services/tmdbService.js')).default;
      const { downloadImage } = await import('../utils/imageDownloader.js');
      
      let mediaDetails;
      if (mediaType === 'movie') {
        mediaDetails = await tmdbService.getMovieDetails(tmdbId);
        mediaTitle = mediaDetails.title;
        posterPath = mediaDetails.poster_path;
        console.log(`✅ Получено название фильма из TMDb: "${mediaTitle}"`);
      } else {
        mediaDetails = await tmdbService.getTVDetails(tmdbId);
        mediaTitle = mediaDetails.name;
        posterPath = mediaDetails.poster_path;
        console.log(`✅ Получено название сериала из TMDb: "${mediaTitle}"`);
      }

      // Скачиваем постер на сервер
      if (posterPath) {
        try {
          localPosterPath = await downloadImage(posterPath, 'posters');
          console.log(`✅ Постер сохранен локально: ${localPosterPath}`);
        } catch (err) {
          console.error('⚠️  Ошибка скачивания постера:', err.message);
          // Используем TMDb URL если не удалось скачать
          localPosterPath = posterPath;
        }
      }
    } catch (err) {
      console.error('❌ Ошибка получения названия из TMDb:', err);
      console.error('❌ Будет использовано дефолтное название:', mediaTitle);
    }

    // Создаем пост на стене о добавлении медиа в список
    let postId = null;
    try {
      postId = uuidv4();
      
      console.log('📝 Данные для создания поста:');
      console.log('  - mediaTitle:', mediaTitle);
      console.log('  - list.name:', list.name);
      console.log('  - list.id:', list.id);
      console.log('  - tmdbId:', tmdbId);
      console.log('  - posterPath:', posterPath);
      console.log('  - localPosterPath:', localPosterPath);
      
      const postContent = `${mediaTitle}\nДобавил в список: ${list.name}`;
      
      console.log('📝 Сформированный postContent:', postContent);
      
      console.log('Создание поста на стене:', {
        postId,
        userId,
        wallOwnerId: userId,
        postType: 'media_added',
        content: postContent,
        tmdbId,
        mediaType,
        posterPath: localPosterPath || posterPath,
        listId: list.id
      });
      
      const insertResult = await executeQuery(
        `INSERT INTO wall_posts (id, user_id, wall_owner_id, post_type, content, tmdb_id, media_type, poster_path, list_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [postId, userId, userId, 'media_added', postContent, tmdbId, mediaType, localPosterPath || posterPath, list.id]
      );
      
      if (insertResult.success) {
        console.log(`✅ Создан пост на стене: ${postId} для медиа ${tmdbId}`);
      } else {
        console.error('❌ Ошибка вставки поста:', insertResult);
      }
    } catch (err) {
      console.error('❌ Ошибка создания поста на стене:', err);
      // Не блокируем добавление в список если пост не создался
    }

    // Отправляем уведомления друзьям об активности
    // Передаем postId для корректной навигации
    // Не блокируем ответ, если уведомления не отправятся
    notifyFriendActivity(userId, 'added_to_list', {
      tmdbId,
      mediaType,
      title: mediaTitle
    }, postId).catch(err => {
      console.error('Ошибка отправки уведомлений друзьям:', err);
    });

    res.status(201).json({
      id: item.id,
      listId: item.list_id,
      tmdbId: item.tmdb_id,
      mediaType: item.media_type,
      addedAt: item.added_at
    });

  } catch (error) {
    console.error('Ошибка добавления контента в список:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * DELETE /api/lists/:id/items/:itemId
 * Удалить контент из списка
 */
router.delete('/:id/items/:itemId', authenticateToken, async (req, res) => {
  try {
    const { id: listId, itemId } = req.params;
    const userId = req.user.id;

    // Проверяем, существует ли список и принадлежит ли он пользователю
    const listCheck = await executeQuery(
      'SELECT * FROM custom_lists WHERE id = ?',
      [listId]
    );

    if (!listCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки списка',
        code: 'DATABASE_ERROR' 
      });
    }

    if (listCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Список не найден',
        code: 'LIST_NOT_FOUND' 
      });
    }

    const list = listCheck.data[0];

    if (list.user_id !== userId) {
      return res.status(403).json({ 
        error: 'Нет прав на удаление из этого списка',
        code: 'FORBIDDEN' 
      });
    }

    // Проверяем, существует ли элемент в этом списке
    const itemCheck = await executeQuery(
      'SELECT * FROM list_items WHERE id = ? AND list_id = ?',
      [itemId, listId]
    );

    if (!itemCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки элемента',
        code: 'DATABASE_ERROR' 
      });
    }

    if (itemCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Элемент не найден в этом списке',
        code: 'ITEM_NOT_FOUND' 
      });
    }

    // Удаляем элемент из списка
    const deleteResult = await executeQuery(
      'DELETE FROM list_items WHERE id = ?',
      [itemId]
    );

    if (!deleteResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка удаления элемента из списка',
        code: 'DATABASE_ERROR' 
      });
    }

    res.json({ 
      message: 'Элемент успешно удален из списка',
      itemId 
    });

  } catch (error) {
    console.error('Ошибка удаления элемента из списка:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/lists/export
 * Экспортировать все списки пользователя в различных форматах
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

    // Получаем все списки пользователя
    const listsResult = await executeQuery(
      'SELECT * FROM custom_lists WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    if (!listsResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения списков',
        code: 'DATABASE_ERROR' 
      });
    }

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
      lists: [],
      watchlist: []
    };

    // Кэш для TMDb запросов (чтобы не запрашивать один и тот же фильм дважды)
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

    // Подсчитываем общее количество элементов для прогресса
    let totalItems = watchlistResult.data.length;
    listsResult.data.forEach(list => {
      // Получаем количество элементов в каждом списке
      totalItems += list.items?.length || 0;
    });

    let processedItems = 0;

    // Обрабатываем каждый список
    for (const list of listsResult.data) {
      const itemsResult = await executeQuery(
        'SELECT * FROM list_items WHERE list_id = ? ORDER BY added_at DESC',
        [list.id]
      );

      const items = [];
      if (itemsResult.success) {
        for (const item of itemsResult.data) {
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

            items.push({
              title: mediaDetails.title || mediaDetails.name,
              year,
              genres,
              tmdbRating: mediaDetails.vote_average || 0,
              myRating,
              addedAt: item.added_at,
              overview: mediaDetails.overview || ''
            });
          } else {
            items.push({
              title: 'Неизвестно',
              year: '',
              genres: '',
              tmdbRating: 0,
              myRating: ratingsMap[`${item.media_type}_${item.tmdb_id}`] || '',
              addedAt: item.added_at,
              overview: ''
            });
          }

          processedItems++;
          // Логируем прогресс каждые 10 элементов
          if (processedItems % 10 === 0) {
            console.log(`Экспорт: обработано ${processedItems} из ${totalItems} элементов`);
          }
        }
      }

      exportData.lists.push({
        name: list.name,
        mediaType: list.media_type === 'movie' ? 'Фильмы' : 'Сериалы',
        createdAt: list.created_at,
        items
      });
    }

    // Обрабатываем watchlist
    if (watchlistResult.success) {
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
          console.log(`Экспорт: обработано ${processedItems} из ${totalItems} элементов`);
        }
      }
    }

    console.log(`Экспорт завершен: обработано ${processedItems} элементов`);

    // Передаем данные в соответствующий обработчик формата
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (format === 'json') {
      // JSON экспорт
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="watchrebel_lists_${dateStr}.json"`);
      
      return res.json({
        metadata: {
          exportDate: exportData.exportDate,
          userName: exportData.userName,
          totalLists: exportData.lists.length,
          totalWatchlistItems: exportData.watchlist.length
        },
        lists: exportData.lists,
        watchlist: exportData.watchlist
      });
    }

    if (format === 'xlsx') {
      // Excel экспорт
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'watchRebel';
      workbook.created = new Date();

      // Первый лист - Сводка
      const summarySheet = workbook.addWorksheet('Сводка');
      summarySheet.columns = [
        { header: 'Параметр', key: 'param', width: 30 },
        { header: 'Значение', key: 'value', width: 30 }
      ];

      summarySheet.addRow({ param: 'Пользователь', value: exportData.userName });
      summarySheet.addRow({ param: 'Дата экспорта', value: new Date(exportData.exportDate).toLocaleString('ru-RU') });
      summarySheet.addRow({ param: 'Всего списков', value: exportData.lists.length });
      summarySheet.addRow({ param: 'Элементов в Watchlist', value: exportData.watchlist.length });
      
      let totalItems = 0;
      exportData.lists.forEach(list => {
        totalItems += list.items.length;
      });
      summarySheet.addRow({ param: 'Всего элементов в списках', value: totalItems });

      // Форматирование заголовков
      summarySheet.getRow(1).font = { bold: true };
      summarySheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Создаем лист для каждого списка
      exportData.lists.forEach(list => {
        const sheet = workbook.addWorksheet(list.name.substring(0, 31)); // Excel ограничение на длину имени листа
        
        sheet.columns = [
          { header: 'Название', key: 'title', width: 40 },
          { header: 'Год', key: 'year', width: 10 },
          { header: 'Жанры', key: 'genres', width: 30 },
          { header: 'Рейтинг TMDb', key: 'tmdbRating', width: 15 },
          { header: 'Мой рейтинг', key: 'myRating', width: 15 },
          { header: 'Дата добавления', key: 'addedAt', width: 20 }
        ];

        list.items.forEach(item => {
          sheet.addRow({
            title: item.title,
            year: item.year,
            genres: item.genres,
            tmdbRating: item.tmdbRating,
            myRating: item.myRating,
            addedAt: new Date(item.addedAt).toLocaleString('ru-RU')
          });
        });

        // Форматирование заголовков
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
      });

      // Создаем лист для Watchlist
      if (exportData.watchlist.length > 0) {
        const watchlistSheet = workbook.addWorksheet('Хочу посмотреть');
        
        watchlistSheet.columns = [
          { header: 'Название', key: 'title', width: 40 },
          { header: 'Тип', key: 'mediaType', width: 15 },
          { header: 'Год', key: 'year', width: 10 },
          { header: 'Жанры', key: 'genres', width: 30 },
          { header: 'Рейтинг TMDb', key: 'tmdbRating', width: 15 },
          { header: 'Дата добавления', key: 'addedAt', width: 20 }
        ];

        exportData.watchlist.forEach(item => {
          watchlistSheet.addRow({
            title: item.title,
            mediaType: item.mediaType,
            year: item.year,
            genres: item.genres,
            tmdbRating: item.tmdbRating,
            addedAt: new Date(item.addedAt).toLocaleString('ru-RU')
          });
        });

        // Форматирование заголовков
        watchlistSheet.getRow(1).font = { bold: true };
        watchlistSheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
      }

      // Отправляем файл
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="watchrebel_lists_${dateStr}.xlsx"`);
      
      await workbook.xlsx.write(res);
      return;
    }

    if (format === 'csv') {
      // CSV экспорт - все списки в одном файле
      const rows = [];
      
      // Заголовок
      rows.push(['Список', 'Тип', 'Название', 'Год', 'Жанры', 'Рейтинг TMDb', 'Мой рейтинг', 'Дата добавления']);

      // Добавляем элементы из всех списков
      exportData.lists.forEach(list => {
        list.items.forEach(item => {
          rows.push([
            list.name,
            list.mediaType,
            item.title,
            item.year,
            item.genres,
            item.tmdbRating,
            item.myRating,
            new Date(item.addedAt).toLocaleString('ru-RU')
          ]);
        });
      });

      // Добавляем элементы из watchlist
      exportData.watchlist.forEach(item => {
        rows.push([
          'Хочу посмотреть',
          item.mediaType,
          item.title,
          item.year,
          item.genres,
          item.tmdbRating,
          item.myRating || '',
          new Date(item.addedAt).toLocaleString('ru-RU')
        ]);
      });

      // Формируем CSV с правильной обработкой кавычек и запятых
      const csvContent = rows.map(row => 
        row.map(cell => {
          const cellStr = String(cell || '');
          // Экранируем кавычки и оборачиваем в кавычки если есть запятые или кавычки
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(',')
      ).join('\n');

      // UTF-8 BOM для корректного открытия в Excel
      const bom = '\uFEFF';
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="watchrebel_lists_${dateStr}.csv"`);
      
      return res.send(bom + csvContent);
    }

    if (format === 'pdf') {
      // PDF экспорт
      const doc = new PDFDocument({ 
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="watchrebel_lists_${dateStr}.pdf"`);
      
      doc.pipe(res);

      // Заголовок документа
      doc.fontSize(24).text('watchRebel', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Экспорт списков`, { align: 'center' });
      doc.fontSize(10).text(`Пользователь: ${exportData.userName}`, { align: 'center' });
      doc.text(`Дата: ${new Date(exportData.exportDate).toLocaleString('ru-RU')}`, { align: 'center' });
      doc.moveDown(2);

      // Функция для добавления таблицы
      const addTable = (title, items, includeMediaType = false) => {
        // Проверяем, нужна ли новая страница
        if (doc.y > 650) {
          doc.addPage();
        }

        doc.fontSize(16).text(title, { underline: true });
        doc.moveDown(0.5);

        if (items.length === 0) {
          doc.fontSize(10).text('Нет элементов', { italic: true });
          doc.moveDown(1);
          return;
        }

        items.forEach((item, index) => {
          // Проверяем, нужна ли новая страница
          if (doc.y > 700) {
            doc.addPage();
          }

          doc.fontSize(12).text(`${index + 1}. ${item.title}`, { continued: false });
          
          let details = `   Год: ${item.year || 'Н/Д'}`;
          if (includeMediaType) {
            details += ` | Тип: ${item.mediaType}`;
          }
          details += ` | Жанры: ${item.genres || 'Н/Д'}`;
          details += ` | TMDb: ${item.tmdbRating || 'Н/Д'}`;
          if (item.myRating) {
            details += ` | Мой рейтинг: ${item.myRating}`;
          }
          
          doc.fontSize(9).text(details, { color: '#666666' });
          doc.moveDown(0.5);
        });

        doc.moveDown(1);
      };

      // Добавляем каждый список
      exportData.lists.forEach(list => {
        addTable(`${list.name} (${list.mediaType})`, list.items);
      });

      // Добавляем watchlist
      if (exportData.watchlist.length > 0) {
        addTable('Хочу посмотреть', exportData.watchlist, true);
      }

      // Футер на последней странице
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

    // Вызываем следующий middleware в зависимости от формата
    return res.json({ message: 'Export endpoint created, format handlers to be implemented', exportData });

  } catch (error) {
    console.error('Ошибка экспорта списков:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/lists/:id/items
 * Получить все элементы списка
 */
router.get('/:id/items', authenticateToken, async (req, res) => {
  try {
    const listId = req.params.id;
    const userId = req.user.id;

    // Проверяем, существует ли список
    const listCheck = await executeQuery(
      'SELECT * FROM custom_lists WHERE id = ?',
      [listId]
    );

    if (!listCheck.success) {
      return res.status(500).json({ 
        error: 'Ошибка проверки списка',
        code: 'DATABASE_ERROR' 
      });
    }

    if (listCheck.data.length === 0) {
      return res.status(404).json({ 
        error: 'Список не найден',
        code: 'LIST_NOT_FOUND' 
      });
    }

    const list = listCheck.data[0];

    // Пользователь может просматривать только свои списки
    // (в будущем можно добавить публичные списки)
    if (list.user_id !== userId) {
      return res.status(403).json({ 
        error: 'Нет прав на просмотр этого списка',
        code: 'FORBIDDEN' 
      });
    }

    // Получаем все элементы списка
    const itemsResult = await executeQuery(
      'SELECT * FROM list_items WHERE list_id = ? ORDER BY added_at DESC',
      [listId]
    );

    if (!itemsResult.success) {
      return res.status(500).json({ 
        error: 'Ошибка получения элементов списка',
        code: 'DATABASE_ERROR' 
      });
    }

    // Импортируем tmdbService для получения деталей медиа
    const tmdbService = (await import('../services/tmdbService.js')).default;

    // Обогащаем данные информацией из TMDb
    const enrichedItems = await Promise.all(
      itemsResult.data.map(async (item) => {
        try {
          let mediaDetails;
          if (item.media_type === 'movie') {
            mediaDetails = await tmdbService.getMovieDetails(item.tmdb_id);
          } else {
            mediaDetails = await tmdbService.getTVDetails(item.tmdb_id);
          }

          return {
            id: item.id,
            listId: item.list_id,
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
            listId: item.list_id,
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
    console.error('Ошибка получения элементов списка:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

export default router;
