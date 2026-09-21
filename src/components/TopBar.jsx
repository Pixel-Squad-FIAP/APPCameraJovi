export default function TopBar({
  activeMode,
  flashDisabled = false,
  flashOff,
  moreModesOpen,
  onFlashToggle,
  onRatioClick,
  onSettingsClick,
  onTimerClick,
  ratio,
  ratioHidden = false,
  timerState
}) {
  return (
    <div className="top-bar">
      <button
        className={`icon-flash ${flashOff ? 'is-off' : ''}`}
        disabled={flashDisabled}
        id="btn-flash"
        onClick={onFlashToggle}
        aria-label="Flash"
        title={flashDisabled ? 'Flash indisponível neste dispositivo' : 'Flash'}
      >
        <svg width="16" height="22" viewBox="0 0 16 22">
          <polyline points="10,1 3,12 8,12 6,21 13,10 8,10 10,1" stroke="white" strokeWidth="1.6" fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <line id="flash-strike" x1="2" y1="2" x2="14" y2="20" stroke="white" strokeWidth="1.6" strokeLinecap="round" style={{ display: flashOff ? 'block' : 'none' }} />
        </svg>
      </button>

      <button className="icon-timer" id="btn-timer" onClick={onTimerClick} aria-label="Timer">
        <svg width="24" height="24" viewBox="0 0 22 22">
          <circle cx="11" cy="12" r="8" stroke="white" strokeWidth="1.6" />
          <line x1="11" y1="8" x2="11" y2="12" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="11" y1="12" x2="14" y2="14" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="6" y1="3" x2="3" y2="6" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="16" y1="3" x2="19" y2="6" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          <line id="timer-strike" x1="4" y1="4" x2="18" y2="18" stroke="white" strokeWidth="1.6" strokeLinecap="round" style={{ display: timerState === 'none' ? 'block' : 'none' }} />
        </svg>
        <span id="timer-label" className="timer-text">{timerState === 'none' ? '' : timerState}</span>
      </button>

      <div className="mode-pill" id="top-mode-pill">{activeMode}</div>

      <button
        className="ratio"
        hidden={ratioHidden}
        id="btn-ratio"
        onClick={onRatioClick}
        aria-label="Proporção"
      >
        {ratio}
      </button>

      <button
        className="icon-grid"
        id="btn-settings"
        onClick={onSettingsClick}
        aria-label="Adicionar modos"
        style={{ transform: moreModesOpen ? 'rotate(45deg)' : '', transition: 'transform 0.3s ease' }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20">
          <rect x="1" y="1" width="7" height="7" rx="1.5" stroke="white" strokeWidth="1.5" fill="none" />
          <rect x="12" y="1" width="7" height="7" rx="1.5" stroke="white" strokeWidth="1.5" fill="none" />
          <rect x="1" y="12" width="7" height="7" rx="1.5" stroke="white" strokeWidth="1.5" fill="none" />
          <rect x="12" y="12" width="7" height="7" rx="1.5" stroke="white" strokeWidth="1.5" fill="none" />
        </svg>
      </button>
    </div>
  );
}
