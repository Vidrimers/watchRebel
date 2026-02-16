import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api, { APIError, NetworkError } from '../../services/api';

// Async thunks
export const checkSession = createAsyncThunk(
  'auth/checkSession',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        return rejectWithValue({ message: 'Нет токена' });
      }
      
      const response = await api.get('/auth/session');
      return response.data;
    } catch (error) {
      // Очищаем токен если сессия невалидна
      localStorage.removeItem('authToken');
      
      if (error instanceof APIError) {
        return rejectWithValue(error.data || error.message);
      } else if (error instanceof NetworkError) {
        return rejectWithValue({ message: error.message });
      }
      return rejectWithValue({ message: 'Неизвестная ошибка' });
    }
  }
);

export const login = createAsyncThunk(
  'auth/login',
  async (telegramData, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/telegram', telegramData);
      return response.data;
    } catch (error) {
      if (error instanceof APIError) {
        return rejectWithValue(error.data || error.message);
      } else if (error instanceof NetworkError) {
        return rejectWithValue({ message: error.message });
      }
      return rejectWithValue({ message: 'Неизвестная ошибка' });
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await api.delete('/auth/logout');
    } catch (error) {
      if (error instanceof APIError) {
        return rejectWithValue(error.data || error.message);
      } else if (error instanceof NetworkError) {
        return rejectWithValue({ message: error.message });
      }
      return rejectWithValue({ message: 'Неизвестная ошибка' });
    }
  }
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (data, { rejectWithValue }) => {
    try {
      const response = await api.put(`/users/${data.userId}`, data);
      return response.data;
    } catch (error) {
      if (error instanceof APIError) {
        return rejectWithValue(error.data || error.message);
      } else if (error instanceof NetworkError) {
        return rejectWithValue({ message: error.message });
      }
      return rejectWithValue({ message: 'Неизвестная ошибка' });
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    isAuthenticated: false,
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
      // Check Session
      .addCase(checkSession.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(checkSession.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.loading = false;
      })
      .addCase(checkSession.rejected, (state) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
      })
      // Login
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.loading = false;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        // Очищаем токен из localStorage
        localStorage.removeItem('authToken');
      })
      // Update Profile
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.user = { ...state.user, ...action.payload };
      });
  }
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;
