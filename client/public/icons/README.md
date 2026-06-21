# Иконки watchRebel

Этот файл содержит SVG sprite со всеми иконками проекта.

## Использование

### 1. Через компонент Icon (рекомендуется)

```jsx
import Icon from '@/components/Common/Icon';

// Базовое использование
<Icon name="feed" />

// С размером
<Icon name="heart" size="small" />  // 16px
<Icon name="messages" size="medium" />  // 24px (по умолчанию)
<Icon name="settings" size="large" />  // 32px

// С кастомным цветом
<Icon name="notifications" color="#e53e3e" />

// С дополнительным классом
<Icon name="close" className="custom-class" />
```

### 2. Напрямую через SVG (если нужно)

```jsx
<svg width="24" height="24">
  <use href="/icons/icons-sprite.svg#icon-feed" />
</svg>
```

## Доступные иконки

### Навигация
- `feed` - Лента
- `friends` - Друзья
- `messages` - Сообщения
- `catalog` - Каталог
- `movies` - Мои фильмы
- `tv` - Мои сериалы
- `watchlist` - Список желаемого
- `settings` - Настройки
- `notifications` - Уведомления

### Уведомления
- `heart` - Реакция ❤️
- `user` - Активность друга 👤
- `message` - Сообщение 💬
- `bell` - Общее уведомление 🔔

### Действия
- `add` - Добавить
- `remove` - Убрать (минус)
- `edit` - Редактировать
- `delete` - Удалить (корзина)
- `close` - Закрыть ✕
- `open` - Открыть/Развернуть
- `arrow-left` - Стрелка влево
- `arrow-right` - Стрелка вправо
- `arrow-up` - Стрелка вверх
- `arrow-down` - Стрелка вниз
- `chevron-left` - Шеврон влево
- `chevron-right` - Шеврон вправо

### Авторизация
- `telegram` - Telegram
- `email` - Email
- `google` - Google
- `discord` - Discord

### Прочее
- `search` - Поиск
- `star` - Звезда / Рейтинг
- `paperclip` - Скрепка (прикрепить файл)
- `announcement` - Объявление
- `status` - Статус
- `theme` - Тема оформления 🎨
- `shield` - Приватность 🛡️
- `lock` - Безопасность 🔒
- `database` - База данных 🗄️
- `report` - Жалоба ⚠️
- `support` - Поддержка ❓
- `clock` - Время ⏰

## Особенности

- Все иконки используют `currentColor` для цвета, что позволяет управлять цветом через CSS
- Размер по умолчанию: 24x24px
- Иконки адаптируются под темы оформления
- Один HTTP запрос для всех иконок (sprite подход)
- Оптимальное кэширование

## Добавление новых иконок

1. Открой `icons-sprite.svg`
2. Добавь новый `<symbol>` с уникальным `id="icon-название"`
3. Используй `viewBox="0 0 24 24"` для масштабируемости
4. Используй `stroke="currentColor"` для поддержки тем
5. Обнови этот README с описанием новой иконки
