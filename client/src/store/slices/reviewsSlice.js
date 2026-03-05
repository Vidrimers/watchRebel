import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api, { APIError, NetworkError } from '../../services/api';

// Вспомогательная функция для обработки ошибок
const handleError = (error, rejectWithValue) => {
  if (error instanceof APIError) {
    return rejectWithValue(error.data || error.message);
  } else if (error instanceof NetworkError) {
    return rejectWithValue({ message: error.message });
  }
  return rejectWithValue({ message: 'Неизвестная ошибка' });
};

/**
 * Создать отзыв на фильм/сериал
 */
export const createReview = createAsyncThunk(
  'reviews/createReview',
  async ({ tmdbId, mediaType, reviewText, rating }, { rejectWithValue }) => {
    try {
      const response = await api.post('/reviews', {
        tmdbId,
        mediaType,
        reviewText,
        rating
      });
      return response.data;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

/**
 * Получить отзыв пользователя на конкретный фильм/сериал
 */
export const fetchUserReview = createAsyncThunk(
  'reviews/fetchUserReview',
  async ({ userId, tmdbId, mediaType }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/reviews/user/${userId}/media/${tmdbId}`, {
        params: { mediaType }
      });
      return response.data;
    } catch (error) {
      // Если отзыв не найден (404), это не ошибка - просто нет отзыва
      if (error instanceof APIError && error.status === 404) {
        return null;
      }
      return handleError(error, rejectWithValue);
    }
  }
);

/**
 * Обновить отзыв
 */
export const updateReview = createAsyncThunk(
  'reviews/updateReview',
  async ({ reviewId, tmdbId, mediaType, reviewText, rating }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/reviews/${reviewId}`, {
        tmdbId,
        mediaType,
        reviewText,
        rating
      });
      return response.data;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

/**
 * Удалить отзыв
 */
export const deleteReview = createAsyncThunk(
  'reviews/deleteReview',
  async ({ reviewId }, { rejectWithValue }) => {
    try {
      await api.delete(`/reviews/${reviewId}`);
      return reviewId;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

/**
 * Получить отзыв по postId (для страницы с отзывом)
 */
export const fetchReviewByPost = createAsyncThunk(
  'reviews/fetchReviewByPost',
  async (postId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/reviews/post/${postId}`);
      return response.data;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

const reviewsSlice = createSlice({
  name: 'reviews',
  initialState: {
    currentReview: null, // Текущий просматриваемый отзыв
    userReviews: {}, // Отзывы пользователя по ключу "tmdbId_mediaType"
    loading: false,
    error: null,
    lastAction: null
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentReview: (state) => {
      state.currentReview = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Создание отзыва
      .addCase(createReview.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.lastAction = 'create';
      })
      .addCase(createReview.fulfilled, (state, action) => {
        state.loading = false;
        const review = action.payload;
        const key = `${review.tmdbId}_${review.mediaType}`;
        state.userReviews[key] = review;
        state.lastAction = 'create_success';
      })
      .addCase(createReview.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.payload?.error || 'Ошибка создания отзыва';
        state.lastAction = 'create_error';
      })

      // Получение отзыва пользователя
      .addCase(fetchUserReview.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserReview.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          const review = action.payload;
          const key = `${review.tmdbId}_${review.mediaType}`;
          state.userReviews[key] = review;
        }
      })
      .addCase(fetchUserReview.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Ошибка загрузки отзыва';
      })

      // Обновление отзыва
      .addCase(updateReview.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.lastAction = 'update';
      })
      .addCase(updateReview.fulfilled, (state, action) => {
        state.loading = false;
        const review = action.payload;
        const key = `${review.tmdbId}_${review.mediaType}`;
        state.userReviews[key] = review;
        state.lastAction = 'update_success';
      })
      .addCase(updateReview.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.payload?.error || 'Ошибка обновления отзыва';
        state.lastAction = 'update_error';
      })

      // Удаление отзыва
      .addCase(deleteReview.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.lastAction = 'delete';
      })
      .addCase(deleteReview.fulfilled, (state, action) => {
        state.loading = false;
        // Удаляем отзыв из userReviews
        // Нужно найти ключ по reviewId
        const reviewId = action.payload;
        Object.keys(state.userReviews).forEach(key => {
          if (state.userReviews[key]?.id === reviewId) {
            delete state.userReviews[key];
          }
        });
        state.lastAction = 'delete_success';
      })
      .addCase(deleteReview.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.payload?.error || 'Ошибка удаления отзыва';
        state.lastAction = 'delete_error';
      })

      // Получение отзыва по postId
      .addCase(fetchReviewByPost.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReviewByPost.fulfilled, (state, action) => {
        state.loading = false;
        state.currentReview = action.payload;
      })
      .addCase(fetchReviewByPost.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Ошибка загрузки отзыва';
      });
  }
});

export const { clearError, clearCurrentReview } = reviewsSlice.actions;
export default reviewsSlice.reducer;
