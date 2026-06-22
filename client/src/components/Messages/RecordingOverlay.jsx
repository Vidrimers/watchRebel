import React, { useState, useRef, useEffect } from 'react';
import Icon from '../Common/Icon';
import styles from './RecordingOverlay.module.css';

const RecordingOverlay = ({ 
  recordingTime, 
  analyserData, 
  audioUrl, 
  isRecording, 
  onSend, 
  onCancel, 
  onStop 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const audioPreviewRef = useRef(null);
  const canvasRef = useRef(null);

  const formatTime = (seconds) => {
    if (!seconds || !isFinite(seconds) || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (audioUrl && audioPreviewRef.current) {
      const audio = audioPreviewRef.current;
      const onLoaded = () => {
        const dur = audio.duration;
        setPreviewDuration(isFinite(dur) ? Math.floor(dur) : 0);
      };
      const onTimeUpdate = () => {
        const ct = audio.currentTime;
        setPreviewTime(isFinite(ct) ? Math.floor(ct) : 0);
      };
      const onEnded = () => setIsPlaying(false);
      
      audio.addEventListener('loadedmetadata', onLoaded);
      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('ended', onEnded);
      
      return () => {
        audio.removeEventListener('loadedmetadata', onLoaded);
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('ended', onEnded);
      };
    }
  }, [audioUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
      ctx.clearRect(0, 0, width, height);
      
      const barCount = 40;
      const barWidth = width / barCount - 2;
      const step = Math.floor(analyserData.length / barCount);
      
      const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim() || '#6366f1';
      const accentActiveColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary-active').trim() || '#4f46e5';
      
      for (let i = 0; i < barCount; i++) {
        const value = analyserData[i * step] || 0;
        const barHeight = Math.max(2, (value / 255) * height * 0.9);
        const x = i * (barWidth + 2);
        const y = (height - barHeight) / 2;
        
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, accentColor);
        gradient.addColorStop(1, accentActiveColor);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
      ctx.fill();
    }
  }, [analyserData]);

  const togglePreview = () => {
    if (!audioPreviewRef.current) return;
    const audio = audioPreviewRef.current;
    
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.currentTime = 0;
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error('Preview play error:', err);
      });
    }
  };

  const isPreview = !!audioUrl && !isRecording;

  return (
    <div className={styles.overlay}>
      <audio ref={audioPreviewRef} src={audioUrl} />
      
      <div className={styles.topBar}>
        <span className={styles.timer}>
          {isPreview ? formatTime(previewDuration) : formatTime(recordingTime)}
        </span>
        {isRecording && (
          <span className={styles.recordingDot} />
        )}
      </div>
      
      <div className={styles.visualizer}>
        <canvas ref={canvasRef} width={300} height={60} className={styles.canvas} />
      </div>
      
      <div className={styles.controls}>
        <button 
          type="button" 
          className={styles.cancelBtn} 
          onClick={onCancel}
          title="Отмена"
        >
          <Icon name="delete" size="medium" />
        </button>
        
        {isRecording ? (
          <button 
            type="button" 
            className={styles.stopBtn} 
            onClick={onStop}
            title="Остановить"
          >
            <div className={styles.stopIcon} />
          </button>
        ) : isPreview ? (
          <>
            <button 
              type="button" 
              className={styles.playBtn} 
              onClick={togglePreview}
              title={isPlaying ? 'Пауза' : 'Прослушать'}
            >
              {isPlaying ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <rect x="6" y="4" width="4" height="16" rx="1"/>
                  <rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <polygon points="6,4 20,12 6,20"/>
                </svg>
              )}
            </button>
            <button 
              type="button" 
              className={styles.sendBtn} 
              onClick={onSend}
              title="Отправить"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default RecordingOverlay;
