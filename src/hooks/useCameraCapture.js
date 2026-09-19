import { useCallback, useEffect, useRef, useState } from 'react';
import {
  drawFramedVideoFrame,
  getDigitalZoomFactor,
  getFramedCanvasSize,
  getRequestedHardwareZoom
} from '../services/cameraFraming.js';
import { listStoredCaptures, saveStoredCapture } from '../services/captureStorage.js';
import { useVideoRecorder } from './useVideoRecorder.js';

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

function captureTransitionFrame(video, facingMode) {
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    return '';
  }

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext('2d');
  if (!context) return '';

  context.save();
  if (facingMode === 'user') {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  context.restore();

  return canvas.toDataURL('image/jpeg', 0.82);
}

export function useCameraCapture({ ratio = '3:4', zoomLevel = '1' } = {}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const framingSyncIdRef = useRef(0);
  const framingRef = useRef({
    facingMode: 'environment',
    ratio,
    zoomFactor: getDigitalZoomFactor(zoomLevel),
    zoomLevel
  });
  const recordingFramingRef = useRef(null);
  const videoReadyAbortRef = useRef(null);
  const facingModeRef = useRef('environment');
  const [facingMode, setFacingMode] = useState('environment');
  const [hardwareZoomSupported, setHardwareZoomSupported] = useState(false);
  const [previewZoomFactor, setPreviewZoomFactor] = useState(getDigitalZoomFactor(zoomLevel));
  const [cameraStatus, setCameraStatus] = useState('idle');
  const [cameraTransitionFrame, setCameraTransitionFrame] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [userCaptures, setUserCaptures] = useState([]);
  const {
    cancelRecording,
    isRecording: isVideoRecording,
    recordingError: videoRecordingError,
    startRecording,
    stopRecording
  } = useVideoRecorder();

  const updateFacingMode = useCallback((nextFacingMode) => {
    facingModeRef.current = nextFacingMode;
    framingRef.current = {
      ...framingRef.current,
      facingMode: nextFacingMode
    };
    setFacingMode(nextFacingMode);
  }, []);

  const stopCamera = useCallback(({ clearTransitionFrame = true } = {}) => {
    cancelRecording();
    recordingFramingRef.current = null;
    framingSyncIdRef.current += 1;
    videoReadyAbortRef.current?.abort();
    videoReadyAbortRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (clearTransitionFrame) {
      setCameraTransitionFrame('');
    }
  }, [cancelRecording]);

  const loadCaptures = useCallback(async () => {
    try {
      const storedCaptures = await listStoredCaptures();
      setUserCaptures(storedCaptures);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const syncFraming = useCallback(async () => {
    const syncId = framingSyncIdRef.current + 1;
    framingSyncIdRef.current = syncId;
    const track = streamRef.current?.getVideoTracks?.()[0];
    const digitalZoomFactor = getDigitalZoomFactor(zoomLevel);
    let nextFraming = {
      facingMode: facingModeRef.current,
      ratio,
      zoomFactor: digitalZoomFactor,
      zoomLevel
    };
    let supportsHardwareZoom = false;

    if (track?.readyState === 'live' && typeof track.getCapabilities === 'function' && typeof track.applyConstraints === 'function') {
      const capabilities = track.getCapabilities();
      const zoomCapabilities = capabilities?.zoom;

      if (zoomCapabilities && Number.isFinite(zoomCapabilities.min) && Number.isFinite(zoomCapabilities.max)) {
        supportsHardwareZoom = true;
        const requestedZoom = getRequestedHardwareZoom(zoomLevel);
        const baselineZoom = Math.min(Math.max(1, zoomCapabilities.min), zoomCapabilities.max);
        const canApplyRequestedZoom = requestedZoom >= zoomCapabilities.min && requestedZoom <= zoomCapabilities.max;
        const hardwareZoom = canApplyRequestedZoom ? requestedZoom : baselineZoom;

        try {
          await track.applyConstraints({ advanced: [{ zoom: hardwareZoom }] });
          nextFraming = {
            ...nextFraming,
            zoomFactor: canApplyRequestedZoom ? 1 : digitalZoomFactor
          };
        } catch {
          nextFraming = {
            ...nextFraming,
            zoomFactor: digitalZoomFactor
          };
        }
      }
    }

    if (!mountedRef.current || syncId !== framingSyncIdRef.current) return;

    framingRef.current = nextFraming;
    setHardwareZoomSupported(supportsHardwareZoom);
    setPreviewZoomFactor(nextFraming.zoomFactor);
  }, [ratio, zoomLevel]);

  const startCamera = useCallback(async (nextFacingMode = facingModeRef.current, options = {}) => {
    const {
      preserveCurrentFrame = false,
      status = 'initializing'
    } = options;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('error');
      setCameraError(getCameraErrorMessage());
      return false;
    }

    const transitionFrame = preserveCurrentFrame
      ? captureTransitionFrame(videoRef.current, facingModeRef.current)
      : '';

    if (transitionFrame) {
      setCameraTransitionFrame(transitionFrame);
    } else {
      setCameraTransitionFrame('');
    }

    setCameraStatus(status);
    setCameraError('');
    stopCamera({ clearTransitionFrame: !transitionFrame });
    const videoReadyAbort = new AbortController();
    videoReadyAbortRef.current = videoReadyAbort;

    try {
      const stream = await navigator.mediaDevices.getUserMedia(createCameraConstraints(nextFacingMode));
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }

      streamRef.current = stream;
      if (status !== 'switching') {
        setCameraStatus('preparing');
      }

      if (videoRef.current) {
        await connectStreamToVideo(videoRef.current, stream, videoReadyAbort.signal);
      }

      if (!mountedRef.current || requestId !== requestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }

      setCameraStatus('ready');
      setCameraTransitionFrame('');
      return true;
    } catch (error) {
      if (error?.name === 'VideoAbortError') {
        return false;
      }

      stopCamera();
      setCameraStatus('error');
      setCameraTransitionFrame('');
      setCameraError(getCameraErrorMessage(error));
      return false;
    }
  }, [stopCamera]);

  const toggleFacingMode = useCallback(async () => {
    if (isVideoRecording) return false;
    if (['initializing', 'preparing', 'switching'].includes(cameraStatus)) return false;

    const currentFacingMode = facingModeRef.current;
    const nextFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    updateFacingMode(nextFacingMode);

    const openedNextCamera = await startCamera(nextFacingMode, {
      preserveCurrentFrame: true,
      status: 'switching'
    });
    if (openedNextCamera) return true;

    updateFacingMode(currentFacingMode);

    if (!navigator.mediaDevices?.getUserMedia) {
      return false;
    }

    try {
      const videoReadyAbort = new AbortController();
      videoReadyAbortRef.current = videoReadyAbort;
      const fallbackRequestId = requestIdRef.current;
      setCameraStatus('switching');
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
      setCameraTransitionFrame('');
      setCameraError('');
    } catch (error) {
      if (error?.name === 'VideoAbortError') {
        return false;
      }

      setCameraStatus('error');
      setCameraTransitionFrame('');
      setCameraError('Não foi possível alternar para a câmera solicitada.');
    }

    return false;
  }, [cameraStatus, isVideoRecording, startCamera, updateFacingMode]);

  useEffect(() => {
    if (cameraStatus !== 'ready') {
      framingRef.current = {
        facingMode: facingModeRef.current,
        ratio,
        zoomFactor: getDigitalZoomFactor(zoomLevel),
        zoomLevel
      };
      setPreviewZoomFactor(getDigitalZoomFactor(zoomLevel));
      return;
    }

    syncFraming();
  }, [cameraStatus, ratio, syncFraming, zoomLevel]);

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

    const framing = framingRef.current;
    const canvasSize = getFramedCanvasSize(width, height, framing.ratio, framing.zoomFactor);
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Não foi possível preparar a área de captura da foto.');
    }

    drawFramedVideoFrame(context, video, {
      mirror: framing.facingMode === 'user',
      ratio: framing.ratio,
      zoomFactor: framing.zoomFactor
    });

    const mimeType = 'image/jpeg';
    const blob = await canvasToBlob(canvas, mimeType, 0.92);
    const capture = {
      id: createCaptureId(),
      aspectRatio: framing.ratio,
      createdAt: new Date().toISOString(),
      height: canvas.height,
      mimeType,
      mirrored: framing.facingMode === 'user',
      zoom: framing.zoomLevel,
      zoomFactor: framing.zoomFactor,
      width: canvas.width,
      blob
    };

    await saveStoredCapture(capture);
    setUserCaptures((current) => [capture, ...current]);

    return capture;
  }, [cameraStatus]);

  const startVideoRecording = useCallback(async () => {
    if (cameraStatus !== 'ready') {
      throw new Error('A câmera ainda não está pronta para gravar vídeo.');
    }

    if (!videoRef.current) {
      throw new Error('O feed da câmera não está disponível para gravar vídeo.');
    }

    recordingFramingRef.current = { ...framingRef.current };

    try {
      return await startRecording({
        framingRef,
        sourceStream: streamRef.current,
        videoElement: videoRef.current
      });
    } catch (error) {
      recordingFramingRef.current = null;
      throw error;
    }
  }, [cameraStatus, startRecording]);

  const stopVideoRecording = useCallback(async () => {
    let recording;
    let recordingFraming;

    try {
      recording = await stopRecording();
      recordingFraming = recordingFramingRef.current;
    } finally {
      recordingFramingRef.current = null;
    }

    const capture = {
      id: createCaptureId(),
      aspectRatio: recordingFraming?.ratio,
      createdAt: new Date().toISOString(),
      duration: recording.duration,
      hasAudio: recording.hasAudio,
      height: recording.height,
      mimeType: recording.mimeType,
      mirrored: recordingFraming?.facingMode === 'user',
      width: recording.width,
      zoom: framingRef.current.zoomLevel,
      zoomFactor: framingRef.current.zoomFactor,
      blob: recording.blob
    };

    await saveStoredCapture(capture);
    setUserCaptures((current) => [capture, ...current]);

    return capture;
  }, [stopRecording]);

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
    cameraTransitionFrame,
    capturePhoto,
    facingMode,
    hardwareZoomSupported,
    isVideoRecording,
    previewZoomFactor,
    retryCamera: startCamera,
    stopCamera,
    startVideoRecording,
    stopVideoRecording,
    toggleFacingMode,
    userCaptures,
    videoRecordingError,
    videoRef
  };
}
