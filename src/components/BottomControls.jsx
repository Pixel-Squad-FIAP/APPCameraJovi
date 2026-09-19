import ModeCarousel from './ModeCarousel.jsx';

export default function BottomControls({ activeMode, flipDisabled = false, flipped, isRecording, onFlip, onGalleryOpen, onModeChange, onShutter }) {
  return (
    <div className="bottom-controls">
      <div className="controls-row">
        <button className="btn-gallery" aria-label="Galeria" onClick={onGalleryOpen} />

        <div className="shutter-wrapper">
          <div className="shutter-ring" style={{ borderColor: isRecording ? 'rgba(255,59,48,0.3)' : '' }} />
          <button
            className="shutter-btn"
            id="shutter-btn"
            aria-label="Tirar foto"
            onClick={onShutter}
            style={{
              backgroundColor: activeMode === 'Vídeo' ? '#ff3b30' : '',
              borderRadius: isRecording ? '14px' : '',
              transform: isRecording ? 'scale(0.72)' : ''
            }}
          />
        </div>

        <button
          className={`btn-flip ${flipped ? 'rotated' : ''}`}
          aria-label="Virar câmera"
          disabled={flipDisabled}
          onClick={onFlip}
        >
          <svg width="22" height="18" viewBox="0 0 22 18">
            <path d="M2 9 C2 4.6 5.6 1 10 1 L18 1" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="15,1 18,1 18,4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20 9 C20 13.4 16.4 17 12 17 L4 17" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="7,17 4,17 4,14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <ModeCarousel activeMode={activeMode} onModeChange={onModeChange} />
    </div>
  );
}
