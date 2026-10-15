import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CameraFallback from '../components/camera/CameraFallback.jsx';
import CameraShell from '../components/camera/CameraShell.jsx';
import HelpSheet from '../components/camera/HelpSheet.jsx';
import ModeSelector from '../components/camera/ModeSelector.jsx';
import Onboarding from '../components/camera/Onboarding.jsx';
import SettingsSheet from '../components/camera/SettingsSheet.jsx';
import ShutterBar from '../components/camera/ShutterBar.jsx';
import TopBar from '../components/camera/TopBar.jsx';
import Viewfinder from '../components/camera/Viewfinder.jsx';
import AlbumPicker from '../components/library/AlbumPicker.jsx';
import { focusRing } from '../components/ui/Button.jsx';
import Icon from '../components/ui/Icon.jsx';
import Sheet from '../components/ui/Sheet.jsx';
import { DEFAULT_ALBUM, getMode, MODES, RATIO_OPTIONS, TIMER_OPTIONS } from '../data/modes.js';
import { useToast } from '../feedback/ToastContext.jsx';
import { useCameraStream } from '../hooks/useCameraStream.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { useElementSize } from '../hooks/useElementSize.js';
import { usePreference } from '../hooks/usePreference.js';
import { useSceneAnalysis } from '../hooks/useSceneAnalysis.js';
import { useVideoRecorder } from '../hooks/useVideoRecorder.js';
import { captureFromFile, captureFromVideo, thumbnailFromVideo } from '../lib/capturePipeline.js';
import { ratioToAspect } from '../lib/imageProcessing.js';
import { preloadOcr } from '../lib/ocrEngine.js';
import { useCaptureLibrary } from '../library/LibraryContext.jsx';

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const DOCUMENT_ALIGNED_RATIO = 0.5;

function nextOption(options, current) {
  return options[(options.indexOf(current) + 1) % options.length];
}

function CameraAside({ mode }) {
  return (
    <div className="text-white">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-jovi-300">JOVI Camera</p>
      <h1 className="mt-2 text-2xl font-extrabold leading-tight">Modo {mode.label}</h1>
      <p className="mt-2 text-sm text-white/65">{mode.description}</p>
      <dl className="mt-6 space-y-2 text-sm text-white/70">
        <div className="flex justify-between gap-3"><dt>Capturar</dt><dd><kbd className="rounded bg-white/10 px-1.5 py-0.5">Espaço</kbd></dd></div>
        <div className="flex justify-between gap-3"><dt>Trocar modo</dt><dd><kbd className="rounded bg-white/10 px-1.5 py-0.5">←</kbd> <kbd className="rounded bg-white/10 px-1.5 py-0.5">→</kbd></dd></div>
      </dl>
      <nav className="mt-8 flex flex-col gap-2 text-sm font-semibold" aria-label="Atalhos">
        <Link className={`flex items-center gap-2 rounded-lg py-1 text-white/80 hover:text-white ${focusRing}`} to="/galeria"><Icon name="image" size={18} /> Galeria</Link>
        <Link className={`flex items-center gap-2 rounded-lg py-1 text-white/80 hover:text-white ${focusRing}`} to="/"><Icon name="home" size={18} /> Página do projeto</Link>
      </nav>
    </div>
  );
}

