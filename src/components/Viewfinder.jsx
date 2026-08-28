import { useEffect, useRef, useState } from 'react';

const zoomLevels = {
  '.5': 'scale(0.85)',
  1: 'scale(1)',
  2: 'scale(1.5)',
  3: 'scale(2.2)'
};

export default function Viewfinder({
  activeMode,
  flipRequestId,
  flashOff,
  notification,
  onFlippedChange,
  onRecordingChange,
  onStudentOverlayOpen,
  ratio,
  shutterRequestId,
  showNotification,
  timerState,
  viewfinderHeight
}) {
  const [focusPoint, setFocusPoint] = useState({ x: 195, y: 260 });
  const [focusVisible, setFocusVisible] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [brightness, setBrightness] = useState(0.6);
  const [draggingBrightness, setDraggingBrightness] = useState(false);
  const [zoomLevel, setZoomLevel] = useState('1');
  const [flipped, setFlipped] = useState(false);
  const [viewfinderBlurred, setViewfinderBlurred] = useState(false);
  const [flashPulse, setFlashPulse] = useState(false);
  const [thumbnailVisible, setThumbnailVisible] = useState(false);
  const [thumbnailFlying, setThumbnailFlying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
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
    onRecordingChange(isRecording);
  }, [isRecording, onRecordingChange]);

  useEffect(() => {
    onFlippedChange(flipped);
  }, [flipped, onFlippedChange]);

  useEffect(() => {
    if (!isRecording) return undefined;

    const intervalId = window.setInterval(() => {
      setRecordingSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isRecording]);

  useEffect(() => {
    if (activeMode !== 'Vídeo' && isRecording) {
      setIsRecording(false);
      setRecordingSeconds(0);
    }
  }, [activeMode, isRecording]);

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

  const takePhoto = () => {
    clearManagedTimeouts();

    if (!flashOff) {
      setFlashPulse(false);
      window.requestAnimationFrame(() => setFlashPulse(true));
      schedule(() => setFlashPulse(false), 300);
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

  const handleShutter = () => {
    if (activeMode === 'Vídeo') {
      setIsRecording((current) => {
        const next = !current;
        if (!next) setRecordingSeconds(0);
        return next;
      });
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

  return (
    <>
      <div
        className="viewfinder"
        onClick={handleViewfinderClick}
        style={{
          height: `${viewfinderHeight}px`,
          filter: viewfinderBlurred ? 'blur(10px)' : `brightness(${0.4 + brightness * 0.8})`,
          transform: zoomLevels[zoomLevel],
          transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1), filter 0.3s, transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          background: viewfinderBackground
        }}
      >
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
        {activeMode === 'Documento' && <div className="doc-scanner-frame" id="doc-scanner-frame" style={{ display: 'block' }} />}

        {activeMode === 'Estudante' && (
          <div className="student-actions" id="student-actions">
            <button className="student-btn" onClick={() => onStudentOverlayOpen('summary')}>Resumir</button>
            <button className="student-btn" onClick={() => onStudentOverlayOpen('notes')}>Anotar</button>
            <button className="student-btn" onClick={() => onStudentOverlayOpen('export')}>Exportar</button>
          </div>
        )}

        {activeMode === 'Documento' && (
          <div className="student-actions" id="doc-actions">
            <button className="student-btn" onClick={() => onStudentOverlayOpen('summary')}>Digitalizar</button>
            <button className="student-btn" onClick={() => onStudentOverlayOpen('docExport')}>Exportar</button>
          </div>
        )}

        <div id="recording-indicator" className="recording-indicator" style={{ display: isRecording ? 'flex' : 'none' }}>
          <div className="red-dot" />
          <span id="recording-timer">{minutes}:{seconds}</span>
        </div>

        <div id="pro-controls" className={`pro-controls ${activeMode === 'Pro' ? 'show' : ''}`}>
          <div className="pro-item"><span>ISO</span><strong>Auto</strong></div>
          <div className="pro-item"><span>S</span><strong>1/125</strong></div>
          <div className="pro-item"><span>EV</span><strong>0.0</strong></div>
          <div className="pro-item"><span>WB</span><strong>Auto</strong></div>
          <div className="pro-item"><span>AF</span><strong>AF-C</strong></div>
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
              setZoomLevel(level);
              resetHideTimer();
            }}
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

      <div className={`flash-overlay ${flashPulse ? 'do-flash' : ''}`} id="flash-overlay" />

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
