import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к базе данных (используем тестовую БД если NODE_ENV === 'test')
const DB_PATH = process.env.NODE_ENV === 'test' 
  ? path.join(__dirname, '../../test-rebel.db')
  : path.join(__dirname, '../../rebel.db');

// Создаем подключение к базе данных
let db = null;

/**
 * Получить экземпляр базы данных
 */
export function getDatabase() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Ошибка подключения к базе данных:', err.message);
      } else {
        console.log('Подключение к базе данных установлено');
        // Включаем поддержку внешних ключей
        db.run('PRAGMA foreign_keys = ON');
      }
    });
  }
  return db;
}

/**
 * Выполнить SQL запрос с обработкой ошибок
 * @param {string} query - SQL запрос
 * @param {Array} params - Параметры запроса
 * @returns {Promise<Object>} - Результат выполнения запроса
 */
export function executeQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const db = getDatabase();
      
      // Определяем тип запроса
      const queryType = query.trim().toUpperCase().split(' ')[0];
      
      if (queryType === 'SELECT') {
        // Для SELECT возвращаем все строки
        db.all(query, params, (err, rows) => {
          if (err) {
            console.error('Database query error:', err.message);
            console.error('Query:', query);
            console.error('Params:', params);
            resolve({ 
              success: false, 
              error: err.message,
              code: err.code 
            });
          } else {
            resolve({ success: true, data: rows });
          }
        });
      } else if (queryType === 'INSERT' || queryType === 'UPDATE' || queryType === 'DELETE') {
        // Для INSERT/UPDATE/DELETE возвращаем информацию об изменениях
        db.run(query, params, function(err) {
          if (err) {
            console.error('Database query error:', err.message);
            console.error('Query:', query);
            console.error('Params:', params);
            resolve({ 
              success: false, 
              error: err.message,
              code: err.code 
            });
          } else {
            resolve({ 
              success: true, 
              changes: this.changes,
              lastInsertRowid: this.lastID 
            });
          }
        });
      } else {
        // Для других запросов (CREATE, DROP и т.д.)
        db.exec(query, (err) => {
          if (err) {
            console.error('Database query error:', err.message);
            console.error('Query:', query);
            resolve({ 
              success: false, 
              error: err.message,
              code: err.code 
            });
          } else {
            resolve({ success: true });
          }
        });
      }
    } catch (error) {
      console.error('Database query error:', error.message);
      console.error('Query:', query);
      console.error('Params:', params);
      resolve({ 
        success: false, 
        error: error.message,
        code: error.code 
      });
    }
  });
}

/**
 * Закрыть соединение с базой данных
 */
export function closeDatabase() {
  return new Promise((resolve) => {
    if (db) {
      db.close((err) => {
        if (err) {
          console.error('Ошибка закрытия базы данных:', err.message);
        }
        db = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

export default {
  getDatabase,
  executeQuery,
  closeDatabase
};
