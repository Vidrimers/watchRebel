#!/bin/bash

###############################################################################
# Скрипт для настройки Telegram Bot webhook
# Использование: ./scripts/setup-webhook.sh [set|delete|info]
###############################################################################

set -e

# Загрузка переменных окружения
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Проверка токена
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "❌ TELEGRAM_BOT_TOKEN не найден в .env"
    exit 1
fi

# Проверка webhook URL
if [ -z "$WEBHOOK_URL" ]; then
    echo "❌ WEBHOOK_URL не найден в .env"
    exit 1
fi

ACTION=${1:-info}

case $ACTION in
    set)
        echo "🔧 Настройка webhook..."
        FULL_URL="${WEBHOOK_URL}/webhook/${TELEGRAM_BOT_TOKEN}"
        
        RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
            -H "Content-Type: application/json" \
            -d "{\"url\": \"${FULL_URL}\"}")
        
        if echo "$RESPONSE" | grep -q '"ok":true'; then
            echo "✅ Webhook успешно настроен"
            echo "📍 URL: ${FULL_URL}"
        else
            echo "❌ Ошибка настройки webhook"
            echo "$RESPONSE"
            exit 1
        fi
        ;;
        
    delete)
        echo "🗑️  Удаление webhook..."
        RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook")
        
        if echo "$RESPONSE" | grep -q '"ok":true'; then
            echo "✅ Webhook успешно удален"
            echo "ℹ️  Бот переключен в polling режим"
        else
            echo "❌ Ошибка удаления webhook"
            echo "$RESPONSE"
            exit 1
        fi
        ;;
        
    info)
        echo "ℹ️  Информация о webhook..."
        RESPONSE=$(curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo")
        echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
        ;;
        
    *)
        echo "Использование: $0 [set|delete|info]"
        echo ""
        echo "Команды:"
        echo "  set    - Установить webhook"
        echo "  delete - Удалить webhook (переключиться на polling)"
        echo "  info   - Показать информацию о текущем webhook"
        exit 1
        ;;
esac
