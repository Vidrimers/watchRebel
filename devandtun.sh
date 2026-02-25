#!/bin/bash
# Запуск watchRebel через tuna.am

npx concurrently \
  "tuna http 3000 --domain=dev.watchrebel.ru" \
  "npm run dev:client" \
  "npm run dev:server" \
  "npm run dev:tg"
