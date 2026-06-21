import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api, { APIError, NetworkError } from '../../services/api';

const handleError = (error, rejectWithValue) => {
  if (error instanceof APIError) {
    return rejectWithValue(error.data || error.message);
  } else if (error instanceof NetworkError) {
    return rejectWithValue({ message: error.message });
  }
  return rejectWithValue({ message: 'Неизвестная ошибка' });
};

export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/notifications', { params: { limit: 20, offset: 0 } });
      return response.data;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

export const loadMoreNotifications = createAsyncThunk(
  'notifications/loadMoreNotifications',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { notifications } = getState().notifications;
      const offset = notifications.length;
      const response = await api.get('/notifications', { params: { limit: 20, offset } });
      return response.data;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

export const markAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (notificationId, { rejectWithValue }) => {
    try {
      await api.put(`/notifications/${notificationId}/read`);
      return notificationId;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

export const markAllAsRead = createAsyncThunk(
  'notifications/markAllAsRead',
  async (_, { rejectWithValue }) => {
    try {
      await api.put('/notifications/mark-all-read');
      return true;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: {
    notifications: [],
    unreadCount: 0,
    total: 0,
    hasMore: false,
    loading: false,
    loadingMore: false,
    error: null
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.notifications = action.payload.notifications;
        state.total = action.payload.total;
        state.hasMore = action.payload.hasMore;
        state.unreadCount = action.payload.unreadCount;
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(loadMoreNotifications.pending, (state) => {
        state.loadingMore = true;
        state.error = null;
      })
      .addCase(loadMoreNotifications.fulfilled, (state, action) => {
        state.notifications = [...state.notifications, ...action.payload.notifications];
        state.hasMore = action.payload.hasMore;
        state.total = action.payload.total;
        state.loadingMore = false;
        state.error = null;
      })
      .addCase(loadMoreNotifications.rejected, (state, action) => {
        state.loadingMore = false;
        state.error = action.payload;
      })
      .addCase(markAsRead.pending, (state) => {
        state.error = null;
      })
      .addCase(markAsRead.fulfilled, (state, action) => {
        const notification = state.notifications.find(n => n.id === action.payload);
        if (notification) {
          notification.isRead = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
        state.error = null;
      })
      .addCase(markAsRead.rejected, (state, action) => {
        state.error = action.payload;
      })
      .addCase(markAllAsRead.pending, (state) => {
        state.error = null;
      })
      .addCase(markAllAsRead.fulfilled, (state) => {
        state.notifications.forEach(n => {
          n.isRead = true;
        });
        state.unreadCount = 0;
        state.error = null;
      })
      .addCase(markAllAsRead.rejected, (state, action) => {
        state.error = action.payload;
      });
  }
});

export const { clearError } = notificationsSlice.actions;
export default notificationsSlice.reducer;
