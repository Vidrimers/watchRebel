import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Создаем папки для загрузки файлов, если их нет
const avatarsDir = path.join(__dirname, '../../uploads/avatars');
const announcementsDir = path.join(__dirname, '../../uploads/announcements');
const messagesDir = path.join(__dirname, '../../uploads/messages');

if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}
if (!fs.existsSync(announcementsDir)) {
  fs.mkdirSync(announcementsDir, { recursive: true });
}
if (!fs.existsSync(messagesDir)) {
  fs.mkdirSync(messagesDir, { recursive: true });
}

// Настройка хранилища для аватаров
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    // Генерируем уникальное имя файла: userId_timestamp.ext
    const userId = req.params.id || req.user.id;
    const ext = path.extname(file.originalname);
    const filename = `${userId}_${Date.now()}${ext}`;
    cb(null, filename);
  }
});

// Настройка хранилища для изображений объявлений
const announcementStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, announcementsDir);
  },
  filename: (req, file, cb) => {
    // Генерируем уникальное имя файла: announcement_timestamp.ext
    const ext = path.extname(file.originalname);
    const filename = `announcement_${Date.now()}${ext}`;
    cb(null, filename);
  }
});

// Настройка хранилища для файлов сообщений
const messageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, messagesDir);
  },
  filename: (req, file, cb) => {
    // Генерируем уникальное имя файла: userId_timestamp_originalname
    const userId = req.user.id;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${userId}_${timestamp}_${basename}${ext}`;
    cb(null, filename);
  }
});

// Фильтр файлов - только изображения
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Недопустимый тип файла. Разрешены только изображения (JPEG, PNG, GIF, WebP)'), false);
  }
};

// Настройка multer для аватаров
const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // Максимум 5MB
  }
});

// Настройка multer для изображений объявлений
const uploadAnnouncement = multer({
  storage: announcementStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // Максимум 5MB
  }
});

// Настройка multer для файлов сообщений (любые типы, до 50MB)
const uploadMessageFiles = multer({
  storage: messageStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // Максимум 50MB
    files: 10 // Максимум 10 файлов за раз
  }
});

export { uploadAvatar, uploadAnnouncement, uploadMessageFiles };
export default uploadAvatar;
