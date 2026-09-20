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
import { useDocumentScanner } from '../hooks/useDocumentScanner.js';
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

function getLatestUserCapture(captures) {
  return captures.reduce((latest, capture) => {
    if (!latest) return capture;
    return new Date(capture.createdAt) > new Date(latest.createdAt) ? capture : latest;
  }, null);
}

export default function CameraPage() {
  const [activeMode, setActiveMode] = useState('Foto');
  const [timerIndex, setTimerIndex] = useState(0);
  const [ratioIndex, setRatioIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState('1');
  const [moreModesOpen, setMoreModesOpen] = useState(false);
  const { notification, showNotification } = useNotification();
  const [shutterRequestId, setShutterRequestId] = useState(0);
  const [flipRequestId, setFlipRequestId] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [studentOverlay, setStudentOverlay] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [panoramaState, setPanoramaState] = useState({ progress: 0, status: 'idle' });
  const [viewfinderSize, setViewfinderSize] = useState({ height: 520, width: 390 });
  const ratio = RATIO_STATES[ratioIndex];
  const timerState = TIMER_STATES[timerIndex];
  const viewfinderHeight = viewfinderSize.height || viewfinderHeightByRatio[ratio];
  const {
    addUserCapture,
    cameraError,
    cameraStatus,
    cameraTransitionFrame,
    captureDocument,
    capturePanorama,
    capturePhoto,
    facingMode,
    hardwareZoomSupported,
    isVideoRecording,
    previewZoomFactor,
    retryCamera,
    startVideoRecording,
    stopVideoRecording,
    toggleTorch,
    toggleFacingMode,
    torchEnabled,
    torchSupported,
    updateUserCapture,
    userCaptures,
    videoRef
  } = useCameraCapture({
    ratio,
    viewfinderHeight,
    viewfinderWidth: viewfinderSize.width || 390,
    zoomLevel
  });
  const latestCapture = getLatestUserCapture(userCaptures);
  const {
    isDocumentScanning,
    retryDocumentOcr,
    scanDocument,
    state: documentScannerState
  } = useDocumentScanner({
    captureDocument,
    onCaptureUpdated: updateUserCapture
  });

  const handleModeChange = useCallback((mode) => {
    if (isVideoRecording && mode !== 'Vídeo') {
      showNotification('Pare a gravação antes de trocar de modo');
      return;
    }

    setActiveMode(mode);
    setMoreModesOpen(false);

    if (mode === 'Vídeo') showNotification('Pronto para gravar');
    if (mode === 'Documento') showNotification('Enquadre o documento no centro');
    if (mode === 'Panorâmica') showNotification('Mova lentamente na horizontal');
    if (mode === 'Estudante') showNotification('Use documentos com OCR para estudar');
  }, [isVideoRecording, showNotification]);

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

  const handleFlashToggle = async () => {
    const result = await toggleTorch();
    if (!result.ok && result.error) {
      showNotification(result.error);
    }
  };

  return (
    <main className="camera-page" aria-label="Aplicação da câmera JOVI">
      <div className="phone">
        <div id="camera-app" className={`camera-app ${ratioClassByValue[ratio]}`}>
          <TopBar
            activeMode={activeMode}
            flashDisabled={!torchSupported || cameraStatus !== 'ready'}
            flashOff={!torchEnabled}
            moreModesOpen={moreModesOpen}
            ratio={ratio}
            timerState={timerState}
            onFlashToggle={handleFlashToggle}
            onRatioClick={handleRatioClick}
            onSettingsClick={() => setMoreModesOpen((current) => !current)}
            onTimerClick={handleTimerClick}
          />

          <Viewfinder
            activeMode={activeMode}
            cameraError={cameraError}
            cameraStatus={cameraStatus}
            cameraTransitionFrame={cameraTransitionFrame}
            facingMode={facingMode}
            hardwareZoomSupported={hardwareZoomSupported}
            notification={notification}
            onStudentOverlayOpen={setStudentOverlay}
            isVideoRecording={isVideoRecording}
            documentScanState={documentScannerState}
            isDocumentScanning={isDocumentScanning}
            onDocumentCapture={scanDocument}
            onDocumentExportUnavailable={() => showNotification('Exportação estará disponível após o processamento do documento')}
            onPanoramaCapture={async () => {
              setPanoramaState({ progress: 0, status: 'capturing' });
              try {
                const capture = await capturePanorama({
                  onProgress: (progress) => setPanoramaState({ progress, status: 'capturing' })
                });
                setPanoramaState({ progress: 100, status: 'done' });
                window.setTimeout(() => setPanoramaState({ progress: 0, status: 'idle' }), 900);
                return capture;
              } catch (error) {
                setPanoramaState({ progress: 0, status: 'idle' });
                throw error;
              }
            }}
            onRealPhotoCapture={capturePhoto}
            onVideoRecordingStart={startVideoRecording}
            onVideoRecordingStop={stopVideoRecording}
            onZoomLevelChange={setZoomLevel}
            panoramaState={panoramaState}
            previewZoomFactor={previewZoomFactor}
            ratio={ratio}
            retryCamera={retryCamera}
            shutterRequestId={shutterRequestId}
            showNotification={showNotification}
            timerState={timerState}
            flipRequestId={flipRequestId}
            onFlippedChange={setFlipped}
            onViewfinderResize={setViewfinderSize}
            videoRef={videoRef}
            zoomLevel={zoomLevel}
          />

          <BottomControls
            activeMode={activeMode}
            flipped={flipped}
            flipDisabled={isVideoRecording}
            isRecording={isVideoRecording}
            latestCapture={latestCapture}
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

          <Gallery
            onCaptureCreated={addUserCapture}
            onCaptureUpdated={updateUserCapture}
            documentOcrState={documentScannerState}
            isOpen={galleryOpen}
            onClose={() => setGalleryOpen(false)}
            onRecognizeDocument={retryDocumentOcr}
            userCaptures={userCaptures}
          />

          <StudentMode
            activeOverlay={studentOverlay}
            onClose={() => setStudentOverlay(null)}
            onDocumentUpdated={updateUserCapture}
            showNotification={showNotification}
            userCaptures={userCaptures}
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
