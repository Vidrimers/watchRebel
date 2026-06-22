import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './AudioPlayer.module.css';

let currentAudio = null;

const AudioPlayer = ({ src }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);
  const progressRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => {
      const dur = audio.duration;
      setDuration(isFinite(dur) ? dur : 0);
    };
    const onTimeUpdate = () => {
      const ct = audio.currentTime;
      setCurrentTime(isFinite(ct) ? ct : 0);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (currentAudio && currentAudio !== audio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
      currentAudio = audio;
      audio.load();
      audio.oncanplay = () => {
        audio.oncanplay = null;
        audio.play().then(() => {
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
    const audio = audioRef.current;
    if (audio && duration) {
      audio.currentTime = pos * duration;
      setCurrentTime(audio.currentTime);
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
      <audio ref={audioRef} src={src} preload="metadata" />
      
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
