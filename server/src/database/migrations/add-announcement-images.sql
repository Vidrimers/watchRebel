-- Миграция: Добавление таблицы announcement_images для хранения изображений объявлений
-- Дата: 2026-03-04

-- Таблица изображений объявлений
CREATE TABLE IF NOT EXISTS announcement_images (
  id TEXT PRIMARY KEY,
  announcement_id TEXT NOT NULL,
  image_path TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
);

-- Индекс для быстрого поиска изображений по announcement_id
CREATE INDEX IF NOT EXISTS idx_announcement_images_announcement_id ON announcement_images(announcement_id);

-- Добавляем поле image_urls в таблицу wall_posts для хранения массива путей к изображениям
-- Это поле будет использоваться для объявлений с изображениями
ALTER TABLE wall_posts ADD COLUMN image_urls TEXT;
