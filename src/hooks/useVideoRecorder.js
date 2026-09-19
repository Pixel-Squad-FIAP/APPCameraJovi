import { useCallback, useEffect, useRef, useState } from 'react';

const MIME_TYPE_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm;codecs=h264',
  'video/webm'
];

function getSupportedMimeType() {
  if (!window.MediaRecorder) return null;
  if (typeof window.MediaRecorder.isTypeSupported !== 'function') return '';

  return MIME_TYPE_CANDIDATES.find((mimeType) => window.MediaRecorder.isTypeSupported(mimeType)) || '';
}

function getVideoTracks(stream) {
  return stream?.getVideoTracks?.().filter((track) => track.readyState === 'live') || [];
}

export function useVideoRecorder() {
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(null);
  const stopPromiseRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState('');

  const cancelRecording = useCallback(() => {
    const recorder = recorderRef.current;
    stopPromiseRef.current = null;
    chunksRef.current = [];
    startedAtRef.current = null;
    recorderRef.current = null;
    setIsRecording(false);

    if (recorder?.state === 'recording') {
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      recorder.stop();
    }
  }, []);

  const startRecording = useCallback((stream) => {
    if (!window.MediaRecorder) {
      throw new Error('Este navegador não oferece suporte à gravação de vídeo.');
    }

    if (recorderRef.current?.state === 'recording') {
      throw new Error('Uma gravação já está em andamento.');
    }

    if (!stream || getVideoTracks(stream).length === 0) {
      throw new Error('A câmera precisa estar ativa para iniciar a gravação.');
    }

    const mimeType = getSupportedMimeType();
    const recorder = mimeType
      ? new window.MediaRecorder(stream, { mimeType })
      : new window.MediaRecorder(stream);

    chunksRef.current = [];
    startedAtRef.current = Date.now();
    setRecordingError('');

    recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onerror = () => {
      setRecordingError('O navegador interrompeu a gravação de vídeo.');
    };

    recorderRef.current = recorder;
    try {
      recorder.start(250);
    } catch {
      recorderRef.current = null;
      chunksRef.current = [];
      startedAtRef.current = null;
      throw new Error('Não foi possível iniciar a gravação de vídeo.');
    }

    setIsRecording(true);

    return recorder.mimeType || mimeType || 'video/webm';
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;

    if (!recorder || recorder.state !== 'recording') {
      return Promise.reject(new Error('Nenhuma gravação de vídeo está em andamento.'));
    }

    if (stopPromiseRef.current) {
      return stopPromiseRef.current;
    }

    stopPromiseRef.current = new Promise((resolve, reject) => {
      recorder.onstop = () => {
        const chunks = chunksRef.current;
        const duration = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
        const mimeType = recorder.mimeType || chunks[0]?.type || 'video/webm';

        recorderRef.current = null;
        stopPromiseRef.current = null;
        chunksRef.current = [];
        startedAtRef.current = null;
        setIsRecording(false);

        const blob = new Blob(chunks, { type: mimeType });
        if (blob.size === 0) {
          reject(new Error('A gravação terminou sem dados de vídeo.'));
          return;
        }

        resolve({ blob, duration, mimeType });
      };

      recorder.onerror = () => {
        recorderRef.current = null;
        stopPromiseRef.current = null;
        chunksRef.current = [];
        startedAtRef.current = null;
        setIsRecording(false);
        setRecordingError('Não foi possível finalizar a gravação de vídeo.');
        reject(new Error('Não foi possível finalizar a gravação de vídeo.'));
      };

      recorder.stop();
    });

    return stopPromiseRef.current;
  }, []);

  useEffect(() => cancelRecording, [cancelRecording]);

  return {
    cancelRecording,
    isRecording,
    recordingError,
    startRecording,
    stopRecording
  };
}
