import { useState, useRef, useCallback } from 'react';

const MAX_DURATION = 5 * 60;
const MIN_DURATION = 1;

const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [analyserData, setAnalyserData] = useState(new Uint8Array(0));
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);

  const updateAnalyser = useCallback(() => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    setAnalyserData(new Uint8Array(dataArray));
    animFrameRef.current = requestAnimationFrame(updateAnalyser);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setAudioBuffer(null);
      setAudioBlob(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });

        try {
          const arrayBuffer = await blob.arrayBuffer();
          const decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
          const decodedBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
          decodeCtx.close();
          setAudioBuffer(decodedBuffer);
        } catch (e) {
          console.error('Failed to decode recorded audio:', e);
          setError('Не удалось декодировать запись');
        }

        setAudioBlob(blob);
        stopTimer();
        cleanupStream();
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_DURATION) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

      updateAnalyser();
    } catch (err) {
      console.error('Recording error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Доступ к микрофону запрещён');
      } else if (err.name === 'NotFoundError') {
        setError('Микрофон не найден');
      } else {
        setError('Не удалось начать запись');
      }
    }
  }, [updateAnalyser, stopTimer, cleanupStream]);

  const stopRecording = useCallback(() => {
    if (recordingTime < MIN_DURATION) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      cleanupStream();
      stopTimer();
      setIsRecording(false);
      setRecordingTime(0);
      setAudioBuffer(null);
      setAudioBlob(null);
      setError('Запись слишком короткая (минимум 1 секунда)');
      return;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, [recordingTime, cleanupStream, stopTimer]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    chunksRef.current = [];
    setAudioBuffer(null);
    setAudioBlob(null);
    setRecordingTime(0);
    setIsRecording(false);
    stopTimer();
    cleanupStream();
    setError(null);
  }, [stopTimer, cleanupStream]);

  const reset = useCallback(() => {
    cancelRecording();
  }, [cancelRecording]);

  return {
    isRecording,
    recordingTime,
    audioBuffer,
    audioBlob,
    analyserData,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    reset
  };
};

export default useAudioRecorder;
