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
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(searchMedia.pending, (state) => {
        state.loading = true;
      })
      .addCase(searchMedia.fulfilled, (state, action) => {
        state.searchResults = action.payload;
        state.loading = false;
      })
      .addCase(searchMedia.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getMediaDetails.fulfilled, (state, action) => {
        state.selectedMedia = action.payload;
      });
  }
});

export const { clearSearch, setSearchQuery } = mediaSlice.actions;
export default mediaSlice.reducer;
