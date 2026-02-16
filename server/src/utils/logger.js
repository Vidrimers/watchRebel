/**
 * Модуль логирования для watchRebel
 * Поддерживает различные уровни логирования и форматирование
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Уровни логирования
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Текущий уровень логирования (из переменных окружения)
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

// Директория для логов
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../../../logs');

// Создаем директорию для логов если её нет
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Путь к файлу логов
const LOG_FILE = path.join(LOG_DIR, `watchrebel-${new Date().toISOString().split('T')[0]}.log`);

/**
 * Форматирует сообщение лога
 * @param {string} level - Уровень логирования
 * @param {string} message - Сообщение
 * @param {Object} meta - Дополнительные данные
 * @returns {string} - Отформатированное сообщение
 */
function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level}] ${message}${metaStr}`;
}

/**
 * Записывает сообщение в файл
 * @param {string} message - Сообщение для записи
 */
function writeToFile(message) {
  // В production записываем в файл
  if (process.env.NODE_ENV === 'production') {
    try {
      fs.appendFileSync(LOG_FILE, message + '\n');
    } catch (error) {
      console.error('Ошибка записи в лог файл:', error.message);
    }
  }
}

/**
 * Логирует сообщение с указанным уровнем
 * @param {string} level - Уровень логирования
 * @param {string} message - Сообщение
 * @param {Object} meta - Дополнительные данные
 */
function log(level, message, meta = {}) {
  const levelValue = LOG_LEVELS[level];
  
  if (levelValue <= CURRENT_LEVEL) {
    const formattedMessage = formatMessage(level, message, meta);
    
    // Выводим в консоль с цветами
    switch (level) {
      case 'ERROR':
        console.error(`❌ ${formattedMessage}`);
        break;
      case 'WARN':
        console.warn(`⚠️  ${formattedMessage}`);
        break;
      case 'INFO':
        console.log(`ℹ️  ${formattedMessage}`);
        break;
      case 'DEBUG':
        console.log(`🔍 ${formattedMessage}`);
        break;
    }
    
    // Записываем в файл
    writeToFile(formattedMessage);
  }
}

/**
 * Логгер с методами для разных уровней
 */
const logger = {
  /**
   * Логирует ошибку
   * @param {string} message - Сообщение об ошибке
   * @param {Object} meta - Дополнительные данные (например, stack trace)
   */
  error(message, meta = {}) {
    log('ERROR', message, meta);
  },

  /**
   * Логирует предупреждение
   * @param {string} message - Сообщение предупреждения
   * @param {Object} meta - Дополнительные данные
   */
  warn(message, meta = {}) {
    log('WARN', message, meta);
  },

  /**
   * Логирует информационное сообщение
   * @param {string} message - Информационное сообщение
   * @param {Object} meta - Дополнительные данные
   */
  info(message, meta = {}) {
    log('INFO', message, meta);
  },

  /**
   * Логирует отладочное сообщение
   * @param {string} message - Отладочное сообщение
   * @param {Object} meta - Дополнительные данные
   */
  debug(message, meta = {}) {
    log('DEBUG', message, meta);
  },

  /**
   * Логирует HTTP запрос
   * @param {Object} req - Express request объект
   * @param {Object} res - Express response объект
   */
  http(req, res) {
    const message = `${req.method} ${req.url} - ${res.statusCode}`;
    const meta = {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      responseTime: res.get('X-Response-Time')
    };
    log('INFO', message, meta);
  }
};

/**
 * Express middleware для логирования HTTP запросов
 */
export function httpLogger(req, res, next) {
  const start = Date.now();
  
  // Логируем после завершения ответа
  res.on('finish', () => {
    const duration = Date.now() - start;
    res.set('X-Response-Time', `${duration}ms`);
    logger.http(req, res);
  });
  
  next();
}

/**
 * Очистка старых логов (оставляем последние N дней)
 * @param {number} daysToKeep - Количество дней для хранения логов
 */
export function cleanOldLogs(daysToKeep = 30) {
  try {
    const files = fs.readdirSync(LOG_DIR);
    const now = Date.now();
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

    files.forEach(file => {
      const filePath = path.join(LOG_DIR, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtime.getTime();

      if (age > maxAge) {
        fs.unlinkSync(filePath);
        logger.info(`Удален старый лог файл: ${file}`);
      }
    });
  } catch (error) {
    logger.error('Ошибка очистки старых логов', { error: error.message });
  }
}

export default logger;
