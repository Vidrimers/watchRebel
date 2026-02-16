#!/usr/bin/env node

/**
 * Скрипт для создания резервной копии базы данных
 * Использование: node scripts/backup.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загрузка переменных окружения
dotenv.config({ path: path.join(__dirname, '../../.env') });

const DB_PATH = process.env.DB_PATH || './server/rebel.db';
const BACKUP_DIR = process.env.BACKUP_DIR || './server/backups';

console.log('💾 Создание резервной копии базы данных...');
console.log(`📁 База данных: ${DB_PATH}`);
console.log(`📂 Директория бэкапов: ${BACKUP_DIR}`);
console.log('');

async function backup() {
  try {
    // Проверяем существование базы данных
    if (!fs.existsSync(DB_PATH)) {
      console.error('❌ База данных не найдена:', DB_PATH);
      process.exit(1);
    }

    // Создаем директорию для бэкапов если её нет
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      console.log('✓ Создана директория для бэкапов');
    }

    // Формируем имя файла бэкапа с датой и временем
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupFileName = `rebel-backup-${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    // Копируем файл базы данных
    fs.copyFileSync(DB_PATH, backupPath);

    // Получаем размер файла
    const stats = fs.statSync(backupPath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log('');
    console.log('✅ Резервная копия успешно создана!');
    console.log(`📄 Файл: ${backupFileName}`);
    console.log(`📊 Размер: ${fileSizeInMB} MB`);
    console.log(`📍 Путь: ${backupPath}`);
    console.log('');

    // Очистка старых бэкапов (оставляем последние 10)
    cleanOldBackups();

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Ошибка создания бэкапа:', error.message);
    process.exit(1);
  }
}

/**
 * Удаляет старые бэкапы, оставляя только последние N
 */
function cleanOldBackups(keepCount = 10) {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('rebel-backup-') && file.endsWith('.db'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > keepCount) {
      const filesToDelete = files.slice(keepCount);
      filesToDelete.forEach(file => {
        fs.unlinkSync(file.path);
        console.log(`🗑️  Удален старый бэкап: ${file.name}`);
      });
      console.log(`✓ Очищено ${filesToDelete.length} старых бэкапов`);
    }
  } catch (error) {
    console.warn('⚠️  Ошибка очистки старых бэкапов:', error.message);
  }
}

backup();
