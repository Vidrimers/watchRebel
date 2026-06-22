import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './AudioPlayer.module.css';

const AudioPlayer = ({ src, audioBuffer: propBuffer }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressRef = useRef(null);
  const audioBufferRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (propBuffer) {
      audioBufferRef.current = propBuffer;
      setDuration(propBuffer.duration);
      return;
    }
    if (!src) return;
    let cancelled = false;
    const load = async () => {
      try {
        const resp = await fetch(src);
        const arr = await resp.arrayBuffer();
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const buf = await ctx.decodeAudioData(arr);
        ctx.close();
        if (!cancelled) {
          audioBufferRef.current = buf;
          setDuration(buf.duration);
        }
      } catch (e) {
        console.error('Audio decode error:', e);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [src, propBuffer]);

  const stopPlayback = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
      setIsPlaying(false);
      return;
    }

    const buf = audioBufferRef.current;
    if (!buf) return;

    stopPlayback();

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.connect(ctx.destination);

    const offset = offsetRef.current;
    startTimeRef.current = ctx.currentTime;
    source.start(0, offset);

    source.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      offsetRef.current = 0;
    };

    sourceRef.current = source;
    audioCtxRef.current = ctx;
    setIsPlaying(true);

    timerRef.current = setInterval(() => {
      if (audioCtxRef.current) {
        const elapsed = audioCtxRef.current.currentTime - startTimeRef.current + offset;
        const ct = Math.min(elapsed, duration);
        setCurrentTime(ct);
      }
    }, 100);
  }, [isPlaying, stopPlayback, duration]);

  useEffect(() => {
    return () => stopPlayback();
  }, [stopPlayback]);

  const handleProgressClick = (e) => {
    if (!audioBufferRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newOffset = pos * duration;

    if (isPlaying) {
      stopPlayback();
    }

    offsetRef.current = newOffset;
    setCurrentTime(newOffset);

    if (isPlaying) {
      const buf = audioBufferRef.current;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.connect(ctx.destination);
      startTimeRef.current = ctx.currentTime;
      source.start(0, newOffset);
      source.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        offsetRef.current = 0;
      };
      sourceRef.current = source;
      audioCtxRef.current = ctx;
      setIsPlaying(true);
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
