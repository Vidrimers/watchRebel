import { createSlice } from '@reduxjs/toolkit';

// Проверяем доступность localStorage (для тестов в Node.js)
const isLocalStorageAvailable = typeof window !== 'undefined' && window.localStorage;

// Получаем сохраненную тему из localStorage или используем по умолчанию
const getInitialTheme = () => {
  if (!isLocalStorageAvailable) {
    return 'light-cream';
  }
  const savedTheme = localStorage.getItem('theme');
  return savedTheme || 'light-cream';
};

// Применяем тему к document.documentElement
const applyTheme = (theme) => {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
  if (isLocalStorageAvailable) {
    localStorage.setItem('theme', theme);
  }
};

// Инициализируем тему при загрузке модуля
const initialTheme = getInitialTheme();
applyTheme(initialTheme);

const themeSlice = createSlice({
  name: 'theme',
  initialState: {
    theme: initialTheme
  },
  reducers: {
    setTheme: (state, action) => {
      state.theme = action.payload;
      applyTheme(action.payload);
    }
  }
});

export const { setTheme } = themeSlice.actions;
export default themeSlice.reducer;
