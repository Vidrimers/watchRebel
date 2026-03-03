import React from 'react';
import { parseTextWithLinks } from '../../utils/linkParser';
import YouTubeEmbed from './YouTubeEmbed';
import styles from './LinkifiedText.module.css';

/**
 * Компонент для отображения текста с кликабельными ссылками и превью YouTube
 * @param {string} text - Текст для обработки
 */
const LinkifiedText = ({ text }) => {
  if (!text) return null;

  const parts = parseTextWithLinks(text);
  
  // Группируем части: текст и обычные ссылки идут вместе, YouTube отдельно
  const elements = [];
  let textBuffer = [];
  
  parts.forEach((part, index) => {
    if (part.type === 'text') {
      textBuffer.push(part.content);
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
