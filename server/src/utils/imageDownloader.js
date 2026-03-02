import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Скачивает изображение с TMDb и сохраняет локально
 * @param {string} tmdbPath - Путь к изображению на TMDb (например: /66RvLrRJTm4J8l3uHXWF09AICol.jpg)
 * @param {string} subfolder - Подпапка для сохранения (например: 'posters')
 * @returns {Promise<string>} - Локальный путь к сохраненному изображению
 */
export async function downloadImage(tmdbPath, subfolder = 'posters') {
  if (!tmdbPath) {
    throw new Error('TMDb путь к изображению не указан');
  }

  // Убираем начальный слеш если есть
  const cleanPath = tmdbPath.startsWith('/') ? tmdbPath.slice(1) : tmdbPath;
  
  // Создаем директорию для хранения изображений
  const uploadsDir = path.join(__dirname, '../../uploads', subfolder);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Генерируем имя файла
  const filename = cleanPath;
  const localPath = path.join(uploadsDir, filename);

  // Проверяем, не скачан ли уже файл
  if (fs.existsSync(localPath)) {
    console.log(`📁 Изображение уже существует: ${filename}`);
    return `/uploads/${subfolder}/${filename}`;
  }

  // URL для скачивания (используем w500 для постеров)
  const imageUrl = `https://image.tmdb.org/t/p/w500${tmdbPath}`;

  return new Promise((resolve, reject) => {
    console.log(`⬇️  Скачивание изображения: ${imageUrl}`);

    https.get(imageUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Ошибка скачивания: HTTP ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(localPath);
      
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`✅ Изображение сохранено: ${filename}`);
        resolve(`/uploads/${subfolder}/${filename}`);
      });

      fileStream.on('error', (err) => {
        fs.unlink(localPath, () => {}); // Удаляем частично скачанный файл
        reject(err);
      });

    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Удаляет локальное изображение
 * @param {string} localPath - Локальный путь к изображению (например: /uploads/posters/image.jpg)
 */
export function deleteImage(localPath) {
  if (!localPath || !localPath.startsWith('/uploads/')) {
    return; // Не удаляем если это не наше изображение
  }

  const fullPath = path.join(__dirname, '../..', localPath);
  
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    console.log(`🗑️  Изображение удалено: ${localPath}`);
  }
}
