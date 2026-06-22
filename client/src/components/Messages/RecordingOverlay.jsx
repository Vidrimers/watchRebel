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
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (audioUrl && audioPreviewRef.current) {
      const audio = audioPreviewRef.current;
      const onLoaded = () => setPreviewDuration(Math.floor(audio.duration));
      const onTimeUpdate = () => setPreviewTime(Math.floor(audio.currentTime));
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
    if (isPlaying) {
      audioPreviewRef.current.pause();
    } else {
      audioPreviewRef.current.play();
    }
    setIsPlaying(!isPlaying);
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
              <Icon name={isPlaying ? 'clock' : 'feed'} size="medium" />
            </button>
            <button 
              type="button" 
              className={styles.sendBtn} 
              onClick={onSend}
              title="Отправить"
            >
              <Icon name="messages" size="medium" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default RecordingOverlay;
