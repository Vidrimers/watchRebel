import express from 'express';
import { v4 as uuidv4 } from 'uuid';
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

    const lists = listsResult.data.map(list => ({
      id: list.id,
      userId: list.user_id,
      name: list.name,
      mediaType: list.media_type,
      createdAt: list.created_at
    }));

    res.json(lists);

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

    if (existingItemCheck.data.length > 0) {
      const existingItem = existingItemCheck.data[0];
      return res.status(400).json({ 
        error: `Этот контент уже находится в списке "${existingItem.list_name}"`,
        code: 'ALREADY_IN_LIST',
        existingListId: existingItem.list_id,
        existingListName: existingItem.list_name
      });
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

    // Отправляем уведомления друзьям об активности
    // Не блокируем ответ, если уведомления не отправятся
    notifyFriendActivity(userId, 'added_to_list', {
      tmdbId,
      mediaType,
      title: `контент #${tmdbId}` // В реальном приложении нужно получить название из TMDb
    }).catch(err => {
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

    const items = itemsResult.data.map(item => ({
      id: item.id,
      listId: item.list_id,
      tmdbId: item.tmdb_id,
      mediaType: item.media_type,
      addedAt: item.added_at
    }));

    res.json(items);

  } catch (error) {
    console.error('Ошибка получения элементов списка:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR' 
    });
  }
});

export default router;
