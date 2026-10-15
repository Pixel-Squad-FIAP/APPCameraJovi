import { useCallback, useEffect, useRef, useState } from 'react';
import { computeCropRect } from '../lib/imageProcessing.js';

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1,mp4a',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4'
];
const FRAME_RATE = 30;
const MAX_SIDE = 1920;
const START_TIMEOUT = 5000;

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

// Grava o vídeo da câmera já recortado na proporção escolhida: cada quadro do <video>
// é desenhado num canvas (com zoom e espelhamento) e o canvas é que vai para o MediaRecorder.
// O microfone é pedido só ao gravar; se for negado, o vídeo é gravado sem áudio.
export function useVideoRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [hasAudio, setHasAudio] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioStreamRef = useRef(null);
  const canvasStreamRef = useRef(null);
  const drawLoopRef = useRef(null);
  const startedAtRef = useRef(0);
  const sizeRef = useRef({ width: 0, height: 0 });
  const stopResolverRef = useRef(null);

  const supported = typeof window !== 'undefined'
    && typeof window.MediaRecorder !== 'undefined'
    && typeof HTMLCanvasElement !== 'undefined'
    && 'captureStream' in HTMLCanvasElement.prototype;

  useEffect(() => {
    if (!isRecording) return undefined;
    const intervalId = window.setInterval(() => {
      setElapsed((Date.now() - startedAtRef.current) / 1000);
    }, 250);
    return () => window.clearInterval(intervalId);
  }, [isRecording]);

  const releaseResources = () => {
    drawLoopRef.current?.();
    drawLoopRef.current = null;
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;
    canvasStreamRef.current?.getTracks().forEach((track) => track.stop());
    canvasStreamRef.current = null;
  };

  // Desenha os quadros em ritmo fixo (mais confiável que requestVideoFrameCallback/rAF,
  // que podem pausar); retorna a função que interrompe o laço.
  const startDrawing = (video, canvas, { aspect, mirror, getZoom }) => {
    const ctx = canvas.getContext('2d');
    const draw = () => {
      if (!video.videoWidth) return;
      const crop = computeCropRect(video.videoWidth, video.videoHeight, aspect, getZoom());
      ctx.save();
      if (mirror) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    };
    draw();
    const intervalId = window.setInterval(draw, 1000 / FRAME_RATE);
    return () => window.clearInterval(intervalId);
  };

  const start = useCallback(async ({ video, aspect, mirror = false, getZoom = () => 1 }) => {
    if (!video?.videoWidth || !supported) throw new Error('Gravação de vídeo não suportada neste navegador.');

    // Tamanho do vídeo final: maior recorte possível na proporção, limitado a 1920px.
    const crop = computeCropRect(video.videoWidth, video.videoHeight, aspect, 1);
    const scale = Math.min(1, MAX_SIDE / Math.max(crop.width, crop.height));
    const canvas = document.createElement('canvas');
    // dimensões pares evitam problemas em alguns codificadores
    canvas.width = Math.round((crop.width * scale) / 2) * 2;
    canvas.height = Math.round((crop.height * scale) / 2) * 2;
    sizeRef.current = { width: canvas.width, height: canvas.height };
    canvasStreamRef.current = canvas.captureStream(FRAME_RATE);
    drawLoopRef.current = startDrawing(video, canvas, { aspect, mirror, getZoom });

    let audioTracks = [];
    try {
      audioStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioTracks = audioStreamRef.current.getAudioTracks();
    } catch {
      audioStreamRef.current = null;
    }
    setHasAudio(audioTracks.length > 0);

    let recorder;
    try {
      const stream = new MediaStream([...canvasStreamRef.current.getVideoTracks(), ...audioTracks]);
      const mimeType = pickMimeType();
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (error) {
      releaseResources();
      throw error;
    }
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
      const duration = (Date.now() - startedAtRef.current) / 1000;
      releaseResources();
      stopResolverRef.current?.({ blob, duration, ...sizeRef.current });
      stopResolverRef.current = null;
    };

    recorderRef.current = recorder;
    // O codificador pode levar alguns instantes para iniciar (principalmente na 1ª vez);
    // o cronômetro e o botão de parar só aparecem quando a gravação começa de fato.
    const started = new Promise((resolve) => {
      recorder.onstart = resolve;
      window.setTimeout(resolve, START_TIMEOUT);
    });
    recorder.start(1000);
    await started;
    startedAtRef.current = Date.now();
    setElapsed(0);
    setIsRecording(true);
  }, [supported]);

  const stop = useCallback(() => new Promise((resolve) => {
    const recorder = recorderRef.current;
    setIsRecording(false);
    if (!recorder || recorder.state === 'inactive') {
      releaseResources();
      resolve(null);
      return;
    }
    stopResolverRef.current = resolve;
    recorder.stop();
  }), []);

  useEffect(() => () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    releaseResources();
  }, []);

  return { supported, isRecording, elapsed, hasAudio, start, stop };
}
