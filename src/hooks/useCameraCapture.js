import { useCallback, useEffect, useRef, useState } from 'react';
import {
  drawDocumentVideoFrame,
  drawFramedVideoFrame,
  getDigitalZoomFactor,
  getDocumentCanvasSize,
  getFramedCanvasSize,
  getRequestedHardwareZoom
} from '../services/cameraFraming.js';
import { listStoredCaptures, saveStoredCapture } from '../services/captureStorage.js';
import { createVideoThumbnailBlob } from '../services/mediaThumbnail.js';
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

function getOrientationYaw(event) {
  if (Number.isFinite(event.alpha)) return event.alpha;
  if (Number.isFinite(event.webkitCompassHeading)) return event.webkitCompassHeading;
  return null;
}

function getCanvasGraySample(canvas, columns = 96, rows = 64) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const sample = new Float32Array(columns * rows);

  for (let row = 0; row < rows; row += 1) {
    const y = Math.min(canvas.height - 1, Math.round((row / Math.max(1, rows - 1)) * (canvas.height - 1)));
    for (let column = 0; column < columns; column += 1) {
      const x = Math.min(canvas.width - 1, Math.round((column / Math.max(1, columns - 1)) * (canvas.width - 1)));
      const index = (y * canvas.width + x) * 4;
      sample[row * columns + column] = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    }
  }

  return { columns, rows, sample };
}

function estimatePanoramaStep(previousFrame, nextFrame) {
  const previous = getCanvasGraySample(previousFrame);
  const next = getCanvasGraySample(nextFrame, previous.columns, previous.rows);
  const minStep = Math.round(previous.columns * 0.25);
  const maxStep = Math.round(previous.columns * 0.68);
  let bestStep = Math.round(previous.columns * 0.45);
  let bestScore = Number.POSITIVE_INFINITY;

  for (let step = minStep; step <= maxStep; step += 1) {
    const overlap = previous.columns - step;
    let score = 0;
    let count = 0;
    for (let row = 0; row < previous.rows; row += 2) {
      for (let column = 0; column < overlap; column += 2) {
        const previousValue = previous.sample[row * previous.columns + step + column];
        const nextValue = next.sample[row * next.columns + column];
        score += Math.abs(previousValue - nextValue);
        count += 1;
      }
    }
    const normalizedScore = score / Math.max(1, count);
    if (normalizedScore < bestScore) {
      bestScore = normalizedScore;
      bestStep = step;
    }
  }

  return Math.max(1, Math.round((bestStep / previous.columns) * previousFrame.width));
}

function drawPanoramaFrame(context, frame, offsetX, previousOffsetX) {
  if (previousOffsetX === null) {
    context.drawImage(frame, offsetX, 0);
    return;
  }

  const overlap = Math.max(0, (previousOffsetX + frame.width) - offsetX);
  const nonOverlapX = Math.max(0, overlap);

  if (overlap > 0) {
    const existing = context.getImageData(offsetX, 0, overlap, frame.height);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = frame.width;
    tempCanvas.height = frame.height;
    const tempContext = tempCanvas.getContext('2d', { willReadFrequently: true });
    tempContext.drawImage(frame, 0, 0);
    const next = tempContext.getImageData(0, 0, overlap, frame.height);

    for (let y = 0; y < frame.height; y += 1) {
      for (let x = 0; x < overlap; x += 1) {
        const alpha = x / Math.max(1, overlap - 1);
        const index = (y * overlap + x) * 4;
        existing.data[index] = existing.data[index] * (1 - alpha) + next.data[index] * alpha;
        existing.data[index + 1] = existing.data[index + 1] * (1 - alpha) + next.data[index + 1] * alpha;
        existing.data[index + 2] = existing.data[index + 2] * (1 - alpha) + next.data[index + 2] * alpha;
        existing.data[index + 3] = 255;
      }
    }
    context.putImageData(existing, offsetX, 0);
  }

  if (nonOverlapX < frame.width) {
    context.drawImage(
      frame,
      nonOverlapX,
      0,
      frame.width - nonOverlapX,
      frame.height,
      offsetX + nonOverlapX,
      0,
      frame.width - nonOverlapX,
      frame.height
    );
  }
}

