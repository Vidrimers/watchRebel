# Скрипты watchRebel

Этот каталог содержит утилиты для управления приложением watchRebel.

## Доступные скрипты

### deploy.sh

Автоматическое развертывание приложения в production.

**Использование:**
```bash
export NODE_ENV=production
./scripts/deploy.sh
```

**Что делает:**
1. Проверяет окружение и .env файл
2. Устанавливает зависимости
3. Выполняет миграции БД
4. Создает резервную копию
5. Собирает frontend
6. Запускает приложение с PM2
7. Проверяет здоровье API

### setup-webhook.sh

Управление Telegram Bot webhook.

**Использование:**
```bash
# Установить webhook
./scripts/setup-webhook.sh set

# Удалить webhook (вернуться к polling)
./scripts/setup-webhook.sh delete

# Показать информацию о webhook
./scripts/setup-webhook.sh info
```

**Требования:**
- Переменные `TELEGRAM_BOT_TOKEN` и `WEBHOOK_URL` в .env
- HTTPS для webhook (обязательно)

## Скрипты в package.json

### Миграции базы данных

```bash
# Из корня проекта
npm run migrate

# Или напрямую из server
cd server
npm run migrate
```

### Резервное копирование

```bash
# Из корня проекта
npm run backup

# Или напрямую из server
cd server
npm run backup
```

Бэкапы сохраняются в `server/backups/` с автоматической очисткой старых копий (хранятся последние 10).

## Права доступа

Сделайте скрипты исполняемыми:

```bash
chmod +x scripts/*.sh
```

## Примечания

- Все скрипты должны запускаться из корневой директории проекта
- Убедитесь, что .env файл настроен правильно
- Для production обязательно используйте HTTPS
- Регулярно создавайте резервные копии БД
