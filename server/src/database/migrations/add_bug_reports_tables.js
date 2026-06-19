import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Миграция: Создание таблиц bug_reports и bug_report_images для системы багрепортов
 * Дата: 2026-03-06
 */

const dbPath = path.join(__dirname, '../../../rebel.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('🔄 Создание таблицы bug_reports...');

  // Создание таблицы bug_reports
  db.run(`
    CREATE TABLE IF NOT EXISTS bug_reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'in_progress', 'resolved', 'rejected')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('❌ Ошибка создания таблицы bug_reports:', err.message);
      db.close();
      return;
    }
    console.log('✅ Таблица bug_reports успешно создана');

    // Создание таблицы bug_report_images
    console.log('🔄 Создание таблицы bug_report_images...');
    db.run(`
      CREATE TABLE IF NOT EXISTS bug_report_images (
        id TEXT PRIMARY KEY,
        bug_report_id TEXT NOT NULL,
        image_path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bug_report_id) REFERENCES bug_reports(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('❌ Ошибка создания таблицы bug_report_images:', err.message);
      } else {
        console.log('✅ Таблица bug_report_images успешно создана');
      }
      db.close();
    });
  });
});
