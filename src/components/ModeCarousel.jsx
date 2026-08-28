import { useLayoutEffect, useMemo, useRef } from 'react';
import { MODES } from '../data/modes.js';

const COPIES = 5;
const ACTIVE_DEFAULT = 'Foto';
const SNAP_LERP = 0.15;
const FRICTION = 0.9;
const VEL_SCALE = 2;
const MAX_VEL = 25;
const MIN_DRAG_PX = 3;

export default function ModeCarousel({ activeMode, onModeChange }) {
  const containerRef = useRef(null);
  const barRef = useRef(null);
  const stateRef = useRef({
    posX: 0,
    velX: 0,
    activeMode: ACTIVE_DEFAULT,
    rafId: null,
    dragging: false,
    dragOriginX: 0,
    dragOriginPos: 0,
    prevClientX: 0,
    prevTime: 0,
    hasMoved: false,
    snapping: false,
    snapGoal: 0
  });

  const repeatedModes = useMemo(() => {
    return Array.from({ length: COPIES }, (_, copyIndex) =>
      MODES.map((mode) => ({ mode, key: `${copyIndex}-${mode}` }))
    ).flat();
  }, []);

  useLayoutEffect(() => {
    stateRef.current.activeMode = activeMode;
  }, [activeMode]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const bar = barRef.current;
    if (!container || !bar) return undefined;

    const state = stateRef.current;
    const children = () => Array.from(bar.children);
    const cw = () => container.offsetWidth;
    const sw = () => {
      const items = children();
      return items[MODES.length]?.offsetLeft - items[0]?.offsetLeft || 0;
    };
    const setX = (x) => {
      state.posX = x;
      bar.style.transform = `translateX(${x}px)`;
    };
    const wrap = (x) => {
      const singleWidth = sw();
      if (!singleWidth) return x;
      while (x > -(singleWidth * 1)) x -= singleWidth;
      while (x < -(singleWidth * (COPIES - 2))) x += singleWidth;
      return x;
    };
    const itemAtCenter = () => {
      const center = cw() / 2 - state.posX;
      let best = null;
      let bestD = Infinity;
      children().forEach((el) => {
        const d = Math.abs((el.offsetLeft + el.offsetWidth / 2) - center);
        if (d < bestD) {
          bestD = d;
          best = el;
        }
      });
      return best;
    };
    const xForEl = (el) => cw() / 2 - el.offsetLeft - el.offsetWidth / 2;
    const closestElForMode = (mode) => {
      const center = cw() / 2 - state.posX;
      let best = null;
      let bestD = Infinity;
      children()
        .filter((el) => el.getAttribute('data-mode') === mode)
        .forEach((el) => {
          const d = Math.abs((el.offsetLeft + el.offsetWidth / 2) - center);
          if (d < bestD) {
            bestD = d;
            best = el;
          }
        });
      return best;
    };
    const updateModeSelection = (mode) => {
      if (state.activeMode === mode) return;
      state.activeMode = mode;
      onModeChange(mode);
    };
    const tick = () => {
      if (state.dragging) {
        state.rafId = window.requestAnimationFrame(tick);
        return;
      }

      if (state.snapping) {
        const diff = state.snapGoal - state.posX;
        if (Math.abs(diff) < 0.5) {
          setX(state.snapGoal);
          const wrapped = wrap(state.posX);
          if (wrapped !== state.posX) {
            setX(wrapped);
            state.snapGoal = wrapped;
          }
          state.snapping = false;
          state.rafId = null;
          return;
        }
        setX(state.posX + diff * SNAP_LERP);
        state.rafId = window.requestAnimationFrame(tick);
        return;
      }

      state.velX *= FRICTION;
      if (Math.abs(state.velX) < 0.5) {
        state.velX = 0;
        const el = itemAtCenter();
        if (el) {
          state.snapping = true;
          state.snapGoal = xForEl(el);
          updateModeSelection(el.getAttribute('data-mode'));
        }
        state.rafId = window.requestAnimationFrame(tick);
        return;
      }

      setX(wrap(state.posX + state.velX));
      const el = itemAtCenter();
      if (el) updateModeSelection(el.getAttribute('data-mode'));
      state.rafId = window.requestAnimationFrame(tick);
    };
    const startTick = () => {
      if (!state.rafId) state.rafId = window.requestAnimationFrame(tick);
    };
    const onStart = (clientX) => {
      state.dragging = true;
      state.hasMoved = false;
      state.dragOriginX = clientX;
      state.dragOriginPos = state.posX;
      state.prevClientX = clientX;
      state.prevTime = performance.now();
      state.velX = 0;
      if (state.rafId) {
        window.cancelAnimationFrame(state.rafId);
        state.rafId = null;
      }
    };
    const onMove = (clientX) => {
      if (!state.dragging) return;
      const dx = clientX - state.dragOriginX;
      if (!state.hasMoved && Math.abs(dx) < MIN_DRAG_PX) return;
      state.hasMoved = true;

      const now = performance.now();
      const dt = now - state.prevTime || 16;
      const currentVel = ((clientX - state.prevClientX) / dt) * 16;
      state.velX = (state.velX * 0.2) + (currentVel * 0.6);
      if (state.velX > MAX_VEL) state.velX = MAX_VEL;
      if (state.velX < -MAX_VEL) state.velX = -MAX_VEL;

      state.prevClientX = clientX;
      state.prevTime = now;
      setX(wrap(state.dragOriginPos + dx));

      const el = itemAtCenter();
      if (el) updateModeSelection(el.getAttribute('data-mode'));
    };
    const onEnd = () => {
      if (!state.dragging) return;
      state.dragging = false;
      if (!state.hasMoved) return;
      state.velX *= VEL_SCALE;
      if (state.velX > MAX_VEL) state.velX = MAX_VEL;
      if (state.velX < -MAX_VEL) state.velX = -MAX_VEL;
      state.snapping = false;
      startTick();
    };
    const handleMouseDown = (event) => {
      event.preventDefault();
      onStart(event.clientX);
    };
    const handleMouseMove = (event) => onMove(event.clientX);
    const handleMouseUp = () => onEnd();
    const handleTouchStart = (event) => onStart(event.touches[0].clientX);
    const handleTouchMove = (event) => onMove(event.touches[0].clientX);
    const handleTouchEnd = () => onEnd();
    const handleClick = (event) => {
      if (state.hasMoved) return;
      const el = event.target.closest('.mode-item');
      if (!el) return;
      const mode = el.getAttribute('data-mode');
      updateModeSelection(mode);
      state.snapping = true;
      state.snapGoal = xForEl(el);
      startTick();
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('click', handleClick);

    const init = () => {
      const defaultIdx = MODES.indexOf(ACTIVE_DEFAULT);
      const targetEl = bar.children[2 * MODES.length + defaultIdx];
      if (targetEl) setX(wrap(xForEl(targetEl)));
      updateModeSelection(ACTIVE_DEFAULT);
    };

    const rafA = window.requestAnimationFrame(() => {
      const rafB = window.requestAnimationFrame(init);
      state.initRafB = rafB;
    });
    state.initRafA = rafA;

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('click', handleClick);
      if (state.rafId) window.cancelAnimationFrame(state.rafId);
      if (state.initRafA) window.cancelAnimationFrame(state.initRafA);
      if (state.initRafB) window.cancelAnimationFrame(state.initRafB);
    };
  }, [onModeChange]);

  return (
    <div className="mode-bar-container" ref={containerRef}>
      <div className="mode-bar" id="mode-bar" ref={barRef}>
        {repeatedModes.map(({ mode, key }) => (
          <span className={`mode-item ${activeMode === mode ? 'active' : ''}`} data-mode={mode} key={key}>
            {mode}
          </span>
        ))}
      </div>
    </div>
  );
}
