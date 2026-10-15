import { useEffect, useRef, useState } from 'react';
import { ZOOM_OPTIONS } from '../../data/modes.js';
import { formatDuration } from '../../lib/format.js';
import { useElementSize } from '../../hooks/useElementSize.js';
import { computeViewfinderLayout, exposureToBrightness, guideRectPercent } from '../../lib/imageProcessing.js';
import { focusRing } from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';

const SWIPE_DISTANCE = 50;
const CONTROLS_TIMEOUT = 3000;

const SUGGESTION_TEXT = {
  lowLight: { icon: 'moon', text: 'Pouca luz', action: 'Usar Noite' },
  document: { icon: 'file', text: 'Documento detectado', action: 'Usar Documento' }
};

function GuideFrame({ aligned, aspect, guide }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute rounded-xl border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.38)] transition-colors duration-300 ${aligned ? 'border-emerald-400' : 'border-white/85'}`}
      style={guideRectPercent(aspect, guide)}
    >
      <span className={`absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${aligned ? 'bg-emerald-400 text-ink-900' : 'bg-black/55 text-white'}`}>
        {aligned ? 'Enquadrado — pode capturar' : guide.label}
      </span>
    </div>
  );
}

export default function Viewfinder({
  aspect,
  captureFlashKey,
  children,
  countdown,
  docAligned,
  elapsed,
  exposure,
  grid,
  insetBottom,
  insetTop,
  isRecording,
  mirror,
  mode,
  onAcceptSuggestion,
  onDismissSuggestion,
  onExposureChange,
  onSwipeMode,
  onZoomChange,
  processingLabel,
  ready,
  suggestion,
  videoRef,
  zoom
}) {
  const [focusPoint, setFocusPoint] = useState(null);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [hintVisible, setHintVisible] = useState(Boolean(mode.hint));
  const pointerStartRef = useRef(null);
  const hideTimerRef = useRef(null);
  const containerRef = useRef(null);
  const container = useElementSize(containerRef);
  const layout = computeViewfinderLayout({ width: container.width, height: container.height, aspect, insetTop, insetBottom });

  useEffect(() => {
    if (!mode.hint) {
      setHintVisible(false);
      return undefined;
    }
    setHintVisible(true);
    const timeoutId = window.setTimeout(() => setHintVisible(false), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [mode.id, mode.hint]);

  useEffect(() => () => window.clearTimeout(hideTimerRef.current), []);

  const keepControlsVisible = () => {
    setControlsVisible(true);
    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
      setFocusPoint(null);
    }, CONTROLS_TIMEOUT);
  };

  const handlePointerDown = (event) => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start || !ready) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;

    if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) {
      onSwipeMode(dx < 0 ? 1 : -1);
      return;
    }
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && !mode.isVideo) {
      const rect = event.currentTarget.getBoundingClientRect();
      setFocusPoint({ x: event.clientX - rect.left, y: event.clientY - rect.top, key: Date.now() });
      keepControlsVisible();
    }
  };

  const suggestionContent = suggestion ? SUGGESTION_TEXT[suggestion.type] : null;

  return (
    <div className="absolute inset-0 z-0 overflow-hidden" ref={containerRef}>
      <div
        className={`absolute touch-pan-y overflow-hidden bg-ink-850 select-none ${container.width ? 'transition-[top,left,width,height] duration-300 ease-out' : 'opacity-0'}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        style={{ top: layout.top, left: layout.left, width: layout.width, height: layout.height }}
      >
        <video
          aria-label="Visualização da câmera"
          autoPlay
          className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`}
          muted
          playsInline
          ref={videoRef}
          style={{
            transform: `scale(${zoom})${mirror ? ' scaleX(-1)' : ''}`,
            filter: exposure ? `brightness(${exposureToBrightness(exposure)})` : undefined
          }}
        />

        {ready && mode.processing === 'portrait' && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 backdrop-blur-[6px] [mask-image:radial-gradient(ellipse_55%_50%_at_50%_45%,transparent_45%,black_100%)]"
          />
        )}

        {ready && grid && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }, (_, index) => (
              <span className={`border-white/25 ${index % 3 !== 2 ? 'border-r' : ''} ${index < 6 ? 'border-b' : ''}`} key={index} />
            ))}
          </div>
        )}

        {ready && mode.guide && <GuideFrame aligned={docAligned} aspect={aspect} guide={mode.guide} />}

        {focusPoint && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute size-16 animate-focus-ring rounded-lg border-2 border-amber-300"
            key={focusPoint.key}
            style={{ left: focusPoint.x, top: focusPoint.y, transform: 'translate(-50%, -50%)' }}
          />
        )}

        <div className="pointer-events-none absolute inset-x-0 top-3 flex flex-col items-center gap-2 px-3">
          {isRecording && (
            <span className="flex items-center gap-2 rounded-full bg-red-500/90 px-3 py-1 text-sm font-semibold tabular-nums">
              <span className="size-2 animate-pulse rounded-full bg-white" />
              {formatDuration(elapsed)}
            </span>
          )}

          {suggestionContent && !isRecording && (
            <div className="pointer-events-auto flex animate-sheet-in items-center gap-2 rounded-full bg-black/70 py-1.5 pl-3 pr-1.5 text-sm shadow-lg backdrop-blur" role="status">
              <Icon className="text-amber-300" name={suggestionContent.icon} size={16} />
              <span>{suggestionContent.text}</span>
              <button className={`rounded-full bg-white px-3 py-1 text-xs font-bold text-ink-900 ${focusRing}`} onClick={onAcceptSuggestion} type="button">{suggestionContent.action}</button>
              <button aria-label="Ignorar sugestão" className={`grid size-7 place-items-center rounded-full text-white/70 hover:bg-white/10 ${focusRing}`} onClick={onDismissSuggestion} type="button">
                <Icon name="close" size={14} />
              </button>
            </div>
          )}

        </div>

        {countdown > 0 && (
          <span aria-live="assertive" className="pointer-events-none absolute inset-0 grid place-items-center text-8xl font-bold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]" key={countdown}>
            <span className="animate-pop">{countdown}</span>
          </span>
        )}

        {processingLabel && (
          <span className="pointer-events-none absolute inset-x-0 top-14 mx-auto w-max rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold">
            {processingLabel}
          </span>
        )}

        {captureFlashKey > 0 && <span aria-hidden="true" className="pointer-events-none absolute inset-0 animate-flash bg-white opacity-0" key={captureFlashKey} />}

        {children}
      </div>

      {ready && (
        <div className="pointer-events-none absolute inset-x-0 z-10 flex flex-col items-center gap-2 transition-[bottom] duration-300 ease-out" style={{ bottom: layout.controlsBottom }}>
          {hintVisible && !suggestionContent && !isRecording && !controlsVisible && (
            <span className="animate-fade-in rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white/90">{mode.hint}</span>
          )}
          {controlsVisible && !mode.isVideo && (
            <label
              className="pointer-events-auto flex animate-fade-in items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
            >
              <Icon className="text-amber-300" name="sparkles" size={14} />
              <span className="sr-only">Exposição</span>
              <input
                aria-valuetext={`Exposição ${exposure > 0 ? '+' : ''}${exposure.toFixed(1)}`}
                className="h-1 w-32 accent-amber-300"
                max="1"
                min="-1"
                onChange={(event) => {
                  onExposureChange(Number(event.target.value));
                  keepControlsVisible();
                }}
                step="0.1"
                type="range"
                value={exposure}
              />
              <span className="w-8 text-right text-xs tabular-nums text-white/80">{exposure > 0 ? '+' : ''}{exposure.toFixed(1)}</span>
            </label>
          )}
          <div
            className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/45 p-1 backdrop-blur"
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            role="group"
            aria-label="Zoom digital"
          >
            {ZOOM_OPTIONS.map((level) => (
              <button
                aria-pressed={zoom === level}
                className={`grid size-9 place-items-center rounded-full text-xs font-bold transition-colors ${zoom === level ? 'bg-white/20 text-amber-300' : 'text-white/85 hover:bg-white/10'} ${focusRing}`}
                key={level}
                onClick={() => onZoomChange(level)}
                type="button"
              >
                {level}x
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
