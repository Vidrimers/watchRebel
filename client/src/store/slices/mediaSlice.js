import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api, { APIError, NetworkError } from '../../services/api';

export const searchMedia = createAsyncThunk(
  'media/search',
  async ({ query, filters }, { rejectWithValue }) => {
    try {
      // Логирование параметров запроса
      console.log('[mediaSlice] searchMedia вызван с параметрами:', {
        query,
        filters,
        fullParams: { query, ...filters }
      });

      const response = await api.get('/media/search', { params: { query, ...filters } });
      
      // Логирование успешного ответа
      console.log('[mediaSlice] searchMedia успешный ответ:', {
        status: response.status,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data),
        resultsCount: Array.isArray(response.data) ? response.data.length : 'не массив',
        data: response.data
      });

      return response.data;
    } catch (error) {
      // Логирование ошибки
      console.error('[mediaSlice] searchMedia ошибка:', {
        errorType: error.constructor.name,
        message: error.message,
        error
      });

      if (error instanceof APIError) {
        console.error('[mediaSlice] APIError детали:', {
          status: error.status,
          data: error.data
        });
        return rejectWithValue(error.data || error.message);
      } else if (error instanceof NetworkError) {
        console.error('[mediaSlice] NetworkError детали:', error.message);
        return rejectWithValue({ message: error.message });
      }
      
      console.error('[mediaSlice] Неизвестная ошибка:', error);
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
        console.log('[mediaSlice] searchMedia.pending - начало поиска');
        state.loading = true;
        state.error = null;
      })
      .addCase(searchMedia.fulfilled, (state, action) => {
        // Backend возвращает объект с полями movies и tv
        // Преобразуем в массив результатов для frontend
        let results = [];
        
        if (action.payload && typeof action.payload === 'object') {
          // Если это объект с movies и tv
          if (action.payload.movies || action.payload.tv) {
            const movies = (action.payload.movies || []).map(movie => ({
              type: 'movie',
              data: {
                tmdbId: movie.id,
                mediaType: 'movie',
                title: movie.title || movie.name,
                posterPath: movie.poster_path,
                backdropPath: movie.backdrop_path,
                overview: movie.overview,
                releaseDate: movie.release_date || movie.first_air_date,
                voteAverage: movie.vote_average,
                voteCount: movie.vote_count,
                genreIds: movie.genre_ids || []
              }
            }));
            
            const tv = (action.payload.tv || []).map(show => ({
              type: 'tv',
              data: {
                tmdbId: show.id,
                mediaType: 'tv',
                title: show.name || show.title,
                posterPath: show.poster_path,
                backdropPath: show.backdrop_path,
                overview: show.overview,
                releaseDate: show.first_air_date || show.release_date,
                voteAverage: show.vote_average,
                voteCount: show.vote_count,
                genreIds: show.genre_ids || []
              }
            }));
            
            results = [...movies, ...tv];
          } else if (Array.isArray(action.payload)) {
            // Если это уже массив (старый формат)
            results = action.payload;
          }
        }
        
        console.log('[mediaSlice] searchMedia.fulfilled - поиск завершен:', {
          payloadType: typeof action.payload,
          hasMovies: !!action.payload?.movies,
          hasTv: !!action.payload?.tv,
          moviesCount: action.payload?.movies?.length || 0,
          tvCount: action.payload?.tv?.length || 0,
          totalResults: results.length,
          results
        });

        state.searchResults = results;
        state.loading = false;
        state.error = null;
      })
      .addCase(searchMedia.rejected, (state, action) => {
        console.error('[mediaSlice] searchMedia.rejected - ошибка поиска:', {
          payload: action.payload,
          error: action.error
        });

        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getMediaDetails.pending, (state) => {
        console.log('[mediaSlice] getMediaDetails.pending');
        state.loading = true;
        state.error = null;
      })
      .addCase(getMediaDetails.fulfilled, (state, action) => {
        console.log('[mediaSlice] getMediaDetails.fulfilled:', action.payload);
        state.selectedMedia = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(getMediaDetails.rejected, (state, action) => {
        console.error('[mediaSlice] getMediaDetails.rejected:', action.payload);
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const { clearSearch, setSearchQuery, clearError } = mediaSlice.actions;
export default mediaSlice.reducer;
