# Система тем watchRebel

## Обзор

Приложение watchRebel поддерживает две темы оформления:
- **light-cream** (светлая кремовая) - тема по умолчанию
- **dark** (темная) - темная тема

## Структура файлов

```
styles/
├── variables.css          # Базовые CSS переменные (размеры, отступы, шрифты)
├── themes/
│   ├── light-cream.css   # Светлая кремовая тема
│   └── dark.css          # Темная тема
└── README.md             # Эта документация
```

## Использование

### Переключение темы

Тема управляется через Redux store (`themeSlice`):

```javascript
import { useAppDispatch } from './hooks/useAppDispatch';
import { setTheme } from './store/slices/themeSlice';

const dispatch = useAppDispatch();

// Переключить на темную тему
dispatch(setTheme('dark'));

// Переключить на светлую тему
dispatch(setTheme('light-cream'));
```

### Использование CSS переменных в компонентах

```css
.myComponent {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}
```

## Доступные CSS переменные

### Цвета фона
- `--bg-primary` - основной фон
- `--bg-secondary` - вторичный фон (карточки)
- `--bg-tertiary` - третичный фон
- `--bg-hover` - фон при наведении
- `--bg-active` - фон активного элемента
- `--bg-input` - фон полей ввода
- `--bg-disabled` - фон отключенных элементов

### Цвета текста
- `--text-primary` - основной текст
- `--text-secondary` - вторичный текст
- `--text-tertiary` - третичный текст
- `--text-disabled` - отключенный текст
- `--text-inverse` - инверсный текст
- `--text-link` - цвет ссылок
- `--text-link-hover` - цвет ссылок при наведении

### Акцентные цвета
- `--accent-primary` - основной акцент
- `--accent-primary-hover` - при наведении
- `--accent-primary-active` - при нажатии
- `--accent-secondary` - вторичный акцент
- `--accent-tertiary` - третичный акцент

### Цвета состояний
- `--color-success` / `--color-success-bg` / `--color-success-border`
- `--color-warning` / `--color-warning-bg` / `--color-warning-border`
- `--color-error` / `--color-error-bg` / `--color-error-border`
- `--color-info` / `--color-info-bg` / `--color-info-border`

### Границы
- `--border-color` - основной цвет границ
- `--border-color-light` - светлые границы
- `--border-color-dark` - темные границы
- `--border-color-focus` - границы в фокусе

### Размеры и отступы
- `--spacing-xs` до `--spacing-2xl` - отступы
- `--radius-sm` до `--radius-full` - радиусы скругления
- `--font-size-xs` до `--font-size-4xl` - размеры шрифтов
- `--font-weight-normal` до `--font-weight-bold` - веса шрифтов

### Тени
- `--shadow-xs` до `--shadow-xl` - тени разных размеров

### Переходы
- `--transition-fast` - 150ms
- `--transition-base` - 200ms
- `--transition-slow` - 300ms

## Добавление новой темы

1. Создайте новый файл в `styles/themes/`, например `my-theme.css`
2. Определите все необходимые CSS переменные для темы
3. Импортируйте файл в `index.css`
4. Добавьте новую тему в `ThemeSelector.jsx`
5. Обновите `themeSlice.js` если нужна дополнительная логика

## Автоматическое применение темы

Тема автоматически:
- Сохраняется в `localStorage` при изменении
- Загружается при старте приложения
- Применяется к `document.documentElement` через атрибут `data-theme`

## Требования

Система тем реализует следующие требования:
- **13.2** - Тема применяется немедленно при изменении (onChange)
- **13.3** - Выбор между светлой и темной темой
- **13.4** - Светлая кремовая тема по умолчанию
- **17.6** - Использование модульных CSS файлов
