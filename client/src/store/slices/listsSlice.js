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

export const renameList = createAsyncThunk(
  'lists/renameList',
  async ({ listId, name }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/lists/${listId}`, { name });
      return response.data;
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
  reducers: {
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Lists
      .addCase(fetchLists.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLists.fulfilled, (state, action) => {
        state.customLists = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchLists.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Create List
      .addCase(createList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createList.fulfilled, (state, action) => {
        state.customLists.push(action.payload);
        state.loading = false;
        state.error = null;
      })
      .addCase(createList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Delete List
      .addCase(deleteList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteList.fulfilled, (state, action) => {
        state.customLists = state.customLists.filter(list => list.id !== action.payload);
        state.loading = false;
        state.error = null;
      })
      .addCase(deleteList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Rename List
      .addCase(renameList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(renameList.fulfilled, (state, action) => {
        const list = state.customLists.find(l => l.id === action.payload.id);
        if (list) {
          list.name = action.payload.name;
        }
        state.loading = false;
        state.error = null;
      })
      .addCase(renameList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Add to List
      .addCase(addToList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addToList.fulfilled, (state, action) => {
        const list = state.customLists.find(l => l.id === action.payload.listId);
        if (list) {
          list.items.push(action.payload.item);
        }
        state.loading = false;
        state.error = null;
      })
      .addCase(addToList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch Watchlist
      .addCase(fetchWatchlist.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWatchlist.fulfilled, (state, action) => {
        state.watchlist = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchWatchlist.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Add to Watchlist
      .addCase(addToWatchlist.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addToWatchlist.fulfilled, (state, action) => {
        state.watchlist.push(action.payload);
        state.loading = false;
        state.error = null;
      })
      .addCase(addToWatchlist.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Remove from Watchlist
      .addCase(removeFromWatchlist.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeFromWatchlist.fulfilled, (state, action) => {
        state.watchlist = state.watchlist.filter(item => item.id !== action.payload);
        state.loading = false;
        state.error = null;
      })
      .addCase(removeFromWatchlist.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Remove from List
      .addCase(removeFromList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeFromList.fulfilled, (state, action) => {
        const list = state.customLists.find(l => l.id === action.payload.listId);
        if (list) {
          list.items = list.items.filter(item => item.id !== action.payload.itemId);
        }
        state.loading = false;
        state.error = null;
      })
      .addCase(removeFromList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch Episode Progress
      .addCase(fetchEpisodeProgress.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEpisodeProgress.fulfilled, (state, action) => {
        state.episodeProgress[action.payload.seriesId] = action.payload.progress;
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchEpisodeProgress.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Mark Episode Watched
      .addCase(markEpisodeWatched.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(markEpisodeWatched.fulfilled, (state, action) => {
        const seriesId = action.payload.tmdbId;
        if (!state.episodeProgress[seriesId]) {
          state.episodeProgress[seriesId] = [];
        }
        state.episodeProgress[seriesId].push(action.payload);
        state.loading = false;
        state.error = null;
      })
      .addCase(markEpisodeWatched.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Add Rating
      .addCase(addRating.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addRating.fulfilled, (state, action) => {
        state.ratings[action.payload.tmdbId] = action.payload.rating;
        state.loading = false;
        state.error = null;
      })
      .addCase(addRating.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const { clearError } = listsSlice.actions;
export default listsSlice.reducer;
