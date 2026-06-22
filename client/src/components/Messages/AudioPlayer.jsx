import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './AudioPlayer.module.css';

let currentMedia = null;

const AudioPlayer = ({ src }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const mediaRef = useRef(null);
  const progressRef = useRef(null);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    const onLoaded = () => {
      const dur = media.duration;
      setDuration(isFinite(dur) ? dur : 0);
    };
    const onTimeUpdate = () => {
      const ct = media.currentTime;
      setCurrentTime(isFinite(ct) ? ct : 0);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    media.addEventListener('loadedmetadata', onLoaded);
    media.addEventListener('timeupdate', onTimeUpdate);
    media.addEventListener('ended', onEnded);

    return () => {
      media.removeEventListener('loadedmetadata', onLoaded);
      media.removeEventListener('timeupdate', onTimeUpdate);
      media.removeEventListener('ended', onEnded);
    };
  }, [src]);

  const togglePlay = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;

    if (isPlaying) {
      media.pause();
      setIsPlaying(false);
    } else {
      if (currentMedia && currentMedia !== media) {
        currentMedia.pause();
        currentMedia.currentTime = 0;
      }
      currentMedia = media;
      media.load();
      media.oncanplay = () => {
        media.oncanplay = null;
        media.play().then(() => {
          setIsPlaying(true);
        }).catch(err => {
          console.error('Ошибка воспроизведения аудио:', err);
        });
      };
    }
  }, [isPlaying]);

  const handleProgressClick = (e) => {
    const rect = progressRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const media = mediaRef.current;
    if (media && duration) {
      media.currentTime = pos * duration;
      setCurrentTime(media.currentTime);
    }
  };

  const formatTime = (t) => {
    if (!t || !isFinite(t) || isNaN(t)) return '0:00';
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className={styles.player}>
      <video ref={mediaRef} src={src} preload="metadata" style={{ display: 'none' }} />
      
      <button 
        type="button" 
        className={styles.playBtn} 
        onClick={togglePlay}
      >
        {isPlaying ? (
          <div className={styles.pauseIcon}>
            <span /><span />
          </div>
        ) : (
          <div className={styles.playIcon} />
        )}
      </button>
      
      <div className={styles.progressContainer} ref={progressRef} onClick={handleProgressClick}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      </div>
      
      <span className={styles.time}>
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
};

export default AudioPlayer;
