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

export const fetchWall = createAsyncThunk(
  'wall/fetchWall',
  async ({ userId, limit = 20, offset = 0 }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/wall/${userId}`, {
        params: { limit, offset }
      });
      return response.data;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

export const loadMoreWall = createAsyncThunk(
  'wall/loadMoreWall',
  async ({ userId, limit = 20, offset = 0 }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/wall/${userId}`, {
        params: { limit, offset }
      });
      return response.data;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

export const createPost = createAsyncThunk(
  'wall/createPost',
  async (postData, { rejectWithValue }) => {
    try {
      const response = await api.post('/wall', postData);
      return response.data;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

export const addReaction = createAsyncThunk(
  'wall/addReaction',
  async ({ postId, emoji }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/wall/${postId}/reactions`, { emoji });
      return { postId, reaction: response.data };
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

export const updatePost = createAsyncThunk(
  'wall/updatePost',
  async ({ postId, content, mentions }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/wall/${postId}`, { content, mentions });
      return response.data;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

export const deletePost = createAsyncThunk(
  'wall/deletePost',
  async (postId, { rejectWithValue }) => {
    try {
      await api.delete(`/wall/${postId}`);
      return postId;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

const wallSlice = createSlice({
  name: 'wall',
  initialState: {
    posts: [],
    loading: false,
    error: null,
    hasMore: true,
    offset: 0,
    limit: 20
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    // Обновление счётчика комментариев для конкретного поста
    incrementCommentsCount: (state, action) => {
      const post = state.posts.find(p => p.id === action.payload.postId);
      if (post) {
        post.commentsCount = (post.commentsCount || 0) + 1;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Wall (начальная загрузка)
      .addCase(fetchWall.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWall.fulfilled, (state, action) => {
        const posts = action.payload.posts || action.payload;
        const hasMore = action.payload.hasMore !== undefined ? action.payload.hasMore : true;
        
        state.posts = posts;
        state.hasMore = hasMore;
        state.offset = posts.length;
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchWall.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Load More Wall (подгрузка)
      .addCase(loadMoreWall.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadMoreWall.fulfilled, (state, action) => {
        const newPosts = action.payload.posts || action.payload;
        const hasMore = action.payload.hasMore !== undefined ? action.payload.hasMore : true;
        
        state.posts = [...state.posts, ...newPosts];
        state.hasMore = hasMore;
        state.offset = state.posts.length;
        state.loading = false;
        state.error = null;
      })
      .addCase(loadMoreWall.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Create Post
      .addCase(createPost.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createPost.fulfilled, (state, action) => {
        state.posts.unshift(action.payload);
        state.loading = false;
        state.error = null;
      })
      .addCase(createPost.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Add Reaction
      .addCase(addReaction.pending, (state) => {
        state.error = null;
      })
      .addCase(addReaction.fulfilled, (state, action) => {
        const post = state.posts.find(p => p.id === action.payload.postId);
        if (post) {
          // Удаляем старую реакцию текущего пользователя (если есть)
          const existingReactionIndex = post.reactions.findIndex(
            r => r.userId === action.payload.reaction.userId
          );
          
          if (existingReactionIndex !== -1) {
            // Обновляем существующую реакцию
            post.reactions[existingReactionIndex] = action.payload.reaction;
          } else {
            // Добавляем новую реакцию
            post.reactions.push(action.payload.reaction);
          }
        }
        state.error = null;
      })
      .addCase(addReaction.rejected, (state, action) => {
        state.error = action.payload;
      })
      // Update Post
      .addCase(updatePost.pending, (state) => {
        state.error = null;
      })
      .addCase(updatePost.fulfilled, (state, action) => {
        const postIndex = state.posts.findIndex(p => p.id === action.payload.id);
        if (postIndex !== -1) {
          // Обновляем пост, сохраняя все поля
          state.posts[postIndex] = {
            ...state.posts[postIndex],
            ...action.payload
          };
        }
        state.error = null;
      })
      .addCase(updatePost.rejected, (state, action) => {
        state.error = action.payload;
      })
      // Delete Post
      .addCase(deletePost.pending, (state) => {
        state.error = null;
      })
      .addCase(deletePost.fulfilled, (state, action) => {
        state.posts = state.posts.filter(p => p.id !== action.payload);
        state.error = null;
      })
      .addCase(deletePost.rejected, (state, action) => {
        state.error = action.payload;
      });
  }
});

export const { clearError, incrementCommentsCount } = wallSlice.actions;
export default wallSlice.reducer;