export default function CameraPage() {
  const navigate = useNavigate();
  const { showNotification } = useToast();
  const { captures, addCapture, startOcr } = useCaptureLibrary();

  const [modeId, setModeId] = usePreference('lastMode');
  const [facingMode, setFacingMode] = usePreference('facingMode');
  const [ratio, setRatio] = usePreference('ratio');
  const [timer, setTimer] = usePreference('timer');
  const [grid, setGrid] = usePreference('grid');
  const [smartHints] = usePreference('smartHints');
  const [mirrorFront] = usePreference('mirrorFront');
  const [onboardingDone, setOnboardingDone] = usePreference('onboardingDone');
  const [studyAlbum, setStudyAlbum] = usePreference('studyAlbum');

  const [zoom, setZoom] = useState(1);
  const [exposure, setExposure] = useState(0);
  const [flashOn, setFlashOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [processingLabel, setProcessingLabel] = useState('');
  const [captureFlashKey, setCaptureFlashKey] = useState(0);
  const [screenFlash, setScreenFlash] = useState(false);
  const [sheet, setSheet] = useState(null);
  const fileInputRef = useRef(null);
  const takePhotoRef = useRef(null);
  const topBarRef = useRef(null);
  const bottomBarRef = useRef(null);
  const topBarSize = useElementSize(topBarRef);
  const bottomBarSize = useElementSize(bottomBarRef);

  const mode = getMode(modeId);
  const isFront = facingMode === 'user';
  const camera = useCameraStream({ facingMode, enabled: onboardingDone });
  const ready = camera.status === 'ready';
  const recorder = useVideoRecorder(camera.streamRef);
  const countdown = useCountdown();
  const scene = useSceneAnalysis(camera.videoRef, {
    enabled: ready && !recorder.isRecording && !busy,
    suggest: smartHints,
    currentMode: mode.id
  });

  const locked = recorder.isRecording || countdown.isRunning;
  const aspect = mode.isVideo ? camera.videoAspect ?? 9 / 16 : ratioToAspect(ratio);
  const docAligned = mode.processing === 'document' && (scene.metrics?.paperRatio ?? 0) > DOCUMENT_ALIGNED_RATIO;
  const captureAlbum = mode.afterCapture === 'stay' ? studyAlbum : DEFAULT_ALBUM;

  useEffect(() => {
    if (mode.extractsText) preloadOcr();
  }, [mode.extractsText]);

  const changeMode = useCallback((id) => {
    if (locked || id === modeId) return;
    setModeId(id);
    setExposure(0);
  }, [locked, modeId, setModeId]);

  const swipeMode = useCallback((direction) => {
    const index = MODES.findIndex((item) => item.id === mode.id);
    const next = MODES[index + direction];
    if (next) changeMode(next.id);
  }, [changeMode, mode.id]);

  const openCapture = useCallback((id) => navigate(`/galeria/${id}`, { state: { fromCamera: true } }), [navigate]);

  const storeCapture = useCallback(async ({ kind, result, modeForCapture, open }) => {
    const capture = await addCapture({
      kind,
      modeId: modeForCapture.id,
      album: modeForCapture.afterCapture === 'stay' ? studyAlbum : DEFAULT_ALBUM,
      mediaBlob: result.blob,
      thumbBlob: result.thumbBlob,
      width: result.width,
      height: result.height,
      duration: result.duration
    });

    if (modeForCapture.extractsText && kind === 'photo') startOcr(capture.id);

    if (open) {
      openCapture(capture.id);
      return;
    }

    const message = kind === 'video'
      ? 'Vídeo salvo na Galeria'
      : modeForCapture.extractsText ? `Salvo em ${capture.album} · extraindo texto…` : 'Foto salva na Galeria';
    showNotification(message, { tone: 'success', action: { label: 'Abrir', onClick: () => openCapture(capture.id) } });
  }, [addCapture, openCapture, showNotification, startOcr, studyAlbum]);

  const takePhoto = useCallback(async () => {
    setBusy(true);
    if (mode.processing === 'night') setProcessingLabel('Capturando… mantenha o aparelho parado');
    let torchUsed = false;

    try {
      if (flashOn) {
        if (!isFront && camera.torchSupported) torchUsed = await camera.setTorch(true);
        if (!torchUsed) setScreenFlash(true);
        await wait(torchUsed ? 400 : 250);
      }
      const result = await captureFromVideo(camera.videoRef.current, {
        modeId: mode.id,
        ratio,
        zoom,
        mirror: isFront && mirrorFront,
        exposure
      });
      setCaptureFlashKey((current) => current + 1);
      await storeCapture({
        kind: 'photo',
        modeForCapture: mode,
        open: mode.afterCapture === 'open',
        result: { ...result, blob: result.imageBlob }
      });
    } catch (error) {
      showNotification(error?.message || 'Não foi possível capturar a foto.', { tone: 'error' });
    } finally {
      if (torchUsed) camera.setTorch(false);
      setScreenFlash(false);
      setBusy(false);
      setProcessingLabel('');
    }
  }, [camera, exposure, flashOn, isFront, mirrorFront, mode, ratio, showNotification, storeCapture, zoom]);

  takePhotoRef.current = takePhoto;

  const toggleRecording = useCallback(async () => {
    if (!recorder.supported) {
      showNotification('Este navegador não grava vídeo.', { tone: 'error' });
      return;
    }

    if (!recorder.isRecording) {
      try {
        if (flashOn && !isFront) await camera.setTorch(true);
        await recorder.start();
      } catch (error) {
        showNotification(error?.message || 'Não foi possível iniciar a gravação.', { tone: 'error' });
      }
      return;
    }

    setBusy(true);
    try {
      const thumbBlob = await thumbnailFromVideo(camera.videoRef.current);
      const result = await recorder.stop();
      if (flashOn) camera.setTorch(false);
      if (!result?.blob?.size) throw new Error('A gravação ficou vazia.');
      await storeCapture({
        kind: 'video',
        modeForCapture: mode,
        open: false,
        result: {
          blob: result.blob,
          thumbBlob,
          width: camera.videoRef.current?.videoWidth,
          height: camera.videoRef.current?.videoHeight,
          duration: result.duration
        }
      });
      if (!recorder.hasAudio) showNotification('Vídeo salvo sem áudio (microfone não permitido).', { action: { label: 'Galeria', onClick: () => navigate('/galeria') } });
    } catch (error) {
      showNotification(error?.message || 'Não foi possível salvar o vídeo.', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  }, [camera, flashOn, isFront, mode, navigate, recorder, showNotification, storeCapture]);

  const handleShutter = useCallback(() => {
    if (countdown.isRunning) {
      countdown.cancel();
      showNotification('Temporizador cancelado');
      return;
    }
    if (!ready || busy) return;
    if (mode.isVideo) {
      toggleRecording();
      return;
    }
    if (timer > 0) {
      countdown.start(timer, () => takePhotoRef.current?.());
      return;
    }
    takePhoto();
  }, [busy, countdown, mode.isVideo, ready, showNotification, takePhoto, timer, toggleRecording]);

  const handleImport = async (event) => {
    const [file] = event.target.files ?? [];
    event.target.value = '';
    setSheet(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showNotification('Escolha um arquivo de imagem (JPG, PNG…).', { tone: 'error' });
      return;
    }

    setBusy(true);
    const importMode = mode.isVideo ? getMode('foto') : mode;
    try {
      const result = await captureFromFile(file, { modeId: importMode.id });
      await storeCapture({ kind: 'photo', modeForCapture: importMode, open: true, result: { ...result, blob: result.imageBlob } });
    } catch {
      showNotification('Não foi possível abrir essa imagem.', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const openImport = () => fileInputRef.current?.click();

  // Atalhos de teclado no computador.
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (sheet || !onboardingDone || event.repeat) return;
      if (event.target.closest?.('button, input, textarea, select, a, [role="radio"]')) return;
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        handleShutter();
      } else if (event.key === 'ArrowRight') {
        swipeMode(1);
      } else if (event.key === 'ArrowLeft') {
        swipeMode(-1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleShutter, onboardingDone, sheet, swipeMode]);

  const acceptSuggestion = () => {
    const suggested = getMode(scene.suggestion.mode);
    changeMode(suggested.id);
    showNotification(`Modo ${suggested.label} ativado`);
  };

  return (
    <CameraShell aside={<CameraAside mode={mode} />}>
      <div className="relative z-20 shrink-0" ref={topBarRef}>
        <TopBar
          disabled={locked}
          flashLabel={!isFront && camera.torchSupported ? 'Flash (lanterna)' : 'Flash de tela'}
          flashOn={flashOn}
          grid={grid}
          onFlashToggle={() => setFlashOn((current) => !current)}
          onGridToggle={() => setGrid((current) => !current)}
          onHelp={() => setSheet('help')}
          onMenu={() => setSheet('settings')}
          onRatioChange={() => setRatio(nextOption(RATIO_OPTIONS, ratio))}
          onTimerChange={() => setTimer(nextOption(TIMER_OPTIONS, timer))}
          ratio={ratio}
          showRatio={!mode.isVideo}
          showTimer={!mode.isVideo}
          timer={timer}
        />
      </div>

      <Viewfinder
        aspect={aspect}
        captureFlashKey={captureFlashKey}
        countdown={countdown.remaining}
        docAligned={docAligned}
        elapsed={recorder.elapsed}
        exposure={exposure}
        grid={grid}
        insetBottom={bottomBarSize.height}
        insetTop={topBarSize.height}
        isRecording={recorder.isRecording}
        mirror={isFront}
        mode={mode}
        onAcceptSuggestion={acceptSuggestion}
        onDismissSuggestion={scene.dismiss}
        onExposureChange={setExposure}
        onSwipeMode={swipeMode}
        onZoomChange={setZoom}
        processingLabel={processingLabel}
        ready={ready}
        suggestion={scene.suggestion}
        videoRef={camera.videoRef}
        zoom={zoom}
      >
        {onboardingDone && <CameraFallback onImport={openImport} onRetry={camera.retry} status={camera.status} />}
      </Viewfinder>

      {/* espaço do visor: os controles ficam por cima da imagem quando ela é mais alta (9:16) */}
      <div aria-hidden="true" className="pointer-events-none min-h-0 flex-1" />

      <div className="relative z-20 shrink-0 bg-gradient-to-t from-black/70 to-transparent pb-[max(0.75rem,env(safe-area-inset-bottom))]" ref={bottomBarRef}>
        {mode.afterCapture === 'stay' && (
          <div className="flex justify-center pt-2">
            <button
              aria-label={`Álbum das capturas: ${captureAlbum}. Toque para trocar`}
              className={`inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/15 disabled:opacity-40 ${focusRing}`}
              disabled={locked}
              onClick={() => setSheet('album')}
              type="button"
            >
              <Icon name="folder" size={14} /> Salvar em: {captureAlbum}
            </button>
          </div>
        )}
        <ShutterBar
          busy={busy}
          countdown={countdown.remaining}
          disabled={!ready && !countdown.isRunning}
          flipDisabled={locked || busy || !ready}
          isRecording={recorder.isRecording}
          isVideo={Boolean(mode.isVideo)}
          latestCapture={captures[0]}
          onFlip={() => setFacingMode(isFront ? 'environment' : 'user')}
          onOpenGallery={() => navigate('/galeria')}
          onShutter={handleShutter}
        />
        <ModeSelector activeMode={mode.id} disabled={locked} modes={MODES} onChange={changeMode} />
      </div>

      {screenFlash && <div aria-hidden="true" className="absolute inset-0 z-40 bg-white" />}

      <input accept="image/*" className="hidden" onChange={handleImport} ref={fileInputRef} type="file" />

      <SettingsSheet captureCount={captures.length} onClose={() => setSheet(null)} onImport={openImport} open={sheet === 'settings'} />
      <HelpSheet
        activeMode={mode.id}
        onClose={() => setSheet(null)}
        onShowTutorial={() => {
          setSheet(null);
          setOnboardingDone(false);
        }}
        open={sheet === 'help'}
      />
      <Sheet
        contained
        description="As próximas capturas do Modo Estudante vão direto para este álbum."
        onClose={() => setSheet(null)}
        open={sheet === 'album'}
        title="Salvar capturas em"
      >
        <AlbumPicker
          onSelect={(album) => {
            setStudyAlbum(album);
            setSheet(null);
          }}
          selected={captureAlbum}
        />
      </Sheet>

      {!onboardingDone && <Onboarding onFinish={() => setOnboardingDone(true)} open />}
    </CameraShell>
  );
}
