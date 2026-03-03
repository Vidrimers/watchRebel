import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { notifyImageComment, notifyCommentReply } from '../services/notificationService.js';

const router = express.Router();

/**
 * POST /api/images/:imageId/comments
 * Создать комментарий к изображению
 * Требует авторизации
 */
router.post('/:imageId/comments', authenticateToken, async (req, res) => {
  try {
    const { imageId } = req.params;
    const { content, parent_comment_id } = req.body;
    const userId = req.user.id;

    // Валидация контента
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Комментарий не может быть пустым',
        code: 'EMPTY_CONTENT'
      });
    }

    if (content.length > 500) {
      return res.status(400).json({ 
        error: 'Комментарий не может быть длиннее 500 символов',
        code: 'CONTENT_TOO_LONG'
      });
    }

    // Проверяем, существует ли изображение
    const imageResult = await executeQuery(
      'SELECT id, post_id FROM post_images WHERE id = ?',
      [imageId]
    );

    if (!imageResult.success || imageResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Изображение не найдено',
        code: 'IMAGE_NOT_FOUND'
      });
    }

    const image = imageResult.data[0];

    // Если указан parent_comment_id, проверяем его существование
    if (parent_comment_id) {
      const parentResult = await executeQuery(
        'SELECT id FROM image_comments WHERE id = ? AND image_id = ?',
        [parent_comment_id, imageId]
      );

      if (!parentResult.success || parentResult.data.length === 0) {
        return res.status(404).json({ 
          error: 'Родительский комментарий не найден',
          code: 'PARENT_COMMENT_NOT_FOUND'
        });
      }
    }

    // Создаем комментарий
    const commentId = uuidv4();
    const now = new Date().toISOString();

    const insertResult = await executeQuery(
      `INSERT INTO image_comments (id, image_id, user_id, parent_comment_id, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [commentId, imageId, userId, parent_comment_id || null, content.trim(), now]
    );

    if (!insertResult.success) {
      console.error('Ошибка создания комментария:', insertResult.error);
      return res.status(500).json({ 
        error: 'Не удалось создать комментарий',
        code: 'CREATE_FAILED'
      });
    }

    // Получаем созданный комментарий с данными автора
    const commentResult = await executeQuery(
      `SELECT 
        ic.*,
        u.id as author_id,
        u.display_name as author_display_name,
        u.avatar_url as author_avatar_url
       FROM image_comments ic
       LEFT JOIN users u ON ic.user_id = u.id
       WHERE ic.id = ?`,
      [commentId]
    );

    if (!commentResult.success || commentResult.data.length === 0) {
      return res.status(500).json({ 
        error: 'Не удалось получить созданный комментарий',
        code: 'FETCH_FAILED'
      });
    }

    const comment = commentResult.data[0];

    // Форматируем ответ
    const formattedComment = {
      id: comment.id,
      imageId: comment.image_id,
      parentCommentId: comment.parent_comment_id,
      content: comment.content,
      createdAt: comment.created_at,
      editedAt: comment.edited_at,
      author: {
        id: comment.author_id,
        displayName: comment.author_display_name,
        avatarUrl: comment.author_avatar_url
      }
    };

    // Отправляем уведомления
    try {
      if (parent_comment_id) {
        // Уведомление автору родительского комментария
        await notifyCommentReply(parent_comment_id, userId, image.post_id, imageId);
      } else {
        // Уведомление владельцу поста
        await notifyImageComment(image.post_id, imageId, userId);
      }
    } catch (notifyError) {
      console.error('Ошибка отправки уведомления:', notifyError);
      // Не прерываем выполнение, если уведомление не отправилось
    }

    res.status(201).json(formattedComment);
  } catch (error) {
    console.error('Ошибка создания комментария к изображению:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;

/**
 * GET /api/images/:imageId/comments
 * Получить все комментарии к изображению с вложенностью
 */
router.get('/:imageId/comments', async (req, res) => {
  try {
    const { imageId } = req.params;

    // Проверяем, существует ли изображение
    const imageResult = await executeQuery(
      'SELECT id FROM post_images WHERE id = ?',
      [imageId]
    );

    if (!imageResult.success || imageResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Изображение не найдено',
        code: 'IMAGE_NOT_FOUND'
      });
    }

    // Получаем все комментарии к изображению
    const commentsResult = await executeQuery(
      `SELECT 
        ic.*,
        u.id as author_id,
        u.display_name as author_display_name,
        u.avatar_url as author_avatar_url
       FROM image_comments ic
       LEFT JOIN users u ON ic.user_id = u.id
       WHERE ic.image_id = ?
       ORDER BY ic.created_at ASC`,
      [imageId]
    );

    if (!commentsResult.success) {
      console.error('Ошибка получения комментариев:', commentsResult.error);
      return res.status(500).json({ 
        error: 'Не удалось получить комментарии',
        code: 'FETCH_FAILED'
      });
    }

    // Форматируем комментарии
    const comments = commentsResult.data.map(comment => ({
      id: comment.id,
      imageId: comment.image_id,
      parentCommentId: comment.parent_comment_id,
      content: comment.content,
      createdAt: comment.created_at,
      editedAt: comment.edited_at,
      author: {
        id: comment.author_id,
        displayName: comment.author_display_name,
        avatarUrl: comment.author_avatar_url
      }
    }));

    // Строим дерево комментариев
    const buildCommentTree = (comments, parentId = null) => {
      return comments
        .filter(comment => comment.parentCommentId === parentId)
        .map(comment => ({
          ...comment,
          replies: buildCommentTree(comments, comment.id)
        }));
    };

    const commentTree = buildCommentTree(comments);

    res.json({
      comments: commentTree,
      total: comments.length
    });
  } catch (error) {
    console.error('Ошибка получения комментариев к изображению:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * PUT /api/images/comments/:commentId
 * Редактировать комментарий к изображению
 * Требует авторизации
 */
router.put('/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Валидация контента
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Комментарий не может быть пустым',
        code: 'EMPTY_CONTENT'
      });
    }

    if (content.length > 500) {
      return res.status(400).json({ 
        error: 'Комментарий не может быть длиннее 500 символов',
        code: 'CONTENT_TOO_LONG'
      });
    }

    // Проверяем, существует ли комментарий и принадлежит ли он пользователю
    const commentResult = await executeQuery(
      'SELECT id, user_id FROM image_comments WHERE id = ?',
      [commentId]
    );

    if (!commentResult.success || commentResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Комментарий не найден',
        code: 'COMMENT_NOT_FOUND'
      });
    }

    const comment = commentResult.data[0];

    if (comment.user_id !== userId) {
      return res.status(403).json({ 
        error: 'Нет прав для редактирования этого комментария',
        code: 'FORBIDDEN'
      });
    }

    // Обновляем комментарий
    const now = new Date().toISOString();
    const updateResult = await executeQuery(
      'UPDATE image_comments SET content = ?, edited_at = ? WHERE id = ?',
      [content.trim(), now, commentId]
    );

    if (!updateResult.success) {
      console.error('Ошибка обновления комментария:', updateResult.error);
      return res.status(500).json({ 
        error: 'Не удалось обновить комментарий',
        code: 'UPDATE_FAILED'
      });
    }

    // Получаем обновленный комментарий
    const updatedCommentResult = await executeQuery(
      `SELECT 
        ic.*,
        u.id as author_id,
        u.display_name as author_display_name,
        u.avatar_url as author_avatar_url
       FROM image_comments ic
       LEFT JOIN users u ON ic.user_id = u.id
       WHERE ic.id = ?`,
      [commentId]
    );

    if (!updatedCommentResult.success || updatedCommentResult.data.length === 0) {
      return res.status(500).json({ 
        error: 'Не удалось получить обновленный комментарий',
        code: 'FETCH_FAILED'
      });
    }

    const updatedComment = updatedCommentResult.data[0];

    res.json({
      id: updatedComment.id,
      imageId: updatedComment.image_id,
      parentCommentId: updatedComment.parent_comment_id,
      content: updatedComment.content,
      createdAt: updatedComment.created_at,
      editedAt: updatedComment.edited_at,
      author: {
        id: updatedComment.author_id,
        displayName: updatedComment.author_display_name,
        avatarUrl: updatedComment.author_avatar_url
      }
    });
  } catch (error) {
    console.error('Ошибка редактирования комментария:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * DELETE /api/images/comments/:commentId
 * Удалить комментарий к изображению
 * Требует авторизации
 */
router.delete('/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    // Проверяем, существует ли комментарий
    const commentResult = await executeQuery(
      `SELECT ic.*, pi.post_id, wp.user_id as post_owner_id
       FROM image_comments ic
       LEFT JOIN post_images pi ON ic.image_id = pi.id
       LEFT JOIN wall_posts wp ON pi.post_id = wp.id
       WHERE ic.id = ?`,
      [commentId]
    );

    if (!commentResult.success || commentResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Комментарий не найден',
        code: 'COMMENT_NOT_FOUND'
      });
    }

    const comment = commentResult.data[0];

    // Проверяем права: автор комментария или владелец поста
    if (comment.user_id !== userId && comment.post_owner_id !== userId) {
      return res.status(403).json({ 
        error: 'Нет прав для удаления этого комментария',
        code: 'FORBIDDEN'
      });
    }

    // Проверяем, есть ли ответы на этот комментарий
    const repliesResult = await executeQuery(
      'SELECT COUNT(*) as count FROM image_comments WHERE parent_comment_id = ?',
      [commentId]
    );

    const hasReplies = repliesResult.success && repliesResult.data[0].count > 0;

    if (hasReplies) {
      // Если есть ответы, заменяем контент на "[Комментарий удален]"
      const updateResult = await executeQuery(
        'UPDATE image_comments SET content = ? WHERE id = ?',
        ['[Комментарий удален]', commentId]
      );

      if (!updateResult.success) {
        console.error('Ошибка обновления комментария:', updateResult.error);
        return res.status(500).json({ 
          error: 'Не удалось удалить комментарий',
          code: 'DELETE_FAILED'
        });
      }

      res.json({ 
        message: 'Комментарий помечен как удаленный',
        deleted: false
      });
    } else {
      // Если нет ответов, удаляем комментарий полностью
      const deleteResult = await executeQuery(
        'DELETE FROM image_comments WHERE id = ?',
        [commentId]
      );

      if (!deleteResult.success) {
        console.error('Ошибка удаления комментария:', deleteResult.error);
        return res.status(500).json({ 
          error: 'Не удалось удалить комментарий',
          code: 'DELETE_FAILED'
        });
      }

      res.json({ 
        message: 'Комментарий удален',
        deleted: true
      });
    }
  } catch (error) {
    console.error('Ошибка удаления комментария:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});
