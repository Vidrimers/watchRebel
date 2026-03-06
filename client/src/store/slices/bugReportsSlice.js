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

// Получить свои багрепорты (для пользователя)
export const fetchMyBugReports = createAsyncThunk(
  'bugReports/fetchMyBugReports',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/bug-reports');
      return response.data.bugReports;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

// Создать багрепорт
export const createBugReport = createAsyncThunk(
  'bugReports/createBugReport',
  async ({ title, description, images }, { rejectWithValue }) => {
    try {
      // Сначала загружаем изображения если есть
      let imagePaths = [];
      if (images && images.length > 0) {
        const formData = new FormData();
        images.forEach(image => {
          formData.append('images', image);
        });

        const uploadResponse = await api.post('/bug-reports/upload-images', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        imagePaths = uploadResponse.data.images;
      }

      // Создаем багрепорт
      const response = await api.post('/bug-reports', {
        title,
        description,
        images: imagePaths
      });

      return response.data.bugReport;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

// Получить детали багрепорта
export const fetchBugReportDetails = createAsyncThunk(
  'bugReports/fetchBugReportDetails',
  async (reportId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/bug-reports/${reportId}`);
      return response.data;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

// Получить все багрепорты (для админа)
export const fetchAllBugReports = createAsyncThunk(
  'bugReports/fetchAllBugReports',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/bug-reports/admin/all');
      return response.data.bugReports;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

// Получить статистику багрепортов (для админа)
export const fetchBugReportStats = createAsyncThunk(
  'bugReports/fetchBugReportStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/bug-reports/admin/stats');
      return response.data;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

// Обновить статус багрепорта (для админа)
export const updateBugReportStatus = createAsyncThunk(
  'bugReports/updateBugReportStatus',
  async ({ reportId, status }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/bug-reports/admin/${reportId}/status`, { status });
      return { reportId, status };
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

// Удалить багрепорт (для админа)
export const deleteBugReport = createAsyncThunk(
  'bugReports/deleteBugReport',
  async (reportId, { rejectWithValue }) => {
    try {
      await api.delete(`/bug-reports/admin/${reportId}`);
      return reportId;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

const initialState = {
  // Багрепорты пользователя
  myReports: [],
  myReportsLoading: false,
  myReportsError: null,

  // Все багрепорты (для админа)
  allReports: [],
  allReportsLoading: false,
  allReportsError: null,

  // Статистика (для админа)
  stats: {
    new: 0,
    in_progress: 0,
    resolved: 0,
    rejected: 0
  },
  statsLoading: false,
  statsError: null,

  // Детали выбранного багрепорта
  selectedReport: null,
  selectedReportLoading: false,
  selectedReportError: null,

  // Создание багрепорта
  createLoading: false,
  createError: null,

  // Обновление статуса
  updateLoading: false,
  updateError: null
};

const bugReportsSlice = createSlice({
  name: 'bugReports',
  initialState,
  reducers: {
    // Очистить ошибки
    clearErrors: (state) => {
      state.myReportsError = null;
      state.allReportsError = null;
      state.statsError = null;
      state.selectedReportError = null;
      state.createError = null;
      state.updateError = null;
    },
    // Очистить выбранный багрепорт
    clearSelectedReport: (state) => {
      state.selectedReport = null;
      state.selectedReportError = null;
    }
  },
  extraReducers: (builder) => {
    // Получить свои багрепорты
    builder
      .addCase(fetchMyBugReports.pending, (state) => {
        state.myReportsLoading = true;
        state.myReportsError = null;
      })
      .addCase(fetchMyBugReports.fulfilled, (state, action) => {
        state.myReportsLoading = false;
        state.myReports = action.payload;
      })
      .addCase(fetchMyBugReports.rejected, (state, action) => {
        state.myReportsLoading = false;
        state.myReportsError = action.payload;
      });

    // Создать багрепорт
    builder
      .addCase(createBugReport.pending, (state) => {
        state.createLoading = true;
        state.createError = null;
      })
      .addCase(createBugReport.fulfilled, (state, action) => {
        state.createLoading = false;
        // Проверяем, что myReports инициализирован
        if (!state.myReports) {
          state.myReports = [];
        }
        state.myReports.unshift(action.payload);
      })
      .addCase(createBugReport.rejected, (state, action) => {
        state.createLoading = false;
        state.createError = action.payload;
      });

    // Получить детали багрепорта
    builder
      .addCase(fetchBugReportDetails.pending, (state) => {
        state.selectedReportLoading = true;
        state.selectedReportError = null;
      })
      .addCase(fetchBugReportDetails.fulfilled, (state, action) => {
        state.selectedReportLoading = false;
        state.selectedReport = action.payload;
      })
      .addCase(fetchBugReportDetails.rejected, (state, action) => {
        state.selectedReportLoading = false;
        state.selectedReportError = action.payload;
      });

    // Получить все багрепорты (админ)
    builder
      .addCase(fetchAllBugReports.pending, (state) => {
        state.allReportsLoading = true;
        state.allReportsError = null;
      })
      .addCase(fetchAllBugReports.fulfilled, (state, action) => {
        state.allReportsLoading = false;
        state.allReports = action.payload;
      })
      .addCase(fetchAllBugReports.rejected, (state, action) => {
        state.allReportsLoading = false;
        state.allReportsError = action.payload;
      });

    // Получить статистику (админ)
    builder
      .addCase(fetchBugReportStats.pending, (state) => {
        state.statsLoading = true;
        state.statsError = null;
      })
      .addCase(fetchBugReportStats.fulfilled, (state, action) => {
        state.statsLoading = false;
        state.stats = action.payload;
      })
      .addCase(fetchBugReportStats.rejected, (state, action) => {
        state.statsLoading = false;
        state.statsError = action.payload;
      });

    // Обновить статус (админ)
    builder
      .addCase(updateBugReportStatus.pending, (state) => {
        state.updateLoading = true;
        state.updateError = null;
      })
      .addCase(updateBugReportStatus.fulfilled, (state, action) => {
        state.updateLoading = false;
        const { reportId, status } = action.payload;
        
        // Обновляем в списке всех багрепортов
        const reportIndex = state.allReports.findIndex(r => r.id === reportId);
        if (reportIndex !== -1) {
          state.allReports[reportIndex].status = status;
          state.allReports[reportIndex].updated_at = new Date().toISOString();
        }

        // Обновляем выбранный багрепорт если он открыт
        if (state.selectedReport && state.selectedReport.id === reportId) {
          state.selectedReport.status = status;
          state.selectedReport.updated_at = new Date().toISOString();
        }
      })
      .addCase(updateBugReportStatus.rejected, (state, action) => {
        state.updateLoading = false;
        state.updateError = action.payload;
      });

    // Удалить багрепорт (админ)
    builder
      .addCase(deleteBugReport.pending, (state) => {
        state.updateLoading = true;
        state.updateError = null;
      })
      .addCase(deleteBugReport.fulfilled, (state, action) => {
        state.updateLoading = false;
        const reportId = action.payload;
        
        // Удаляем из списка всех багрепортов
        state.allReports = state.allReports.filter(r => r.id !== reportId);
        
        // Закрываем модальное окно если был открыт удаленный багрепорт
        if (state.selectedReport && state.selectedReport.id === reportId) {
          state.selectedReport = null;
        }
      })
      .addCase(deleteBugReport.rejected, (state, action) => {
        state.updateLoading = false;
        state.updateError = action.payload;
      });
  }
});

export const { clearErrors, clearSelectedReport } = bugReportsSlice.actions;

export default bugReportsSlice.reducer;
