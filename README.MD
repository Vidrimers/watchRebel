# watchRebel - Социальная сеть для любителей кино

Веб-приложение для любителей фильмов и сериалов с интеграцией TMDb API и Telegram Bot.

## Структура проекта

```
watchrebel/
├── client/          # React frontend (Vite)
├── server/          # Express backend
├── telegram-bot/    # Telegram бот
└── .env            # Переменные окружения
```

## Установка

### 1. Установка зависимостей

```bash
npm install
npm run install:all
```

### 2. Настройка переменных окружения

Скопируйте `.env.example` в `.env` и заполните необходимые значения:

```bash
cp .env.example .env
```

Обязательные переменные:
- `TELEGRAM_BOT_TOKEN` - токен вашего Telegram бота
- `TMDB_API_KEY` - API ключ от TMDb
- `SESSION_SECRET` - секретный ключ для сессий

### 3. Запуск проекта

**Запуск всех компонентов одновременно (разработка):**
```bash
npm run dev
```

**Запуск отдельных компонентов:**

Frontend (React):
```bash
npm run dev:client
```

Backend (Express):
```bash
npm run dev:server
# или для production
npm run start
```

Telegram Bot:
```bash
npm run dev:tg
# или для production
npm run tg
```

## Доступ

- Frontend: http://localhost:3000
- Backend API: http://localhost:1313
- Health check: http://localhost:1313/api/health
- Тестирование интеграции: http://localhost:3000/integration-test

## Тестирование

### Автоматические тесты интеграции

```bash
node test-integration.js
```

### UI тесты

Откройте в браузере: http://localhost:3000/integration-test

### Документация по тестированию

- [Быстрый старт](./docs/QUICK_START.md)
- [Руководство по тестированию интеграции](./docs/INTEGRATION_TESTING.md)
- [Результаты тестов](./docs/INTEGRATION_TEST_RESULTS.md)

## Production развертывание

### Быстрый деплой

```bash
export NODE_ENV=production
./scripts/deploy.sh
```

### Миграции базы данных

```bash
npm run migrate
```

### Резервное копирование

```bash
npm run backup
```

### Настройка Telegram Webhook

```bash
# Установить webhook
./scripts/setup-webhook.sh set

# Проверить статус
./scripts/setup-webhook.sh info
```

### Подробная документация

См. [Production Setup Guide](./docs/PRODUCTION_SETUP.md) для полной инструкции по развертыванию.

## Технологии

### Frontend
- React 18
- Vite
- Redux Toolkit
- React Router
- Axios

### Backend
- Node.js
- Express
- SQLite (better-sqlite3)
- TMDb API

### Telegram Bot
- node-telegram-bot-api

## Разработка

Проект использует workspaces для управления монорепозиторием. Каждый компонент (client, server, telegram-bot) имеет свой package.json и может разрабатываться независимо.

## Лицензия

Частный проект
