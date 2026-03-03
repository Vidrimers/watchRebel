/**
 * Утилиты для парсинга и обработки ссылок в тексте
 */

/**
 * Регулярное выражение для поиска URL
 */
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

/**
 * Регулярные выражения для YouTube ссылок
 */
const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const YOUTUBE_SHORTS_REGEX = /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/;

/**
 * Извлекает YouTube video ID из URL
 * @param {string} url - URL видео
 * @returns {string|null} - Video ID или null
 */
export const extractYouTubeId = (url) => {
  // Проверяем обычные видео
  let match = url.match(YOUTUBE_REGEX);
  if (match && match[1]) {
    return match[1];
  }
  
  // Проверяем shorts
  match = url.match(YOUTUBE_SHORTS_REGEX);
  if (match && match[1]) {
    return match[1];
  }
  
  return null;
};

/**
 * Проверяет, является ли URL ссылкой на YouTube
 * @param {string} url - URL для проверки
 * @returns {boolean}
 */
export const isYouTubeUrl = (url) => {
  return extractYouTubeId(url) !== null;
};

/**
 * Находит все URL в тексте
 * @param {string} text - Текст для поиска
 * @returns {Array<{url: string, start: number, end: number}>}
 */
export const findUrls = (text) => {
  if (!text) return [];
  
  const urls = [];
  let match;
  
  while ((match = URL_REGEX.exec(text)) !== null) {
    urls.push({
      url: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }
  
  return urls;
};

/**
 * Разбивает текст на части: обычный текст и ссылки
 * @param {string} text - Исходный текст
 * @returns {Array<{type: 'text'|'link', content: string, isYouTube?: boolean, videoId?: string}>}
 */
export const parseTextWithLinks = (text) => {
  if (!text) return [];
  
  const urls = findUrls(text);
  if (urls.length === 0) {
    return [{ type: 'text', content: text }];
  }
  
  const parts = [];
  let lastIndex = 0;
  
  urls.forEach(({ url, start, end }) => {
    // Добавляем текст до ссылки
    if (start > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, start)
      });
    }
    
    // Добавляем ссылку
    const videoId = extractYouTubeId(url);
    parts.push({
      type: 'link',
      content: url,
      isYouTube: videoId !== null,
      videoId: videoId
    });
    
    lastIndex = end;
  });
  
  // Добавляем оставшийся текст
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
  }
  
  return parts;
};
