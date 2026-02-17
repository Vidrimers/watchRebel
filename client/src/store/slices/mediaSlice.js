import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api, { APIError, NetworkError } from '../../services/api';

export const searchMedia = createAsyncThunk(
  'media/search',
  async ({ query, filters }, { rejectWithValue }) => {
    try {
      const response = await api.get('/media/search', { params: { query, ...filters } });
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

export const getMediaDetails = createAsyncThunk(
  'media/getDetails',
  async ({ type, id }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/media/${type}/${id}`);
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

const mediaSlice = createSlice({
  name: 'media',
  initialState: {
    searchResults: [],
    searchQuery: '',
    selectedMedia: null,
    loading: false,
    error: null
  },
  reducers: {
    clearSearch: (state) => {
      state.searchResults = [];
      state.searchQuery = '';
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(searchMedia.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchMedia.fulfilled, (state, action) => {
        // Гарантируем, что searchResults всегда массив
        state.searchResults = Array.isArray(action.payload) ? action.payload : [];
        state.loading = false;
        state.error = null;
      })
      .addCase(searchMedia.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getMediaDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getMediaDetails.fulfilled, (state, action) => {
        state.selectedMedia = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(getMediaDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const { clearSearch, setSearchQuery, clearError } = mediaSlice.actions;
export default mediaSlice.reducer;
