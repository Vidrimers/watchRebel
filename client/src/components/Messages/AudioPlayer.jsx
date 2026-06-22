import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './AudioPlayer.module.css';

let currentSource = null;
let currentCtx = null;

const AudioPlayer = ({ src }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const progressRef = useRef(null);
  const audioBufferRef = useRef(null);
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);
  const animRef = useRef(null);

  useEffect(() => {
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
          setReady(true);
        }
      } catch (e) {
        console.error('Audio decode error:', e);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [src]);

  const updateTime = useCallback(() => {
    if (currentSource && currentCtx) {
      const elapsed = currentCtx.currentTime - startTimeRef.current + offsetRef.current;
      setCurrentTime(Math.min(elapsed, duration));
      animRef.current = requestAnimationFrame(updateTime);
    }
  }, [duration]);

  const stopPlayback = useCallback(() => {
    if (currentSource) {
      try { currentSource.stop(); } catch {}
      currentSource = null;
    }
    if (currentCtx) {
      try { currentCtx.close(); } catch {}
      currentCtx = null;
    }
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
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
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };

    currentSource = source;
    currentCtx = ctx;
    setIsPlaying(true);
    animRef.current = requestAnimationFrame(updateTime);
  }, [isPlaying, stopPlayback, updateTime]);

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
      offsetRef.current = newOffset;
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
      currentSource = source;
      currentCtx = ctx;
      setIsPlaying(true);
      animRef.current = requestAnimationFrame(updateTime);
    } else {
      offsetRef.current = newOffset;
      setCurrentTime(newOffset);
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
        disabled={!ready}
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
