import { activePreset, formatZoom, ZOOM_PRESETS, zoomToRulerPosition } from '../../lib/zoom.js';
import { focusRing } from '../ui/Button.jsx';

const RULER_TICKS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

// Atalhos de zoom + régua que aparece enquanto o usuário ajusta o zoom.
export default function ZoomControl({ adjusting, onSelect, zoom }) {
  const current = activePreset(zoom);
  const position = zoomToRulerPosition(zoom) * 100;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        aria-hidden="true"
        className={`flex flex-col items-center gap-1 transition-all duration-300 ease-out ${adjusting ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'}`}
      >
        <span className="rounded-full bg-black/55 px-2.5 py-0.5 text-sm font-bold tabular-nums text-amber-300 backdrop-blur">
          {formatZoom(zoom)}
        </span>
        <div className="relative h-7 w-56 rounded-full bg-black/45 backdrop-blur">
          <div className="absolute inset-x-4 inset-y-0">
            {RULER_TICKS.map((tick) => {
              const isPreset = ZOOM_PRESETS.includes(tick);
              return (
                <span
                  className={`absolute top-1/2 w-px -translate-y-1/2 ${isPreset ? 'h-3.5 bg-white/80' : 'h-2 bg-white/40'}`}
                  key={tick}
                  style={{ left: `${zoomToRulerPosition(tick) * 100}%` }}
                />
              );
            })}
            <span
              className="absolute top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.8)]"
              style={{ left: `${position}%` }}
            />
          </div>
        </div>
      </div>

      <div aria-label="Zoom" className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/45 p-1 backdrop-blur" role="group">
        {ZOOM_PRESETS.map((preset) => {
          const active = preset === current;
          return (
            <button
              aria-label={active ? `Zoom atual ${formatZoom(zoom)}. Toque para ${preset}x` : `Zoom ${preset}x`}
              aria-pressed={active}
              className={`grid h-9 place-items-center rounded-full text-xs font-bold tabular-nums transition-all duration-200 ease-out ${active ? 'min-w-12 bg-white/20 px-2 text-amber-300' : 'min-w-9 text-white/85 hover:bg-white/10'} ${focusRing}`}
              key={preset}
              onClick={() => onSelect(preset)}
              type="button"
            >
              {active ? formatZoom(zoom) : `${preset}x`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
