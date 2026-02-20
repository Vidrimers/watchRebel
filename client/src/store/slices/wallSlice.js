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
  async (userId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/wall/${userId}`);
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
    error: null
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Wall
      .addCase(fetchWall.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWall.fulfilled, (state, action) => {
        state.posts = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchWall.rejected, (state, action) => {
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
          post.reactions.push(action.payload.reaction);
        }
        state.error = null;
      })
      .addCase(addReaction.rejected, (state, action) => {
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

export const { clearError } = wallSlice.actions;
export default wallSlice.reducer;
