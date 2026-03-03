import React from 'react';
import styles from './YouTubeEmbed.module.css';

/**
 * Компонент для встраивания YouTube видео
 * @param {string} videoId - ID YouTube видео
 * @param {string} url - Оригинальная ссылка (для отображения под плеером)
 */
const YouTubeEmbed = ({ videoId, url }) => {
  return (
    <div className={styles.youtubeEmbed}>
      <div className={styles.videoWrapper}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className={styles.iframe}
        />
      </div>
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        className={styles.sourceLink}
      >
        {url}
      </a>
    </div>
  );
};

export default YouTubeEmbed;
