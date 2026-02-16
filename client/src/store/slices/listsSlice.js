import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchLists = createAsyncThunk(
  'lists/fetchLists',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/lists');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
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
      return rejectWithValue(error.response?.data || error.message);
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
      return rejectWithValue(error.response?.data || error.message);
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
      return rejectWithValue(error.response?.data || error.message);
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
      return rejectWithValue(error.response?.data || error.message);
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
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

const listsSlice = createSlice({
  name: 'lists',
  initialState: {
    customLists: [],
    watchlist: [],
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
      });
  }
});

export default listsSlice.reducer;
