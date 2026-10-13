import { useEffect, useRef } from 'react';
import { focusRing } from '../ui/Button.jsx';

export default function ModeSelector({ activeMode, disabled, modes, onChange }) {
  const listRef = useRef(null);

  useEffect(() => {
    const active = listRef.current?.querySelector('[aria-checked="true"]');
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeMode]);

  const handleKeyDown = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const index = modes.findIndex((mode) => mode.id === activeMode);
    const next = modes[index + (event.key === 'ArrowRight' ? 1 : -1)];
    if (next) {
      onChange(next.id);
      listRef.current?.querySelector(`[data-mode="${next.id}"]`)?.focus();
    }
  };

  return (
    <div
      aria-label="Modos da câmera"
      className="scrollbar-none flex snap-x snap-mandatory gap-1 overflow-x-auto px-[calc(50%-3rem)] py-1 [mask-image:linear-gradient(90deg,transparent,black_18%,black_82%,transparent)]"
      onKeyDown={handleKeyDown}
      ref={listRef}
      role="radiogroup"
    >
      {modes.map((mode) => {
        const active = mode.id === activeMode;
        return (
          <button
            aria-checked={active}
            className={`shrink-0 snap-center rounded-full px-3.5 py-2 text-[13px] font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed ${active ? 'bg-white/12 text-amber-300' : 'text-white/70 hover:text-white'} ${focusRing}`}
            data-mode={mode.id}
            disabled={disabled && !active}
            key={mode.id}
            onClick={() => onChange(mode.id)}
            role="radio"
            tabIndex={active ? 0 : -1}
            type="button"
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
