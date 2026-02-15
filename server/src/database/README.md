# Database Module

Модуль для работы с SQLite базой данных watchRebel.

## Файлы

- `db.js` - Основной модуль для работы с базой данных
- `migrations.js` - Миграции для создания таблиц
- `init.js` - Скрипт инициализации базы данных
- `__tests__/db.test.js` - Property-based тесты для проверки персистентности данных

## Использование

### Инициализация базы данных

```bash
node server/src/database/init.js
```

Эта команда создаст файл `rebel.db` в директории `server/` со всеми необходимыми таблицами.

### Работа с базой данных в коде

```javascript
import { executeQuery, getDatabase, closeDatabase } from './database/db.js';

// SELECT запрос
const result = await executeQuery('SELECT * FROM users WHERE id = ?', [userId]);
if (result.success) {
  console.log(result.data); // Массив строк
}

// INSERT запрос
const insertResult = await executeQuery(
  'INSERT INTO users (id, display_name) VALUES (?, ?)',
  [userId, displayName]
);
if (insertResult.success) {
  console.log('Вставлено строк:', insertResult.changes);
  console.log('ID последней вставки:', insertResult.lastInsertRowid);
}

// UPDATE запрос
const updateResult = await executeQuery(
  'UPDATE users SET display_name = ? WHERE id = ?',
  [newName, userId]
);
if (updateResult.success) {
  console.log('Обновлено строк:', updateResult.changes);
}

// DELETE запрос
const deleteResult = await executeQuery(
  'DELETE FROM users WHERE id = ?',
  [userId]
);
if (deleteResult.success) {
  console.log('Удалено строк:', deleteResult.changes);
}

// Закрытие соединения (обычно при завершении приложения)
await closeDatabase();
```

### Обработка ошибок

Функция `executeQuery` всегда возвращает объект с полем `success`:

```javascript
const result = await executeQuery('SELECT * FROM users');

if (result.success) {
  // Успешное выполнение
  console.log(result.data);
} else {
  // Ошибка
  console.error('Ошибка:', result.error);
  console.error('Код ошибки:', result.code);
}
```

## Тестирование

Запуск тестов:

```bash
cd server
npm test
```

Property-based тесты проверяют, что данные корректно сохраняются и извлекаются из базы данных (round-trip property) на 100 случайно сгенерированных примерах.

## Структура базы данных

База данных содержит следующие таблицы:

- `users` - Пользователи
- `sessions` - Сессии авторизации
- `custom_lists` - Пользовательские списки
- `list_items` - Элементы списков
- `watchlist` - Список желаемого
- `ratings` - Оценки контента
- `wall_posts` - Посты на стене
- `reactions` - Реакции на посты
- `episode_progress` - Прогресс просмотра серий
- `friends` - Друзья
- `notifications` - Уведомления
- `announcements` - Объявления

Подробная схема таблиц описана в файле `design.md` в корне проекта.
