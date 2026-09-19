import { useCallback, useEffect, useRef, useState } from 'react';
import { drawFramedVideoFrame, getFramedCanvasSize } from '../services/cameraFraming.js';

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

function stopStreamTracks(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}

function getMicrophoneErrorMessage(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
    return 'Microfone negado. O vídeo será gravado sem áudio.';
  }

  if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') {
    return 'Nenhum microfone disponível. O vídeo será gravado sem áudio.';
  }

  return 'Não foi possível acessar o microfone. O vídeo será gravado sem áudio.';
}

async function requestAudioStream() {
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      error: 'Seu navegador não oferece suporte ao microfone.',
      stream: null
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    return { error: '', stream };
  } catch (error) {
    return {
      error: getMicrophoneErrorMessage(error),
      stream: null
    };
  }
}

function createProcessedVideoStream(video, framingRef) {
  if (typeof HTMLCanvasElement === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
    throw new Error('Este navegador não oferece suporte à gravação com enquadramento aplicado.');
  }

  if (!video?.videoWidth || !video?.videoHeight) {
    throw new Error('O feed da câmera não informou dimensões válidas para gravar vídeo.');
  }

  const framing = framingRef.current;
  const canvas = document.createElement('canvas');
  const { height, width } = getFramedCanvasSize(
    video.videoWidth,
    video.videoHeight,
    framing.ratio,
    framing.zoomFactor
  );
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Não foi possível preparar o enquadramento do vídeo.');
  }

  canvas.width = width;
  canvas.height = height;

  let animationFrameId = 0;
  const drawFrame = () => {
    const currentFraming = framingRef.current;
    drawFramedVideoFrame(context, video, {
      mirror: currentFraming.facingMode === 'user',
      ratio: framing.ratio,
      zoomFactor: currentFraming.zoomFactor
    });
    animationFrameId = window.requestAnimationFrame(drawFrame);
  };

  drawFrame();

  const stream = canvas.captureStream(30);

  return {
    height,
    stream,
    stop: () => {
      window.cancelAnimationFrame(animationFrameId);
      stopStreamTracks(stream);
    },
    width
  };
}

export function useVideoRecorder() {
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingInfoRef = useRef(null);
  const resourcesRef = useRef(null);
  const startedAtRef = useRef(null);
  const stopPromiseRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState('');

  const cleanupResources = useCallback(() => {
    resourcesRef.current?.processedVideo?.stop();
    stopStreamTracks(resourcesRef.current?.audioStream);
    stopStreamTracks(resourcesRef.current?.recordingStream);
    resourcesRef.current = null;
  }, []);

  const cancelRecording = useCallback(() => {
    const recorder = recorderRef.current;
    stopPromiseRef.current = null;
    chunksRef.current = [];
    recordingInfoRef.current = null;
    startedAtRef.current = null;
    recorderRef.current = null;
    setIsRecording(false);

    if (recorder?.state === 'recording') {
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      recorder.stop();
    }
    cleanupResources();
  }, [cleanupResources]);

  const startRecording = useCallback(async ({ framingRef, sourceStream, videoElement }) => {
    if (!window.MediaRecorder) {
      throw new Error('Este navegador não oferece suporte à gravação de vídeo.');
    }

    if (recorderRef.current?.state === 'recording') {
      throw new Error('Uma gravação já está em andamento.');
    }

    if (!sourceStream || getVideoTracks(sourceStream).length === 0) {
      throw new Error('A câmera precisa estar ativa para iniciar a gravação.');
    }

    const processedVideo = createProcessedVideoStream(videoElement, framingRef);
    const audioResult = await requestAudioStream();
    const recordingStream = new MediaStream([
      ...processedVideo.stream.getVideoTracks(),
      ...(audioResult.stream?.getAudioTracks() || [])
    ]);
    const mimeType = getSupportedMimeType();
    let recorder;

    try {
      recorder = mimeType
        ? new window.MediaRecorder(recordingStream, { mimeType })
        : new window.MediaRecorder(recordingStream);
    } catch {
      processedVideo.stop();
      stopStreamTracks(audioResult.stream);
      stopStreamTracks(recordingStream);
      throw new Error('Não foi possível preparar a gravação de vídeo.');
    }

    chunksRef.current = [];
    resourcesRef.current = {
      audioStream: audioResult.stream,
      processedVideo,
      recordingStream
    };
    recordingInfoRef.current = {
      hasAudio: Boolean(audioResult.stream?.getAudioTracks().length),
      height: processedVideo.height,
      width: processedVideo.width
    };
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
      recordingInfoRef.current = null;
      startedAtRef.current = null;
      cleanupResources();
      throw new Error('Não foi possível iniciar a gravação de vídeo.');
    }

    setIsRecording(true);

    return {
      audioError: audioResult.error,
      hasAudio: recordingInfoRef.current.hasAudio,
      height: processedVideo.height,
      mimeType: recorder.mimeType || mimeType || 'video/webm',
      width: processedVideo.width
    };
  }, [cleanupResources]);

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
        const recordingInfo = recordingInfoRef.current;

        recorderRef.current = null;
        stopPromiseRef.current = null;
        chunksRef.current = [];
        recordingInfoRef.current = null;
        startedAtRef.current = null;
        setIsRecording(false);
        cleanupResources();

        const blob = new Blob(chunks, { type: mimeType });
        if (blob.size === 0) {
          reject(new Error('A gravação terminou sem dados de vídeo.'));
          return;
        }

        resolve({
          blob,
          duration,
          hasAudio: Boolean(recordingInfo?.hasAudio),
          height: recordingInfo?.height,
          mimeType,
          width: recordingInfo?.width
        });
      };

      recorder.onerror = () => {
        recorderRef.current = null;
        stopPromiseRef.current = null;
        chunksRef.current = [];
        recordingInfoRef.current = null;
        startedAtRef.current = null;
        setIsRecording(false);
        cleanupResources();
        setRecordingError('Não foi possível finalizar a gravação de vídeo.');
        reject(new Error('Não foi possível finalizar a gravação de vídeo.'));
      };

      recorder.stop();
    });

    return stopPromiseRef.current;
  }, [cleanupResources]);

  useEffect(() => cancelRecording, [cancelRecording]);

  return {
    cancelRecording,
    isRecording,
    recordingError,
    startRecording,
    stopRecording
  };
}
