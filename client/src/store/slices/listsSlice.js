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

export const fetchLists = createAsyncThunk(
  'lists/fetchLists',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/lists');
      return response.data;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

export const createList = createAsyncThunk(
  'lists/createList',
  async ({ name, mediaType }, { rejectWithValue }) => {
    try {
      const response = await api.post('/lists', { name, mediaType });
      return response.data;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

export const deleteList = createAsyncThunk(
  'lists/deleteList',
  async (listId, { rejectWithValue }) => {
    try {
      await api.delete(`/lists/${listId}`);
      return listId;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

export const addToList = createAsyncThunk(
  'lists/addToList',
  async ({ listId, media }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/lists/${listId}/items`, media);
      return { listId, item: response.data };
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

export const fetchWatchlist = createAsyncThunk(
  'lists/fetchWatchlist',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/watchlist');
      return response.data;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

export const addToWatchlist = createAsyncThunk(
  'lists/addToWatchlist',
  async (media, { rejectWithValue }) => {
    try {
      const response = await api.post('/watchlist', media);
      return response.data;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

export const removeFromWatchlist = createAsyncThunk(
  'lists/removeFromWatchlist',
  async (itemId, { rejectWithValue }) => {
    try {
      await api.delete(`/watchlist/${itemId}`);
      return itemId;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

export const removeFromList = createAsyncThunk(
  'lists/removeFromList',
  async ({ listId, itemId }, { rejectWithValue }) => {
    try {
      await api.delete(`/lists/${listId}/items/${itemId}`);
      return { listId, itemId };
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

// Получить прогресс просмотра сериала
export const fetchEpisodeProgress = createAsyncThunk(
  'lists/fetchEpisodeProgress',
  async (seriesId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/progress/${seriesId}`);
      return { seriesId, progress: response.data };
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

// Отметить серию как просмотренную
export const markEpisodeWatched = createAsyncThunk(
  'lists/markEpisodeWatched',
  async ({ tmdbId, seasonNumber, episodeNumber }, { rejectWithValue }) => {
    try {
      const response = await api.post('/progress', {
        tmdbId,
        seasonNumber,
        episodeNumber
      });
      return response.data;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

// Поставить рейтинг
export const addRating = createAsyncThunk(
  'lists/addRating',
  async ({ tmdbId, mediaType, rating }, { rejectWithValue }) => {
    try {
      const response = await api.post('/ratings', {
        tmdbId,
        mediaType,
        rating
      });
      return response.data;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

const listsSlice = createSlice({
  name: 'lists',
  initialState: {
    customLists: [],
    watchlist: [],
    episodeProgress: {}, // { seriesId: [progress items] }
    ratings: {}, // { tmdbId: rating }
    loading: false,
    error: null
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchLists.fulfilled, (state, action) => {
        state.customLists = action.payload;
      })
      .addCase(createList.fulfilled, (state, action) => {
        state.customLists.push(action.payload);
      })
      .addCase(deleteList.fulfilled, (state, action) => {
        state.customLists = state.customLists.filter(list => list.id !== action.payload);
      })
      .addCase(addToList.fulfilled, (state, action) => {
        const list = state.customLists.find(l => l.id === action.payload.listId);
        if (list) {
          list.items.push(action.payload.item);
        }
      })
      .addCase(fetchWatchlist.fulfilled, (state, action) => {
        state.watchlist = action.payload;
      })
      .addCase(addToWatchlist.fulfilled, (state, action) => {
        state.watchlist.push(action.payload);
      })
      .addCase(removeFromWatchlist.fulfilled, (state, action) => {
        state.watchlist = state.watchlist.filter(item => item.id !== action.payload);
      })
      .addCase(removeFromList.fulfilled, (state, action) => {
        const list = state.customLists.find(l => l.id === action.payload.listId);
        if (list) {
          list.items = list.items.filter(item => item.id !== action.payload.itemId);
        }
      })
      .addCase(fetchEpisodeProgress.fulfilled, (state, action) => {
        state.episodeProgress[action.payload.seriesId] = action.payload.progress;
      })
      .addCase(markEpisodeWatched.fulfilled, (state, action) => {
        const seriesId = action.payload.tmdbId;
        if (!state.episodeProgress[seriesId]) {
          state.episodeProgress[seriesId] = [];
        }
        state.episodeProgress[seriesId].push(action.payload);
      })
      .addCase(addRating.fulfilled, (state, action) => {
        state.ratings[action.payload.tmdbId] = action.payload.rating;
      });
  }
});

export default listsSlice.reducer;
