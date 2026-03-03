import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

/**
 * Сжатие изображения если оно больше указанного размера
 * @param {string} filePath - Путь к файлу изображения
 * @param {number} maxSizeMB - Максимальный размер в мегабайтах (по умолчанию 3MB)
 * @returns {Promise<string>} - Путь к обработанному изображению
 */
export async function compressImage(filePath, maxSizeMB = 3) {
  try {
    // Получаем информацию о файле
    const stats = await fs.stat(filePath);
    const fileSizeInMB = stats.size / (1024 * 1024);

    console.log(`📊 Размер изображения: ${fileSizeInMB.toFixed(2)} MB`);

    // Проверяем расширение файла
    const ext = path.extname(filePath).toLowerCase();
    
    // Для GIF не применяем сжатие через sharp (чтобы сохранить анимацию)
    if (ext === '.gif') {
      console.log('🎬 GIF файл - пропускаем сжатие для сохранения анимации');
      return filePath;
    }

    // Если файл меньше максимального размера, возвращаем исходный путь
    if (fileSizeInMB <= maxSizeMB) {
      console.log('✅ Изображение не требует сжатия');
      return filePath;
    }

    console.log('🔄 Начинаем сжатие изображения...');

    // Получаем информацию об изображении
    const image = sharp(filePath);
    const metadata = await image.metadata();

    // Определяем максимальные размеры
    const maxWidth = 1920;
    const maxHeight = 1920;

    // Вычисляем новые размеры с сохранением пропорций
    let newWidth = metadata.width;
    let newHeight = metadata.height;

    if (newWidth > maxWidth || newHeight > maxHeight) {
      const ratio = Math.min(maxWidth / newWidth, maxHeight / newHeight);
      newWidth = Math.round(newWidth * ratio);
      newHeight = Math.round(newHeight * ratio);
    }

    // Создаем временный путь для сжатого изображения
    const compressedPath = filePath.replace(ext, `_compressed${ext}`);

    // Сжимаем изображение
    await sharp(filePath)
      .resize(newWidth, newHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 85, progressive: true }) // Конвертируем в JPEG с качеством 85%
      .toFile(compressedPath);

    // Проверяем размер сжатого файла
    const compressedStats = await fs.stat(compressedPath);
    const compressedSizeInMB = compressedStats.size / (1024 * 1024);

    console.log(`✅ Изображение сжато: ${compressedSizeInMB.toFixed(2)} MB`);

    // Удаляем оригинальный файл
    await fs.unlink(filePath);

    // Переименовываем сжатый файл в оригинальное имя
    const finalPath = filePath.replace(ext, '.jpg'); // Меняем расширение на .jpg
    await fs.rename(compressedPath, finalPath);

    return finalPath;
  } catch (error) {
    console.error('❌ Ошибка при сжатии изображения:', error);
    throw error;
  }
}

/**
 * Валидация типа изображения
 * @param {string} mimetype - MIME тип файла
 * @returns {boolean} - true если тип разрешен
 */
export function isValidImageType(mimetype) {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
  ];
  return allowedTypes.includes(mimetype);
}

/**
 * Получение расширения файла по MIME типу
 * @param {string} mimetype - MIME тип файла
 * @returns {string} - Расширение файла
 */
export function getExtensionFromMimetype(mimetype) {
  const extensions = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp'
  };
  return extensions[mimetype] || '.jpg';
}
