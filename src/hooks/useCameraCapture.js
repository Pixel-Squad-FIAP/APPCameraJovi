import { useCallback, useEffect, useRef, useState } from 'react';
import { listStoredCaptures, saveStoredCapture } from '../services/captureStorage.js';

function createCameraConstraints(facingMode) {
  return {
    audio: false,
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  };
}

function getCameraErrorMessage(error) {
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'Seu navegador não oferece suporte ao acesso à câmera.';
  }

  if (error?.name === 'VideoPlaybackError') {
    return getVideoPlaybackErrorMessage();
  }

  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
    return 'Permissão da câmera negada. Libere o acesso à câmera no navegador e tente novamente.';
  }

  if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') {
    return 'Nenhuma câmera compatível foi encontrada neste dispositivo.';
  }

  if (error?.name === 'NotReadableError') {
    return 'A câmera está indisponível ou em uso por outro aplicativo.';
  }

  return 'Não foi possível iniciar a câmera do dispositivo.';
}

function getVideoPlaybackErrorMessage() {
  return 'A câmera foi acessada, mas o navegador não conseguiu exibir o feed de vídeo.';
}

function createVideoPlaybackError() {
  const error = new Error(getVideoPlaybackErrorMessage());
  error.name = 'VideoPlaybackError';
  return error;
}

function createVideoAbortError() {
  const error = new Error('A inicialização anterior da câmera foi cancelada.');
  error.name = 'VideoAbortError';
  return error;
}

function isVideoReady(video) {
  return video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && Boolean(video.videoWidth && video.videoHeight);
}

function observeVideoReady(video, signal) {
  if (isVideoReady(video)) {
    return {
      cleanup: () => {},
      promise: Promise.resolve()
    };
  }

  let cleanup = () => {};
  const promise = new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createVideoAbortError());
      return;
    }

    cleanup = () => {
      video.removeEventListener('loadeddata', handleReady);
      video.removeEventListener('canplay', handleReady);
      video.removeEventListener('playing', handleReady);
      video.removeEventListener('error', handleError);
      signal?.removeEventListener('abort', handleAbort);
    };

    const handleReady = () => {
      if (!isVideoReady(video)) return;
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(createVideoPlaybackError());
    };

    const handleAbort = () => {
      cleanup();
      reject(createVideoAbortError());
    };

    video.addEventListener('loadeddata', handleReady);
    video.addEventListener('canplay', handleReady);
    video.addEventListener('playing', handleReady);
    video.addEventListener('error', handleError);
    signal?.addEventListener('abort', handleAbort, { once: true });
  });

  return { cleanup, promise };
}

async function connectStreamToVideo(video, stream, signal) {
  video.srcObject = stream;

  const readiness = observeVideoReady(video, signal);
  const playPromise = video.play();

  try {
    await Promise.race([
      readiness.promise,
      playPromise.catch(() => {
        if (isVideoReady(video)) return;
        throw createVideoPlaybackError();
      })
    ]);

    if (!isVideoReady(video)) {
      await readiness.promise;
    }
  } finally {
    readiness.cleanup();
  }
}

function createCaptureId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `capture-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error('Não foi possível gerar a imagem capturada.'));
    }, mimeType, quality);
  });
}

export function useCameraCapture() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const videoReadyAbortRef = useRef(null);
  const facingModeRef = useRef('environment');
  const [facingMode, setFacingMode] = useState('environment');
  const [cameraStatus, setCameraStatus] = useState('idle');
  const [cameraError, setCameraError] = useState('');
  const [userCaptures, setUserCaptures] = useState([]);

  const updateFacingMode = useCallback((nextFacingMode) => {
    facingModeRef.current = nextFacingMode;
    setFacingMode(nextFacingMode);
  }, []);

  const stopCamera = useCallback(() => {
    videoReadyAbortRef.current?.abort();
    videoReadyAbortRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const loadCaptures = useCallback(async () => {
    try {
      const storedCaptures = await listStoredCaptures();
      setUserCaptures(storedCaptures);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const startCamera = useCallback(async (nextFacingMode = facingModeRef.current) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('error');
      setCameraError(getCameraErrorMessage());
      return false;
    }

    setCameraStatus('requesting');
    setCameraError('');
    stopCamera();
    const videoReadyAbort = new AbortController();
    videoReadyAbortRef.current = videoReadyAbort;

    try {
      const stream = await navigator.mediaDevices.getUserMedia(createCameraConstraints(nextFacingMode));
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        await connectStreamToVideo(videoRef.current, stream, videoReadyAbort.signal);
      }

      if (!mountedRef.current || requestId !== requestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }

      setCameraStatus('ready');
      return true;
    } catch (error) {
      if (error?.name === 'VideoAbortError') {
        return false;
      }

      stopCamera();
      setCameraStatus('error');
      setCameraError(getCameraErrorMessage(error));
      return false;
    }
  }, [stopCamera]);

  const toggleFacingMode = useCallback(async () => {
    if (cameraStatus === 'requesting') return false;

    const currentFacingMode = facingModeRef.current;
    const nextFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    updateFacingMode(nextFacingMode);

    const openedNextCamera = await startCamera(nextFacingMode);
    if (openedNextCamera) return true;

    updateFacingMode(currentFacingMode);

    if (!navigator.mediaDevices?.getUserMedia) {
      return false;
    }

    try {
      const videoReadyAbort = new AbortController();
      videoReadyAbortRef.current = videoReadyAbort;
      const fallbackRequestId = requestIdRef.current;
      const fallbackStream = await navigator.mediaDevices.getUserMedia(createCameraConstraints(currentFacingMode));
      if (!mountedRef.current || fallbackRequestId !== requestIdRef.current) {
        fallbackStream.getTracks().forEach((track) => track.stop());
        return false;
      }

      streamRef.current = fallbackStream;

      if (videoRef.current) {
        await connectStreamToVideo(videoRef.current, fallbackStream, videoReadyAbort.signal);
      }

      if (!mountedRef.current || fallbackRequestId !== requestIdRef.current) {
        fallbackStream.getTracks().forEach((track) => track.stop());
        return false;
      }

      setCameraStatus('ready');
      setCameraError('');
    } catch (error) {
      if (error?.name === 'VideoAbortError') {
        return false;
      }

      setCameraStatus('error');
      setCameraError('Não foi possível alternar para a câmera solicitada.');
    }

    return false;
  }, [cameraStatus, startCamera, updateFacingMode]);

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;

    if (!video || cameraStatus !== 'ready' || video.readyState < 2) {
      throw new Error('A câmera ainda não está pronta para capturar uma foto.');
    }

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      throw new Error('O feed da câmera não informou dimensões válidas.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Não foi possível preparar a área de captura da foto.');
    }

    context.drawImage(video, 0, 0, width, height);

    const mimeType = 'image/jpeg';
    const blob = await canvasToBlob(canvas, mimeType, 0.92);
    const capture = {
      id: createCaptureId(),
      createdAt: new Date().toISOString(),
      mimeType,
      blob
    };

    await saveStoredCapture(capture);
    setUserCaptures((current) => [capture, ...current]);

    return capture;
  }, [cameraStatus]);

  useEffect(() => {
    mountedRef.current = true;
    loadCaptures();
    startCamera();

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      stopCamera();
    };
  }, [loadCaptures, startCamera, stopCamera]);

  return {
    cameraError,
    cameraStatus,
    capturePhoto,
    facingMode,
    retryCamera: startCamera,
    stopCamera,
    toggleFacingMode,
    userCaptures,
    videoRef
  };
}
