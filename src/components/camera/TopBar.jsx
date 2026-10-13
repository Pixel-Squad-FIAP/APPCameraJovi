import { focusRing, IconButton } from '../ui/Button.jsx';

export default function TopBar({
  disabled,
  flashLabel,
  flashOn,
  grid,
  onFlashToggle,
  onGridToggle,
  onHelp,
  onMenu,
  onRatioChange,
  onTimerChange,
  ratio,
  showRatio,
  showTimer,
  timer
}) {
  return (
    <div className="relative z-20 flex h-14 shrink-0 items-center justify-between px-2 pt-[env(safe-area-inset-top)] md:pt-2">
      <div className="flex items-center">
        <IconButton
          active={flashOn}
          aria-pressed={flashOn}
          disabled={disabled}
          icon={flashOn ? 'flash' : 'flashOff'}
          label={`${flashLabel}: ${flashOn ? 'ligado' : 'desligado'}`}
          onClick={onFlashToggle}
        />
        {showTimer && (
          <button
            aria-label={`Temporizador: ${timer ? `${timer} segundos` : 'desligado'}`}
            className={`inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2 text-sm font-semibold transition-colors disabled:opacity-35 ${timer ? 'bg-white/15 text-jovi-300' : 'text-white hover:bg-white/10'} ${focusRing}`}
            disabled={disabled}
            onClick={onTimerChange}
            title="Temporizador"
            type="button"
          >
            <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 24 24" width="22">
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l2.5 2M9 2h6" />
            </svg>
            {timer > 0 && <span>{timer}s</span>}
          </button>
        )}
        <IconButton active={grid} aria-pressed={grid} disabled={disabled} icon="grid" label="Grade de enquadramento" onClick={onGridToggle} />
      </div>

      <div className="flex items-center">
        {showRatio && (
          <button
            aria-label={`Proporção ${ratio}. Toque para alterar`}
            className={`h-8 min-w-12 rounded-full border border-white/30 px-2 text-xs font-bold tabular-nums text-white transition-colors hover:border-white/60 disabled:opacity-35 ${focusRing}`}
            disabled={disabled}
            onClick={onRatioChange}
            title="Proporção"
            type="button"
          >
            {ratio}
          </button>
        )}
        <IconButton disabled={disabled} icon="help" label="Ajuda e modos" onClick={onHelp} />
        <IconButton disabled={disabled} icon="menu" label="Ajustes" onClick={onMenu} />
      </div>
    </div>
  );
}
