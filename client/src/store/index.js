import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import mediaReducer from './slices/mediaSlice';
import listsReducer from './slices/listsSlice';
import wallReducer from './slices/wallSlice';
import notificationsReducer from './slices/notificationsSlice';
import themeReducer from './slices/themeSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    media: mediaReducer,
    lists: listsReducer,
    wall: wallReducer,
    notifications: notificationsReducer,
    theme: themeReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Игнорируем проверку для Date объектов
        ignoredActions: ['auth/login/fulfilled'],
        ignoredPaths: ['auth.user.createdAt', 'auth.user.updatedAt']
      }
    })
});
