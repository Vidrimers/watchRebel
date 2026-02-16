#!/usr/bin/env node

/**
 * Скрипт для выполнения миграций базы данных
 * Использование: node scripts/migrate.js
 */

import { runMigrations } from '../src/database/migrations.js';
import { closeDatabase } from '../src/database/db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загрузка переменных окружения
dotenv.config({ path: path.join(__dirname, '../../.env') });

console.log('🔄 Запуск миграций базы данных...');
console.log(`📁 База данных: ${process.env.DB_PATH || './server/rebel.db'}`);
console.log(`🌍 Окружение: ${process.env.NODE_ENV || 'development'}`);
console.log('');

async function migrate() {
  try {
    const result = await runMigrations();
    
    if (result.success) {
      console.log('');
      console.log('✅ Миграции успешно выполнены!');
      process.exit(0);
    } else {
      console.error('');
      console.error('❌ Ошибка выполнения миграций:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('');
    console.error('❌ Критическая ошибка:', error.message);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

migrate();
