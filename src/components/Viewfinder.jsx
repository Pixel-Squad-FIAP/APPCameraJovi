import { useEffect, useRef, useState } from 'react';

export default function Viewfinder({
  activeMode,
  cameraError,
  cameraStatus,
  cameraTransitionFrame = '',
  documentScanState = { message: '', progress: null, status: 'idle' },
  facingMode,
  flipRequestId,
  hardwareZoomSupported = false,
  isDocumentScanning = false,
  isVideoRecording,
  notification,
  onDocumentCapture,
  onDocumentExportUnavailable = () => {},
  onFlippedChange,
  onPanoramaCapture,
  onRealPhotoCapture,
  onStudentCapture,
  onVideoRecordingStart,
  onVideoRecordingStop,
  onViewfinderResize = () => {},
  onZoomLevelChange = () => {},
  panoramaState = { progress: 0, status: 'idle' },
  previewZoomFactor = 1,
  ratio,
  retryCamera,
  shutterRequestId,
  showNotification,
  timerState,
  videoRef,
  zoomLevel = '1'
}) {
  const viewfinderRef = useRef(null);
  const [focusPoint, setFocusPoint] = useState({ x: 195, y: 260 });
  const [focusVisible, setFocusVisible] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [brightness, setBrightness] = useState(0.6);
  const [draggingBrightness, setDraggingBrightness] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [viewfinderBlurred, setViewfinderBlurred] = useState(false);
  const [thumbnailVisible, setThumbnailVisible] = useState(false);
  const [thumbnailFlying, setThumbnailFlying] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [countdown, setCountdown] = useState('');
  const didMountRef = useRef(false);
  const hideTimerRef = useRef(null);
  const trackRef = useRef(null);
  const timeoutsRef = useRef([]);
  const countdownIntervalRef = useRef(null);

  const clearManagedTimeouts = () => {
    timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutsRef.current = [];
    window.clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = null;
  };

  const schedule = (callback, delay) => {
    const timeoutId = window.setTimeout(callback, delay);
    timeoutsRef.current.push(timeoutId);
    return timeoutId;
  };

  const resetHideTimer = () => {
    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setFocusVisible(false);
      setControlsVisible(false);
    }, 2000);
  };

  useEffect(() => {
    return () => {
      window.clearTimeout(hideTimerRef.current);
      clearManagedTimeouts();
    };
  }, []);

  useEffect(() => {
    const element = viewfinderRef.current;
    if (!element) return undefined;

    const notifySize = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        onViewfinderResize({
          height: Math.round(rect.height),
          width: Math.round(rect.width)
        });
      }
    };

    notifySize();

    if (!window.ResizeObserver) {
      window.addEventListener('resize', notifySize);
      return () => window.removeEventListener('resize', notifySize);
    }

    const observer = new ResizeObserver(notifySize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [onViewfinderResize]);

  useEffect(() => {
    onFlippedChange(flipped);
  }, [flipped, onFlippedChange]);

  useEffect(() => {
    if (!isVideoRecording) return undefined;

    const intervalId = window.setInterval(() => {
      setRecordingSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isVideoRecording]);

  useEffect(() => {
    if (!isVideoRecording) {
      setRecordingSeconds(0);
    }
  }, [isVideoRecording]);

  useEffect(() => {
    if (!draggingBrightness) return undefined;

    const updateBrightness = (clientY) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      let percent = 1 - (clientY - rect.top) / rect.height;
      percent = Math.max(0, Math.min(1, percent));
      setBrightness(percent);
      resetHideTimer();
    };

    const handlePointerMove = (event) => updateBrightness(event.clientY);
    const handlePointerUp = () => setDraggingBrightness(false);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingBrightness]);

  const handleViewfinderClick = (event) => {
    if (activeMode === 'Panorâmica' || activeMode === 'Estudante') return;
    const rect = event.currentTarget.getBoundingClientRect();
    setFocusPoint({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    setFocusVisible(false);
    window.requestAnimationFrame(() => setFocusVisible(true));
    setControlsVisible(true);
    resetHideTimer();
  };

  const takePhoto = async () => {
    clearManagedTimeouts();
    let capturedMedia = false;

    if (activeMode === 'Foto') {
      try {
        await onRealPhotoCapture();
        showNotification('Foto salva na galeria');
        capturedMedia = true;
      } catch (error) {
        showNotification(error.message || 'Não foi possível capturar a foto');
        return;
      }
    }

    if (activeMode === 'Documento') {
      try {
        const documentCapture = await onDocumentCapture();
        showNotification(documentCapture?.processedBlob ? 'Documento capturado' : 'Documento salvo');
        capturedMedia = true;
      } catch (error) {
        showNotification(error.message || 'Não foi possível capturar o documento');
        return;
      }
    }

    if (activeMode === 'Estudante') {
      try {
        const studentCapture = await onStudentCapture();
        showNotification(studentCapture?.processedBlob ? 'Conteúdo capturado' : 'Documento salvo');
        capturedMedia = true;
      } catch (error) {
        showNotification(error.message || 'Não foi possível capturar para estudo');
        return;
      }
    }

    if (activeMode === 'Panorâmica') {
      try {
        await onPanoramaCapture();
        showNotification('Panorâmica salva na galeria');
        capturedMedia = true;
      } catch (error) {
        showNotification(error.message || 'Não foi possível capturar a panorâmica');
        return;
      }
    }

    if (!capturedMedia) {
      showNotification('Use as ações do modo selecionado.');
      return;
    }

    setThumbnailVisible(true);
    setThumbnailFlying(false);
    schedule(() => setThumbnailFlying(true), 60);
    schedule(() => {
      setThumbnailVisible(false);
      setThumbnailFlying(false);
    }, 650);
  };

  const handlePhotoCapture = () => {
    const timerValue = timerState === 'none' ? '' : timerState.replace('s', '');

    if (timerValue && !Number.isNaN(Number(timerValue))) {
      let count = Number.parseInt(timerValue, 10);
      setCountdown(String(count));
      const intervalId = window.setInterval(() => {
        count -= 1;
        if (count > 0) {
          setCountdown(String(count));
        } else {
          window.clearInterval(intervalId);
          countdownIntervalRef.current = null;
          setCountdown('');
          takePhoto();
        }
      }, 1000);
      countdownIntervalRef.current = intervalId;
      return;
    }

    takePhoto();
  };

  const handleVideoCapture = async () => {
    try {
      if (isVideoRecording) {
        await onVideoRecordingStop();
        setRecordingSeconds(0);
        showNotification('Vídeo salvo na galeria');
        return;
      }

      const recordingInfo = await onVideoRecordingStart();
      setRecordingSeconds(0);
      showNotification(recordingInfo?.audioError || 'Gravação iniciada');
    } catch (error) {
      showNotification(error.message || 'Não foi possível gravar o vídeo');
    }
  };

  const handleShutter = () => {
    if (activeMode === 'Vídeo') {
      handleVideoCapture();
      return;
    }

    handlePhotoCapture();
  };

  const handleFlip = () => {
    setFlipped((current) => !current);
    setViewfinderBlurred(true);
    schedule(() => setViewfinderBlurred(false), 400);
  };

  useEffect(() => {
    if (shutterRequestId === 0 || !didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    handleShutter();
  }, [shutterRequestId]);

  useEffect(() => {
    if (flipRequestId === 0) return;
    handleFlip();
  }, [flipRequestId]);

  const minutes = Math.floor(recordingSeconds / 60).toString().padStart(2, '0');
  const seconds = (recordingSeconds % 60).toString().padStart(2, '0');
  const viewfinderBackground = activeMode === 'Panorâmica'
    ? 'linear-gradient(rgba(0,0,0,0.2), transparent, rgba(0,0,0,0.2))'
    : activeMode === 'Foto' ? 'none' : undefined;
  const showCameraStatePanel = ['idle', 'initializing', 'preparing', 'error'].includes(cameraStatus);
  const cameraStatusMessage = cameraStatus === 'preparing'
    ? 'Preparando imagem...'
    : 'Iniciando câmera...';
  const showPanoramaStatus = activeMode === 'Panorâmica' && panoramaState.status === 'capturing';

  return (
    <>
      <div
        className="viewfinder"
        ref={viewfinderRef}
        onClick={handleViewfinderClick}
        style={{
          filter: viewfinderBlurred ? 'blur(10px)' : `brightness(${0.4 + brightness * 0.8})`,
          transform: `scale(${previewZoomFactor})`,
          transition: 'filter 0.3s, transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          background: viewfinderBackground
        }}
      >
        <video
          aria-label="Feed real da câmera"
          autoPlay
          className={`camera-video ${facingMode === 'user' ? 'is-front-camera' : ''}`}
          muted
          playsInline
          ref={videoRef}
        />

        {cameraTransitionFrame && cameraStatus === 'switching' && (
          <img className="camera-transition-frame" src={cameraTransitionFrame} alt="" aria-hidden="true" />
        )}

        {cameraStatus === 'switching' && (
          <div className="camera-switch-indicator" role="status">Trocando câmera...</div>
        )}

        {showCameraStatePanel && (
          <div className="camera-state-panel" role="status">
            {cameraStatus !== 'error' && <p>{cameraStatusMessage}</p>}
            {cameraStatus === 'error' && (
              <>
                <p>{cameraError}</p>
                <button type="button" onClick={() => retryCamera()}>Tentar novamente</button>
              </>
            )}
          </div>
        )}

        <div
          className={`focus-box ${focusVisible ? 'show' : ''}`}
          id="focus-box"
          style={{ left: `${focusPoint.x}px`, top: `${focusPoint.y}px` }}
        >
          <span className="focus-corner-bl" />
          <span className="focus-corner-br" />
        </div>

        {activeMode === 'Estudante' && <div className="focus-box-student" id="focus-box-student" />}
        {activeMode === 'Panorâmica' && (
          <div className="pano-guide" id="pano-guide">
            <div className="pano-line" />
            <div className="pano-arrow" />
          </div>
        )}

        {showPanoramaStatus && (
          <div className="document-scan-status" role="status">
            <span>Capturando panorâmica...</span>
            <strong>{panoramaState.progress}%</strong>
          </div>
        )}
        {activeMode === 'Documento' && <div className="doc-scanner-frame" id="doc-scanner-frame" style={{ display: 'block' }} />}

        <div id="recording-indicator" className="recording-indicator" style={{ display: isVideoRecording ? 'flex' : 'none' }}>
          <div className="red-dot" />
          <span id="recording-timer">{minutes}:{seconds}</span>
        </div>

        <div id="camera-notification" className={`camera-notification ${notification ? 'show' : ''}`}>{notification}</div>
        <div id="timer-countdown" className={`timer-countdown ${countdown ? 'show' : ''}`}>{countdown}</div>
      </div>

      <div className={`zoom-selector ${controlsVisible || ratio === '1:1' ? 'show' : ''}`}>
        {['.5', '1', '2', '3'].map((level) => (
          <button
            className={`zoom-btn ${zoomLevel === level ? 'active' : ''}`}
            key={level}
            onClick={(event) => {
              event.stopPropagation();
              onZoomLevelChange(level);
              resetHideTimer();
            }}
            title={hardwareZoomSupported ? 'Zoom aplicado pela câmera quando suportado' : 'Zoom digital aplicado na captura'}
          >
            {level}
          </button>
        ))}
      </div>

      <div className={`brightness-track ${controlsVisible ? 'show' : ''}`} id="brightness-track" ref={trackRef}>
        <div className="brightness-fill" id="brightness-fill" style={{ height: `${brightness * 100}%` }} />
        <div
          className="brightness-thumb"
          id="brightness-thumb"
          onPointerDown={(event) => {
            event.preventDefault();
            setDraggingBrightness(true);
          }}
          style={{ top: `${(1 - brightness) * 160}px` }}
        />
      </div>

      <div
        id="shutter-thumbnail"
        className="shutter-thumbnail"
        style={{
          display: thumbnailVisible ? 'block' : 'none',
          opacity: thumbnailFlying ? 0 : 1,
          left: thumbnailFlying ? '40px' : '50%',
          top: thumbnailFlying ? '630px' : '50%',
          transform: thumbnailFlying ? 'scale(0.15)' : 'translate(-50%, -50%) scale(1)',
          transition: thumbnailFlying ? 'all 0.55s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
        }}
      />

    </>
  );
}
