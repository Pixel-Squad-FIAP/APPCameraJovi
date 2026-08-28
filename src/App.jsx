import { useCallback, useEffect, useRef, useState } from 'react';
import BottomControls from './components/BottomControls.jsx';
import Gallery from './components/Gallery.jsx';
import MoreModesOverlay from './components/MoreModesOverlay.jsx';
import SettingsOverlay from './components/SettingsOverlay.jsx';
import StudentMode from './components/StudentMode.jsx';
import TopBar from './components/TopBar.jsx';
import Viewfinder from './components/Viewfinder.jsx';
import { RATIO_STATES, TIMER_STATES } from './data/modes.js';

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

export default function App() {
  const [activeMode, setActiveMode] = useState('Foto');
  const [flashOff, setFlashOff] = useState(false);
  const [timerIndex, setTimerIndex] = useState(0);
  const [ratioIndex, setRatioIndex] = useState(0);
  const [moreModesOpen, setMoreModesOpen] = useState(false);
  const [notification, setNotification] = useState('');
  const [visitedModes, setVisitedModes] = useState(() => new Set());
  const [shutterRequestId, setShutterRequestId] = useState(0);
  const [flipRequestId, setFlipRequestId] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [studentOverlay, setStudentOverlay] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const notificationTimeoutRef = useRef(null);

  const ratio = RATIO_STATES[ratioIndex];
  const timerState = TIMER_STATES[timerIndex];

  const showNotification = useCallback((message) => {
    window.clearTimeout(notificationTimeoutRef.current);
    setNotification(message);
    notificationTimeoutRef.current = window.setTimeout(() => {
      setNotification('');
      notificationTimeoutRef.current = null;
    }, 2000);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(notificationTimeoutRef.current);
  }, []);

  const handleModeChange = useCallback((mode) => {
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
  }, [showNotification, visitedModes]);

  const handleTimerClick = () => {
    setTimerIndex((current) => (current + 1) % TIMER_STATES.length);
  };

  const handleRatioClick = () => {
    setRatioIndex((current) => (current + 1) % RATIO_STATES.length);
  };

  return (
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
          flashOff={flashOff}
          notification={notification}
          onStudentOverlayOpen={setStudentOverlay}
          ratio={ratio}
          shutterRequestId={shutterRequestId}
          showNotification={showNotification}
          timerState={timerState}
          flipRequestId={flipRequestId}
          onFlippedChange={setFlipped}
          onRecordingChange={setIsRecording}
          viewfinderHeight={viewfinderHeightByRatio[ratio]}
        />

        <BottomControls
          activeMode={activeMode}
          flipped={flipped}
          isRecording={isRecording}
          onGalleryOpen={() => setGalleryOpen(true)}
          onModeChange={handleModeChange}
          onFlip={() => setFlipRequestId((current) => current + 1)}
          onShutter={() => setShutterRequestId((current) => current + 1)}
        />

        <Gallery isOpen={galleryOpen} onClose={() => setGalleryOpen(false)} />

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
  );
}