async function requestOrientationAccess() {
  if (!('DeviceOrientationEvent' in window)) {
    throw new Error('Panorâmica por movimento indisponível neste navegador.');
  }

  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    const permission = await DeviceOrientationEvent.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Permissão de movimento negada. Não é possível guiar a panorâmica.');
    }
  }
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

function getLiveVideoTrack(stream) {
  return stream?.getVideoTracks?.().find((track) => track.readyState === 'live') || null;
}

function supportsTorch(track) {
  if (!track || typeof track.getCapabilities !== 'function') return false;

  const capabilities = track.getCapabilities();
  if (typeof capabilities?.torch === 'boolean') return capabilities.torch;
  if (Array.isArray(capabilities?.fillLightMode)) {
    return capabilities.fillLightMode.includes('torch');
  }

  return false;
}

async function applyTorch(track, enabled) {
  if (!track || typeof track.applyConstraints !== 'function') {
    throw new Error('Este dispositivo não oferece controle de flash.');
  }

  await track.applyConstraints({ advanced: [{ torch: enabled }] });
}

export function useCameraCapture({ ratio = '3:4', viewfinderHeight = 520, viewfinderWidth = 390, zoomLevel = '1' } = {}) {
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
  const torchOperationIdRef = useRef(0);
  const videoReadyAbortRef = useRef(null);
  const facingModeRef = useRef('environment');
  const torchEnabledRef = useRef(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [hardwareZoomSupported, setHardwareZoomSupported] = useState(false);
  const [previewZoomFactor, setPreviewZoomFactor] = useState(getDigitalZoomFactor(zoomLevel));
  const [cameraStatus, setCameraStatus] = useState('idle');
  const [cameraTransitionFrame, setCameraTransitionFrame] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [torchEnabled, setTorchEnabledState] = useState(false);
  const [torchError, setTorchError] = useState('');
  const [torchSupported, setTorchSupported] = useState(false);
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

  const setTorchEnabled = useCallback((enabled) => {
    torchEnabledRef.current = enabled;
    setTorchEnabledState(enabled);
  }, []);

  const resetTorchState = useCallback(() => {
    torchOperationIdRef.current += 1;
    setTorchEnabled(false);
    setTorchError('');
    setTorchSupported(false);
  }, [setTorchEnabled]);

  const disableActiveTorch = useCallback(async () => {
    const track = getLiveVideoTrack(streamRef.current);
    if (!track || !torchEnabledRef.current || !supportsTorch(track)) return;

    try {
      await applyTorch(track, false);
    } catch {
      // Track is about to be stopped; keep camera cleanup resilient.
    } finally {
      setTorchEnabled(false);
    }
  }, [setTorchEnabled]);

  const stopCamera = useCallback(({ clearTransitionFrame = true } = {}) => {
    cancelRecording();
    disableActiveTorch();
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
    resetTorchState();
  }, [cancelRecording, disableActiveTorch, resetTorchState]);

  const loadCaptures = useCallback(async () => {
    try {
      const storedCaptures = await listStoredCaptures();
      setUserCaptures(storedCaptures);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const updateUserCapture = useCallback((updatedCapture) => {
    setUserCaptures((current) => current.map((capture) => (
      capture.id === updatedCapture.id ? updatedCapture : capture
    )));
  }, []);

  const addUserCapture = useCallback((capture) => {
    setUserCaptures((current) => [capture, ...current]);
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

  const syncTorchCapability = useCallback(() => {
    const supported = supportsTorch(getLiveVideoTrack(streamRef.current));
    setTorchSupported(supported);
    setTorchError('');
    setTorchEnabled(false);
  }, [setTorchEnabled]);

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
      syncTorchCapability();
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
      syncTorchCapability();

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
  }, [cameraStatus, isVideoRecording, startCamera, syncTorchCapability, updateFacingMode]);

  const toggleTorch = useCallback(async () => {
    const track = getLiveVideoTrack(streamRef.current);
    const nextEnabled = !torchEnabledRef.current;
    const operationId = torchOperationIdRef.current + 1;
    torchOperationIdRef.current = operationId;

    if (!supportsTorch(track)) {
      const error = 'Flash indisponível neste dispositivo.';
      setTorchSupported(false);
      setTorchEnabled(false);
      setTorchError(error);
      return { error, ok: false };
    }

    try {
      await applyTorch(track, nextEnabled);
      if (!mountedRef.current || operationId !== torchOperationIdRef.current) {
        return { ok: false };
      }
      setTorchSupported(true);
      setTorchEnabled(nextEnabled);
      setTorchError('');
      return { enabled: nextEnabled, ok: true };
    } catch {
      if (!mountedRef.current || operationId !== torchOperationIdRef.current) {
        return { ok: false };
      }
      const error = nextEnabled
        ? 'Não foi possível ativar o flash neste dispositivo.'
        : 'Não foi possível desligar o flash neste dispositivo.';
      setTorchEnabled(!nextEnabled);
      setTorchError(error);
      return { error, ok: false };
    }
  }, [setTorchEnabled]);

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

  const captureDocument = useCallback(async ({ persist = true } = {}) => {
    const video = videoRef.current;

    if (!video || cameraStatus !== 'ready' || video.readyState < 2) {
      throw new Error('A câmera ainda não está pronta para digitalizar o documento.');
    }

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      throw new Error('O feed da câmera não informou dimensões válidas.');
    }

    const framing = framingRef.current;
    const canvasSize = getDocumentCanvasSize(width, height, viewfinderWidth, viewfinderHeight, framing.zoomFactor);
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Não foi possível preparar a área de digitalização.');
    }

    drawDocumentVideoFrame(context, video, {
      mirror: framing.facingMode === 'user',
      viewportHeight: viewfinderHeight,
      viewportWidth: viewfinderWidth,
      zoomFactor: framing.zoomFactor
    });

    const mimeType = 'image/jpeg';
    const blob = await canvasToBlob(canvas, mimeType, 0.92);
    const capture = {
      id: createCaptureId(),
      aspectRatio: 'document-frame',
      createdAt: new Date().toISOString(),
      height: canvas.height,
      kind: 'document',
      mimeType,
      mirrored: framing.facingMode === 'user',
      ocrStatus: 'pending',
      pages: [{
        id: createCaptureId(),
        blob,
        height: canvas.height,
        mimeType,
        ocrStatus: 'pending',
        width: canvas.width
      }],
      zoom: framing.zoomLevel,
      zoomFactor: framing.zoomFactor,
      width: canvas.width,
      blob
    };

    if (persist) {
      await saveStoredCapture(capture);
      setUserCaptures((current) => [capture, ...current]);
    }

    return capture;
  }, [cameraStatus, viewfinderHeight, viewfinderWidth]);

  const capturePanorama = useCallback(async ({ onProgress } = {}) => {
    const video = videoRef.current;

    if (!video || cameraStatus !== 'ready' || video.readyState < 2) {
      throw new Error('A câmera ainda não está pronta para capturar a panorâmica.');
    }

    if (!video.videoWidth || !video.videoHeight) {
      throw new Error('O feed da câmera não informou dimensões válidas.');
    }

    const framing = framingRef.current;
    await requestOrientationAccess();

    const frameCount = 6;
    const targetDegrees = 42;
    const overlap = 0.55;
    const frameSize = getFramedCanvasSize(video.videoWidth, video.videoHeight, '9:16', framing.zoomFactor);
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = frameSize.width;
    frameCanvas.height = frameSize.height;
    const frameContext = frameCanvas.getContext('2d');

    if (!frameContext) {
      throw new Error('Não foi possível preparar os frames da panorâmica.');
    }

    const frames = [];
    const captureFrame = () => {
      drawFramedVideoFrame(frameContext, video, {
        mirror: framing.facingMode === 'user',
        ratio: '9:16',
        zoomFactor: framing.zoomFactor
      });
      const snapshot = document.createElement('canvas');
      snapshot.width = frameCanvas.width;
      snapshot.height = frameCanvas.height;
      const snapshotContext = snapshot.getContext('2d');
      if (!snapshotContext) {
        throw new Error('Não foi possível preparar um frame da panorâmica.');
      }
      snapshotContext.drawImage(frameCanvas, 0, 0);
      frames.push(snapshot);
      onProgress?.(Math.min(100, Math.round((frames.length / frameCount) * 100)));
    };

    captureFrame();

    await new Promise((resolve, reject) => {
      let startYaw = null;
      let lastProgressStep = 0;
      const timeoutId = window.setTimeout(() => {
        cleanup();
        if (frames.length < 3) {
          reject(new Error('Mova o telefone lentamente na horizontal para capturar a panorâmica.'));
          return;
        }
        resolve();
      }, 14000);

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        window.removeEventListener('deviceorientation', handleOrientation);
      };

      const handleOrientation = (event) => {
        const yaw = getOrientationYaw(event);
        if (!Number.isFinite(yaw)) return;

        if (startYaw === null) {
          startYaw = yaw;
          return;
        }

        let delta = yaw - startYaw;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        const progress = Math.min(1, Math.abs(delta) / targetDegrees);
        const nextStep = Math.floor(progress * (frameCount - 1));

        if (nextStep > lastProgressStep && frames.length < frameCount) {
          lastProgressStep = nextStep;
          captureFrame();
        } else {
          onProgress?.(Math.max(Math.round(progress * 100), Math.round((frames.length / frameCount) * 100)));
        }

        if (frames.length >= frameCount || progress >= 1) {
          cleanup();
          resolve();
        }
      };

      window.addEventListener('deviceorientation', handleOrientation);
    });

    const steps = frames.slice(1).map((frame, index) => estimatePanoramaStep(frames[index], frame));
    const offsets = [0];
    steps.forEach((step) => offsets.push(offsets[offsets.length - 1] + step));
    const canvas = document.createElement('canvas');
    canvas.width = offsets[offsets.length - 1] + frameSize.width;
    canvas.height = frameSize.height;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Não foi possível montar a panorâmica.');
    }

    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    frames.forEach((frame, index) => {
      drawPanoramaFrame(context, frame, offsets[index], index === 0 ? null : offsets[index - 1]);
    });

    const mimeType = 'image/jpeg';
    const blob = await canvasToBlob(canvas, mimeType, 0.9);
    const capture = {
      id: createCaptureId(),
      aspectRatio: 'panorama',
      createdAt: new Date().toISOString(),
      frameCount,
      height: canvas.height,
      kind: 'panorama',
      mimeType,
      mirrored: framing.facingMode === 'user',
      overlap,
      width: canvas.width,
      zoom: framing.zoomLevel,
      zoomFactor: framing.zoomFactor,
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
      thumbnailBlob: null,
      width: recording.width,
      zoom: framingRef.current.zoomLevel,
      zoomFactor: framingRef.current.zoomFactor,
      blob: recording.blob
    };

    try {
      capture.thumbnailBlob = await createVideoThumbnailBlob(recording.blob);
    } catch {
      capture.thumbnailBlob = null;
    }

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
    addUserCapture,
    captureDocument,
    capturePanorama,
    capturePhoto,
    facingMode,
    hardwareZoomSupported,
    isVideoRecording,
    previewZoomFactor,
    retryCamera: startCamera,
    stopCamera,
    startVideoRecording,
    stopVideoRecording,
    toggleTorch,
    toggleFacingMode,
    torchEnabled,
    torchError,
    torchSupported,
    updateUserCapture,
    userCaptures,
    videoRecordingError,
    videoRef
  };
}
