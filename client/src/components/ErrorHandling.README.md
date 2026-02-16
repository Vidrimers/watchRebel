# Обработка ошибок в watchRebel

Этот документ описывает систему обработки ошибок в приложении watchRebel.

## Компоненты

### ErrorBoundary

React Error Boundary для перехвата ошибок рендеринга компонентов.

**Использование:**

```jsx
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <YourApp />
    </ErrorBoundary>
  );
}
```

**Функциональность:**
- Перехватывает ошибки рендеринга React
- Отображает fallback UI с понятным сообщением
- В режиме разработки показывает детали ошибки
- Предоставляет кнопки "Попробовать снова" и "На главную"

### ErrorMessage

Компонент для отображения ошибок API и валидации.

**Использование:**

```jsx
import ErrorMessage from './components/ErrorMessage';

function MyComponent() {
  const { error } = useAppSelector((state) => state.media);
  const dispatch = useAppDispatch();

  return (
    <div>
      {error && (
        <ErrorMessage 
          error={error}
          onClose={() => dispatch(clearError())}
          type="error" // 'error' | 'warning' | 'info'
          title="Ошибка поиска"
          showDetails={true}
        />
      )}
    </div>
  );
}
```

**Props:**
- `error` (string | object) - Ошибка для отображения
- `onClose` (function) - Callback для закрытия сообщения
- `type` ('error' | 'warning' | 'info') - Тип сообщения (по умолчанию 'error')
- `title` (string) - Заголовок (опционально)
- `showDetails` (boolean) - Показывать ли детали ошибки (по умолчанию false)

### ErrorMessageInline

Компактная версия ErrorMessage для inline отображения.

**Использование:**

```jsx
import { ErrorMessageInline } from './components/ErrorMessage';

function MyComponent() {
  const { error } = useAppSelector((state) => state.media);
  const dispatch = useAppDispatch();

  return (
    <div>
      {error && (
        <ErrorMessageInline 
          error={error}
          onClose={() => dispatch(clearError())}
        />
      )}
    </div>
  );
}
```

## Обработка ошибок в Redux Slices

Все Redux slices теперь имеют улучшенную обработку ошибок:

### Структура состояния

```javascript
{
  data: [],
  loading: false,
  error: null // Объект или строка с информацией об ошибке
}
```

### Доступные actions

Каждый slice теперь экспортирует action `clearError`:

```javascript
import { clearError } from './store/slices/mediaSlice';

dispatch(clearError()); // Очищает ошибку в состоянии
```

### Обработка ошибок в async thunks

Все async thunks обрабатывают три типа ошибок:

1. **APIError** - ошибки от API сервера
2. **NetworkError** - ошибки сети
3. **Неизвестные ошибки** - все остальные ошибки

Пример:

```javascript
export const fetchData = createAsyncThunk(
  'slice/fetchData',
  async (params, { rejectWithValue }) => {
    try {
      const response = await api.get('/endpoint');
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
```

### Обработка состояний в reducers

Каждый async thunk обрабатывает три состояния:

```javascript
.addCase(fetchData.pending, (state) => {
  state.loading = true;
  state.error = null; // Очищаем предыдущую ошибку
})
.addCase(fetchData.fulfilled, (state, action) => {
  state.data = action.payload;
  state.loading = false;
  state.error = null;
})
.addCase(fetchData.rejected, (state, action) => {
  state.loading = false;
  state.error = action.payload; // Сохраняем ошибку
})
```

## Примеры использования

### Пример 1: Отображение ошибки в компоненте

```jsx
import React from 'react';
import { useAppSelector, useAppDispatch } from '../hooks';
import { clearError } from '../store/slices/mediaSlice';
import ErrorMessage from '../components/ErrorMessage';

function SearchPage() {
  const { searchResults, loading, error } = useAppSelector((state) => state.media);
  const dispatch = useAppDispatch();

  return (
    <div>
      <h1>Поиск</h1>
      
      {error && (
        <ErrorMessage 
          error={error}
          onClose={() => dispatch(clearError())}
          type="error"
        />
      )}
      
      {loading && <p>Загрузка...</p>}
      
      {searchResults.map(result => (
        <div key={result.id}>{result.title}</div>
      ))}
    </div>
  );
}
```

### Пример 2: Inline ошибка в форме

```jsx
import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks';
import { createList, clearError } from '../store/slices/listsSlice';
import { ErrorMessageInline } from '../components/ErrorMessage';

function CreateListForm() {
  const [name, setName] = useState('');
  const { loading, error } = useAppSelector((state) => state.lists);
  const dispatch = useAppDispatch();

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(createList({ name, mediaType: 'movie' }));
  };

  return (
    <form onSubmit={handleSubmit}>
      <input 
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (error) dispatch(clearError());
        }}
      />
      
      {error && (
        <ErrorMessageInline 
          error={error}
          onClose={() => dispatch(clearError())}
        />
      )}
      
      <button type="submit" disabled={loading}>
        Создать список
      </button>
    </form>
  );
}
```

### Пример 3: Обработка ошибок с автоматическим скрытием

```jsx
import React, { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../hooks';
import { clearError } from '../store/slices/wallSlice';
import ErrorMessage from '../components/ErrorMessage';

function Wall() {
  const { posts, error } = useAppSelector((state) => state.wall);
  const dispatch = useAppDispatch();

  // Автоматически скрываем ошибку через 5 секунд
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        dispatch(clearError());
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [error, dispatch]);

  return (
    <div>
      {error && (
        <ErrorMessage 
          error={error}
          onClose={() => dispatch(clearError())}
        />
      )}
      
      {posts.map(post => (
        <div key={post.id}>{post.content}</div>
      ))}
    </div>
  );
}
```

## Типы ошибок

### Формат ошибки от API

```javascript
{
  message: "Описание ошибки",
  error: "Краткое описание",
  details: { /* дополнительная информация */ }
}
```

### Формат ошибки сети

```javascript
{
  message: "Ошибка сети: не удалось подключиться к серверу"
}
```

## Best Practices

1. **Всегда очищайте ошибки** при новых действиях пользователя
2. **Используйте ErrorBoundary** на верхнем уровне приложения
3. **Показывайте понятные сообщения** пользователю
4. **Логируйте ошибки** для отладки (в production можно отправлять в сервис мониторинга)
5. **Не показывайте технические детали** пользователям в production
6. **Предоставляйте способы восстановления** (кнопки "Попробовать снова", "Обновить")

## Интеграция с мониторингом

В будущем можно интегрировать с сервисами мониторинга:

```javascript
// В ErrorBoundary.jsx
componentDidCatch(error, errorInfo) {
  console.error('ErrorBoundary перехватил ошибку:', error, errorInfo);
  
  // Отправка в Sentry
  // Sentry.captureException(error, { extra: errorInfo });
  
  // Отправка в LogRocket
  // LogRocket.captureException(error, { extra: errorInfo });
}
```

## Требования

Эта реализация соответствует требованию 10.6:
- ✅ Обрабатывает ошибки TMDb API
- ✅ Отображает понятные сообщения пользователю
- ✅ Предоставляет способы восстановления
- ✅ Логирует ошибки для отладки
