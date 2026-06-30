import React from 'react';
import { parseTextWithLinks } from '../../utils/linkParser';
import YouTubeEmbed from './YouTubeEmbed';
import styles from './LinkifiedText.module.css';

/**
 * Компонент для отображения текста с кликабельными ссылками и превью YouTube
 * @param {string} text - Текст для обработки
 */
const MENTION_REGEX = /@\[([^\]]+)\]\(([^)]+)\)/g;

const parseTextWithMentions = (text) => {
  const result = [];
  let lastIndex = 0;
  let match;

  MENTION_REGEX.lastIndex = 0;
  while ((match = MENTION_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    }
    result.push({ type: 'mention', displayName: match[1], userId: match[2] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push({ type: 'text', content: text.substring(lastIndex) });
  }

  return result;
};

const LinkifiedText = ({ text }) => {
  if (!text) return null;

  // Сначала парсим упоминания, потом ссылки в каждом текстовом куске
  const mentionParts = parseTextWithMentions(text);
  const parts = [];
  mentionParts.forEach(part => {
    if (part.type === 'mention') {
      parts.push(part);
    } else {
      parts.push(...parseTextWithLinks(part.content));
    }
  });
  
  // Группируем части: текст и обычные ссылки идут вместе, YouTube отдельно
  const elements = [];
  let textBuffer = [];
  
  parts.forEach((part, index) => {
    if (part.type === 'text') {
      textBuffer.push(part.content);
    } else if (part.type === 'mention') {
      textBuffer.push(
        <a
          key={`mention-${index}`}
          href={`/user/${part.userId}`}
          className={styles.mention}
        >
          @{part.displayName}
        </a>
      );
    } else if (part.type === 'link' && !part.isYouTube) {
      // Обычная ссылка - добавляем как часть текста
      textBuffer.push(
        <a 
          key={`link-${index}`}
          href={part.content} 
          target="_blank" 
          rel="noopener noreferrer"
          className={styles.link}
        >
          {part.content}
        </a>
      );
    } else if (part.type === 'link' && part.isYouTube) {
      // YouTube ссылка - сначала сохраняем накопленный текст
      if (textBuffer.length > 0) {
        elements.push(
          <p key={`text-${index}`} className={styles.textParagraph}>
            {textBuffer}
          </p>
        );
        textBuffer = [];
      }
      
      // Добавляем YouTube embed
      elements.push(
        <YouTubeEmbed 
          key={`youtube-${index}`}
          videoId={part.videoId}
          url={part.content}
        />
      );
    }
  });
  
  // Добавляем оставшийся текст
  if (textBuffer.length > 0) {
    elements.push(
      <p key="text-final" className={styles.textParagraph}>
        {textBuffer}
      </p>
    );
  }
  
  return <div className={styles.linkifiedText}>{elements}</div>;
};

export default LinkifiedText;
