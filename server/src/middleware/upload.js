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
const imagesDir = path.join(__dirname, '../../uploads/images');
const advertisingDir = path.join(__dirname, '../../uploads/advertising');
const bugReportsDir = path.join(__dirname, '../../uploads/bug-reports');

if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}
if (!fs.existsSync(announcementsDir)) {
  fs.mkdirSync(announcementsDir, { recursive: true });
}
if (!fs.existsSync(messagesDir)) {
  fs.mkdirSync(messagesDir, { recursive: true });
}
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}
if (!fs.existsSync(bugReportsDir)) {
  fs.mkdirSync(bugReportsDir, { recursive: true });
}
if (!fs.existsSync(advertisingDir)) {
  fs.mkdirSync(advertisingDir, { recursive: true });
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

// Настройка хранилища для изображений постов
const postImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, imagesDir);
  },
  filename: (req, file, cb) => {
    // Генерируем уникальное имя файла: userId_timestamp_random.ext
    const userId = req.user.id;
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000); // Добавляем случайное число
    const ext = path.extname(file.originalname);
    const filename = `${userId}_${timestamp}_${random}${ext}`;
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

// Настройка multer для изображений объявлений (до 5 изображений)
const uploadAnnouncement = multer({
  storage: announcementStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Максимум 5MB на изображение
    files: 5 // Максимум 5 изображений
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

// Настройка multer для изображений постов (до 10 изображений, 10MB каждое)
const uploadPostImages = multer({
  storage: postImageStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // Максимум 10MB (будет сжато до 3MB)
    files: 10 // Максимум 10 изображений
  }
});

// Настройка multer для изображений комментариев (1 изображение, 10MB)
const uploadCommentImage = multer({
  storage: postImageStorage, // Используем то же хранилище что и для постов
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // Максимум 10MB
    files: 1
  }
});

// Настройка хранилища для изображений багрепортов
const bugReportStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, bugReportsDir);
  },
  filename: (req, file, cb) => {
    // Генерируем уникальное имя файла: userId_timestamp_random.ext
    const userId = req.user.id;
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const ext = path.extname(file.originalname);
    const filename = `${userId}_${timestamp}_${random}${ext}`;
    cb(null, filename);
  }
});

// Настройка multer для изображений багрепортов (до 5 изображений, 5MB каждое)
const uploadBugReportImages = multer({
  storage: bugReportStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Максимум 5MB
    files: 5 // Максимум 5 изображений
  }
});

// Настройка хранилища для изображений рекламы
const advertisingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, advertisingDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `ad_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;
    cb(null, filename);
  }
});

// Настройка multer для изображений рекламы (до 5 изображений, 5MB каждое)
const uploadAdvertisingImages = multer({
  storage: advertisingStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5
  }
});

// Настройка хранилища для изображений заявок на рекламу
const adRequestsDir = path.join(__dirname, '../../uploads/ad-requests');
if (!fs.existsSync(adRequestsDir)) {
  fs.mkdirSync(adRequestsDir, { recursive: true });
}

const adRequestStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, adRequestsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `adreq_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;
    cb(null, filename);
  }
});

const uploadAdRequestImages = multer({
  storage: adRequestStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  }
});

export { uploadAvatar, uploadAnnouncement, uploadMessageFiles, uploadPostImages, uploadCommentImage, uploadBugReportImages, uploadAdvertisingImages, uploadAdRequestImages };
export default uploadAvatar;
