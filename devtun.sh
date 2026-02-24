#!/bin/bash
# Запуск watchRebel через tuna.am

npx concurrently \
  "tuna http 1313 --domain=dev.watchrebel.ru" \
  "npm run dev:server" \
  "npm run dev:tg"
