import { useCallback, useEffect, useRef, useState } from 'react';

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1,mp4a',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4'
];

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

// Grava o vídeo da câmera com MediaRecorder. O microfone é pedido só ao gravar;
// se for negado, o vídeo é gravado sem áudio.
export function useVideoRecorder(streamRef) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [hasAudio, setHasAudio] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioStreamRef = useRef(null);
  const startedAtRef = useRef(0);
  const stopResolverRef = useRef(null);

  const supported = typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined';

  useEffect(() => {
    if (!isRecording) return undefined;
    const intervalId = window.setInterval(() => {
      setElapsed((Date.now() - startedAtRef.current) / 1000);
    }, 250);
    return () => window.clearInterval(intervalId);
  }, [isRecording]);

  const releaseAudio = () => {
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;
  };

  const start = useCallback(async () => {
    const videoStream = streamRef.current;
    if (!videoStream || !supported) throw new Error('Gravação de vídeo não suportada neste navegador.');

    let audioTracks = [];
    try {
      audioStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioTracks = audioStreamRef.current.getAudioTracks();
    } catch {
      audioStreamRef.current = null;
    }
    setHasAudio(audioTracks.length > 0);

    const stream = new MediaStream([...videoStream.getVideoTracks(), ...audioTracks]);
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
      const duration = (Date.now() - startedAtRef.current) / 1000;
      releaseAudio();
      stopResolverRef.current?.({ blob, duration });
      stopResolverRef.current = null;
    };

    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setElapsed(0);
    recorder.start(1000);
    setIsRecording(true);
  }, [streamRef, supported]);

  const stop = useCallback(() => new Promise((resolve) => {
    const recorder = recorderRef.current;
    setIsRecording(false);
    if (!recorder || recorder.state === 'inactive') {
      resolve(null);
      return;
    }
    stopResolverRef.current = resolve;
    recorder.stop();
  }), []);

  useEffect(() => () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    releaseAudio();
  }, []);

  return { supported, isRecording, elapsed, hasAudio, start, stop };
}
