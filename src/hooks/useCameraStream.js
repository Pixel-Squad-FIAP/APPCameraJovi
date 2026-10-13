import { useCallback, useEffect, useRef, useState } from 'react';

function statusFromError(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'denied';
  if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') return 'unavailable';
  if (error?.name === 'NotReadableError') return 'busy';
  return 'error';
}

// Abre a câmera real (getUserMedia), troca entre frontal/traseira e libera o
// hardware ao sair da tela ou quando a aba fica oculta.
export function useCameraStream({ facingMode, enabled }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [attempt, setAttempt] = useState(0);
  const [torchSupported, setTorchSupported] = useState(false);
  const [videoAspect, setVideoAspect] = useState(null);
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState !== 'hidden');

  useEffect(() => {
    const handleVisibility = () => setPageVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (!enabled || !pageVisible) return undefined;

    if (!window.isSecureContext) {
      setStatus('insecure');
      return undefined;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      return undefined;
    }

    let cancelled = false;
    setStatus('starting');

    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const [track] = stream.getVideoTracks();
        setTorchSupported(Boolean(track?.getCapabilities?.().torch));
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.play().catch(() => {});
        }
        setStatus('ready');
      })
      .catch((error) => {
        if (!cancelled) setStatus(statusFromError(error));
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [enabled, facingMode, pageVisible, attempt]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    const updateAspect = () => {
      if (video.videoWidth && video.videoHeight) setVideoAspect(video.videoWidth / video.videoHeight);
    };
    video.addEventListener('loadedmetadata', updateAspect);
    video.addEventListener('resize', updateAspect);
    return () => {
      video.removeEventListener('loadedmetadata', updateAspect);
      video.removeEventListener('resize', updateAspect);
    };
  }, []);

  const setTorch = useCallback(async (on) => {
    const [track] = streamRef.current?.getVideoTracks() ?? [];
    if (!track || !torchSupported) return false;
    try {
      await track.applyConstraints({ advanced: [{ torch: on }] });
      return true;
    } catch {
      return false;
    }
  }, [torchSupported]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  return { videoRef, streamRef, status, retry, setTorch, torchSupported, videoAspect };
}
