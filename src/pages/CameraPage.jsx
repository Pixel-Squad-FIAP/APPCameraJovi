import { useCallback, useEffect, useMemo, useState } from 'react';
import BottomControls from '../components/BottomControls.jsx';
import Gallery, { DocumentWorkspace } from '../components/Gallery.jsx';
import MoreModesOverlay from '../components/MoreModesOverlay.jsx';
import SettingsOverlay from '../components/SettingsOverlay.jsx';
import TopBar from '../components/TopBar.jsx';
import Viewfinder from '../components/Viewfinder.jsx';
import { RATIO_STATES, TIMER_STATES } from '../data/modes.js';
import { useCameraCapture } from '../hooks/useCameraCapture.js';
import { useDocumentScanner } from '../hooks/useDocumentScanner.js';
import { useNotification } from '../hooks/useNotification.js';
import { updateStoredCapture } from '../services/captureStorage.js';
import { appendDocumentPage, getCombinedDocumentText, getDocumentPages } from '../services/documentModel.js';
import { createAcademicAnalysis } from '../services/studentSummary.js';

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

const ratioValueByLabel = {
  '1:1': 1,
  '3:4': 3 / 4,
  '9:16': 9 / 16
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
  const [postCapture, setPostCapture] = useState({ captureId: '', mode: '' });
  const [pendingDocumentPageId, setPendingDocumentPageId] = useState('');
  const [documentCorners, setDocumentCorners] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [panoramaState, setPanoramaState] = useState({ progress: 0, status: 'idle' });
  const [viewfinderSize, setViewfinderSize] = useState({ height: 520, width: 390 });
  const ratio = RATIO_STATES[ratioIndex];
  const timerState = TIMER_STATES[timerIndex];
  const usesMediaStage = ['Foto', 'Vídeo'].includes(activeMode);
  const viewfinderHeight = viewfinderSize.height || viewfinderHeightByRatio[ratio];
  const effectiveRatio = ratio === 'Full'
    ? (viewfinderSize.width || 390) / Math.max(1, viewfinderHeight)
    : ratioValueByLabel[ratio] || 3 / 4;
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
    ratio: effectiveRatio,
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
  const postCaptureDocument = postCapture.captureId
    ? userCaptures.find((capture) => capture.id === postCapture.captureId) || null
    : null;

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
    if (activeMode === 'Documento') {
      showNotification('Documento usa recorte livre pelos cantos');
      return;
    }

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

  const handleDocumentCapture = useCallback(async (detectedCorners = documentCorners) => {
    if (pendingDocumentPageId) {
      const targetDocument = userCaptures.find((capture) => capture.id === pendingDocumentPageId);
      if (!targetDocument) {
        setPendingDocumentPageId('');
        throw new Error('Documento original não encontrado.');
      }
      const pageCapture = await captureDocument({ initialCorners: detectedCorners, persist: false });
      const page = getDocumentPages(pageCapture)[0];
      const updatedDocument = await updateStoredCapture(targetDocument.id, appendDocumentPage(targetDocument, {
        ...page,
        id: page.id || pageCapture.id
      }));
      updateUserCapture(updatedDocument);
      setPendingDocumentPageId('');
      setPostCapture({ captureId: updatedDocument.id, mode: 'document', pageId: page.id || pageCapture.id });
      return updatedDocument;
    }

    const capture = await scanDocument(detectedCorners, { prepare: false });
    setPostCapture({ captureId: capture.id, mode: 'document', pageId: getDocumentPages(capture)[0]?.id || '' });
    return capture;
  }, [captureDocument, documentCorners, pendingDocumentPageId, scanDocument, updateUserCapture, userCaptures]);

  const handleStudentCapture = useCallback(async () => {
    const capture = await scanDocument(null);
    const updatedCapture = await updateStoredCapture(capture.id, {
      source: 'student',
      title: capture.title || 'Conteúdo de estudo',
      updatedAt: new Date().toISOString()
    });
    updateUserCapture(updatedCapture);
    const recognizedCapture = await retryDocumentOcr(updatedCapture);
    const summary = createAcademicAnalysis(getCombinedDocumentText(recognizedCapture));
    const finalCapture = summary
      ? await updateStoredCapture(recognizedCapture.id, {
        summary,
        summaryGeneratedAt: new Date().toISOString(),
        summaryNeedsUpdate: false,
        updatedAt: new Date().toISOString()
      })
      : recognizedCapture;
    updateUserCapture(finalCapture);
    setPostCapture({ captureId: finalCapture.id, mode: 'student', pageId: getDocumentPages(finalCapture)[0]?.id || '' });
    return finalCapture;
  }, [retryDocumentOcr, scanDocument, updateUserCapture]);

  return (
    <main className="camera-page" aria-label="Aplicação da câmera JOVI">
      <div className="phone">
          <div id="camera-app" className={`camera-app ${usesMediaStage ? 'media-camera-stage' : ''} ${ratioClassByValue[ratio]}`}>
          <TopBar
            activeMode={activeMode}
            flashDisabled={!torchSupported || cameraStatus !== 'ready'}
            flashOff={!torchEnabled}
            moreModesOpen={moreModesOpen}
            ratio={ratio}
            ratioHidden={activeMode === 'Documento'}
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
            isVideoRecording={isVideoRecording}
            documentScanState={documentScannerState}
            isDocumentScanning={isDocumentScanning}
            onDocumentCapture={handleDocumentCapture}
            onDocumentCornersChange={setDocumentCorners}
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
            onStudentCapture={handleStudentCapture}
            onVideoRecordingStart={startVideoRecording}
            onVideoRecordingStop={stopVideoRecording}
            onZoomLevelChange={setZoomLevel}
            panoramaState={panoramaState}
            previewZoomFactor={previewZoomFactor}
            ratio={effectiveRatio}
            ratioLabel={ratio}
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

          <PostCaptureWorkspace
            capture={postCaptureDocument}
            documentOcrState={documentScannerState}
            mode={postCapture.mode}
            onCaptureUpdated={updateUserCapture}
            initialPageId={postCapture.pageId}
            initialCropOnly={postCapture.mode === 'document'}
            onClose={() => setPostCapture({ captureId: '', mode: '', pageId: '' })}
            onAddPageRequest={(capture) => {
              setPendingDocumentPageId(capture.id);
              setPostCapture({ captureId: '', mode: '', pageId: '' });
              setActiveMode('Documento');
              showNotification('Enquadre a próxima página e toque no shutter');
            }}
            onRecognizeDocument={retryDocumentOcr}
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

function PostCaptureWorkspace({
  capture,
  documentOcrState,
  initialCropOnly,
  initialPageId,
  mode,
  onAddPageRequest,
  onCaptureUpdated,
  onClose,
  onRecognizeDocument,
  showNotification
}) {
  const [url, setUrl] = useState('');
  const displayBlob = capture?.processedBlob || capture?.blob || null;

  useEffect(() => {
    if (!displayBlob) {
      setUrl('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(displayBlob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [displayBlob]);

  const captureWithUrl = useMemo(() => (
    capture ? { ...capture, url } : null
  ), [capture, url]);

  if (!capture) return null;

  return (
    <div className="post-capture-overlay show">
      <div className="gallery-header">
        <button className="gallery-close" onClick={onClose} type="button" aria-label="Fechar revisão">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <span>{mode === 'student' ? 'Estudo capturado' : 'Documento capturado'}</span>
      </div>
      <DocumentWorkspace
        backLabel="Refazer"
        capture={captureWithUrl}
        documentOcrState={documentOcrState}
        isCreating={false}
        initialCropOnly={initialCropOnly}
        initialPageId={initialPageId}
        modeContext={mode}
        onAddPageRequest={onAddPageRequest}
        onBack={onClose}
        onCaptureUpdated={onCaptureUpdated}
        onRecognizeDocument={onRecognizeDocument}
        showNotification={showNotification}
      />
    </div>
  );
}
