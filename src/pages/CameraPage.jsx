import { useCallback, useState } from 'react';
import BottomControls from '../components/BottomControls.jsx';
import Gallery from '../components/Gallery.jsx';
import MoreModesOverlay from '../components/MoreModesOverlay.jsx';
import SettingsOverlay from '../components/SettingsOverlay.jsx';
import StudentMode from '../components/StudentMode.jsx';
import TopBar from '../components/TopBar.jsx';
import Viewfinder from '../components/Viewfinder.jsx';
import { RATIO_STATES, TIMER_STATES } from '../data/modes.js';
import { useCameraCapture } from '../hooks/useCameraCapture.js';
import { useNotification } from '../hooks/useNotification.js';

const ratioClassByValue = {
  '3:4': '',
  '9:16': 'aspect-full',
  '1:1': 'aspect-1-1',
  Full: 'aspect-full'
};

const viewfinderHeightByRatio = {
  '3:4': 520,
  '9:16': 738,
  '1:1': 390,
  Full: 738
};

export default function CameraPage() {
  const [activeMode, setActiveMode] = useState('Foto');
  const [flashOff, setFlashOff] = useState(false);
  const [timerIndex, setTimerIndex] = useState(0);
  const [ratioIndex, setRatioIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState('1');
  const [moreModesOpen, setMoreModesOpen] = useState(false);
  const { notification, showNotification } = useNotification();
  const [visitedModes, setVisitedModes] = useState(() => new Set());
  const [shutterRequestId, setShutterRequestId] = useState(0);
  const [flipRequestId, setFlipRequestId] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [studentOverlay, setStudentOverlay] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const ratio = RATIO_STATES[ratioIndex];
  const timerState = TIMER_STATES[timerIndex];
  const {
    cameraError,
    cameraStatus,
    capturePhoto,
    facingMode,
    hardwareZoomSupported,
    isVideoRecording,
    previewZoomFactor,
    retryCamera,
    startVideoRecording,
    stopVideoRecording,
    toggleFacingMode,
    userCaptures,
    videoRef
  } = useCameraCapture({ ratio, zoomLevel });

  const handleModeChange = useCallback((mode) => {
    if (isVideoRecording && mode !== 'Vídeo') {
      showNotification('Pare a gravação antes de trocar de modo');
      return;
    }

    setActiveMode(mode);
    setMoreModesOpen(false);

    if (mode === 'Pro') showNotification('Modo Profissional ativado');
    if (mode === 'Vídeo') showNotification('Pronto para gravar');
    if (mode === 'Documento') showNotification('Enquadre o documento no centro');
    if (mode === 'Noite') showNotification('Longa exposição: mantenha parado');
    if (mode === 'Panorâmica') showNotification('Deslize lentamente para o lado');
    if (mode === 'Retrato' && !visitedModes.has('Retrato')) {
      setVisitedModes((current) => new Set(current).add('Retrato'));
      showNotification('Posicione o assunto a 1.5m');
    }
  }, [isVideoRecording, showNotification, visitedModes]);

  const handleTimerClick = () => {
    setTimerIndex((current) => (current + 1) % TIMER_STATES.length);
  };

  const handleRatioClick = () => {
    if (isVideoRecording) {
      showNotification('Pare a gravação antes de trocar a proporção');
      return;
    }

    setRatioIndex((current) => (current + 1) % RATIO_STATES.length);
  };

  return (
    <main className="camera-page" aria-label="Aplicação da câmera JOVI">
      <div className="phone">
        <div id="camera-app" className={`camera-app ${ratioClassByValue[ratio]}`}>
          <TopBar
            activeMode={activeMode}
            flashOff={flashOff}
            moreModesOpen={moreModesOpen}
            ratio={ratio}
            timerState={timerState}
            onFlashToggle={() => setFlashOff((current) => !current)}
            onRatioClick={handleRatioClick}
            onSettingsClick={() => setMoreModesOpen((current) => !current)}
            onTimerClick={handleTimerClick}
          />

          <Viewfinder
            activeMode={activeMode}
            cameraError={cameraError}
            cameraStatus={cameraStatus}
            facingMode={facingMode}
            flashOff={flashOff}
            hardwareZoomSupported={hardwareZoomSupported}
            notification={notification}
            onStudentOverlayOpen={setStudentOverlay}
            onCaptureDestinationOpen={() => setStudentOverlay('captureDestination')}
            isVideoRecording={isVideoRecording}
            onRealPhotoCapture={capturePhoto}
            onVideoRecordingStart={startVideoRecording}
            onVideoRecordingStop={stopVideoRecording}
            onZoomLevelChange={setZoomLevel}
            previewZoomFactor={previewZoomFactor}
            ratio={ratio}
            retryCamera={retryCamera}
            shutterRequestId={shutterRequestId}
            showNotification={showNotification}
            timerState={timerState}
            flipRequestId={flipRequestId}
            onFlippedChange={setFlipped}
            videoRef={videoRef}
            viewfinderHeight={viewfinderHeightByRatio[ratio]}
            zoomLevel={zoomLevel}
          />

          <BottomControls
            activeMode={activeMode}
            flipped={flipped}
            flipDisabled={isVideoRecording}
            isRecording={isVideoRecording}
            onGalleryOpen={() => setGalleryOpen(true)}
            onModeChange={handleModeChange}
            onFlip={() => {
              if (isVideoRecording) {
                showNotification('Pare a gravação antes de virar a câmera');
                return;
              }

              setFlipRequestId((current) => current + 1);
              toggleFacingMode();
            }}
            onShutter={() => setShutterRequestId((current) => current + 1)}
          />

          <Gallery isOpen={galleryOpen} onClose={() => setGalleryOpen(false)} userCaptures={userCaptures} />

          <StudentMode
            activeOverlay={studentOverlay}
            onClose={() => setStudentOverlay(null)}
            showNotification={showNotification}
          />

          <MoreModesOverlay
            isOpen={moreModesOpen}
            onModeSelect={handleModeChange}
            onOpenLogin={() => {
              setMoreModesOpen(false);
              setSettingsOpen(true);
            }}
          />

          <SettingsOverlay
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            showNotification={showNotification}
          />
        </div>
      </div>
    </main>
  );
}
