import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clampZoom,
  SMOOTHING_GESTURE_MS,
  SMOOTHING_PRESET_MS,
  smoothStep,
  splitZoom,
  ZOOM_PRESETS,
  zoomFromWheel
} from '../lib/zoom.js';

const DISPLAY_STEP = 0.05;
const ADJUSTING_HIDE_DELAY = 1200;

function vibrate() {
  try {
    navigator.vibrate?.(8);
  } catch {
    // vibração indisponível
  }
}

// Zoom contínuo e animado. Gestos e botões só definem o alvo; um laço de animação
// aproxima o valor atual suavemente e escreve a variável CSS --zoom direto no quadro
// do visor (sem re-render do React a cada quadro). Em aparelhos que permitem (Android),
// parte do zoom é feita pelo próprio sensor e só o restante é ampliado por software.
export function useZoom({ frameRef, streamRef, ready, facingMode }) {
  const [zoom, setZoomState] = useState(1);
  const [adjusting, setAdjusting] = useState(false);
  const targetRef = useRef(1);
  const currentRef = useRef(1);
  const displayedRef = useRef(1);
  const digitalRef = useRef(1);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);
  const hideTimerRef = useRef(null);
  const gestureStartRef = useRef(1);
  const smoothingRef = useRef(SMOOTHING_PRESET_MS);
  const hardwareRef = useRef({ supported: false, min: 1, max: 1, applied: 1, wanted: 1, pending: false });

  const applyToElement = useCallback((value) => {
    const hardware = hardwareRef.current;
    const digital = splitZoom(value, hardware.supported ? hardware.applied : 1);
    digitalRef.current = digital;
    frameRef.current?.style.setProperty('--zoom', digital.toFixed(4));
  }, [frameRef]);

  // Zoom do sensor: uma chamada por vez; se o alvo mudar no meio, aplica o mais recente.
  const requestHardwareZoom = useCallback((value) => {
    const hardware = hardwareRef.current;
    if (!hardware.supported) return;
    hardware.wanted = Math.min(hardware.max, Math.max(hardware.min, value));
    if (hardware.pending) return;

    hardware.pending = true;
    (async () => {
      let lastAttempt = null;
      while (hardware.supported && Math.abs(hardware.wanted - hardware.applied) > 0.02) {
        const wanted = hardware.wanted;
        // o sensor pode arredondar o valor (passos fixos); não repete o mesmo pedido
        if (wanted === lastAttempt) break;
        lastAttempt = wanted;
        const [track] = streamRef.current?.getVideoTracks() ?? [];
        if (!track) break;
        try {
          await track.applyConstraints({ advanced: [{ zoom: wanted }] });
          hardware.applied = track.getSettings?.().zoom ?? wanted;
        } catch {
          hardware.supported = false;
          hardware.applied = 1;
        }
        applyToElement(currentRef.current);
      }
      hardware.pending = false;
    })();
  }, [applyToElement, streamRef]);

  const tick = useCallback((time) => {
    const deltaMs = lastTimeRef.current ? time - lastTimeRef.current : 16;
    lastTimeRef.current = time;
    const previous = currentRef.current;
    const next = smoothStep(previous, targetRef.current, deltaMs, smoothingRef.current);
    currentRef.current = next;
    applyToElement(next);
    requestHardwareZoom(next);

    // Vibração curta ao passar por 1x, 2x ou 5x.
    if (ZOOM_PRESETS.some((preset) => (previous < preset && next >= preset) || (previous > preset && next <= preset))) {
      vibrate();
    }

    if (Math.abs(next - displayedRef.current) >= DISPLAY_STEP || next === targetRef.current) {
      displayedRef.current = next;
      setZoomState(next);
    }

    if (next !== targetRef.current) {
      rafRef.current = window.requestAnimationFrame(tick);
    } else {
      rafRef.current = null;
      lastTimeRef.current = 0;
    }
  }, [applyToElement, requestHardwareZoom]);

  const startAnimation = useCallback(() => {
    if (!rafRef.current) rafRef.current = window.requestAnimationFrame(tick);
  }, [tick]);

  const showAdjusting = useCallback((autoHide = true) => {
    window.clearTimeout(hideTimerRef.current);
    setAdjusting(true);
    if (autoHide) hideTimerRef.current = window.setTimeout(() => setAdjusting(false), ADJUSTING_HIDE_DELAY);
  }, []);

  const setTarget = useCallback((value) => {
    targetRef.current = clampZoom(value);
    startAnimation();
  }, [startAnimation]);

  const selectPreset = useCallback((preset) => {
    smoothingRef.current = SMOOTHING_PRESET_MS;
    setTarget(preset);
    showAdjusting();
  }, [setTarget, showAdjusting]);

  // Gestos (arrastar/pinça): o valor inicial é guardado e o gesto calcula o novo alvo a partir dele.
  const beginGesture = useCallback(() => {
    gestureStartRef.current = targetRef.current;
    smoothingRef.current = SMOOTHING_GESTURE_MS;
    showAdjusting(false);
    return gestureStartRef.current;
  }, [showAdjusting]);

  const endGesture = useCallback(() => showAdjusting(), [showAdjusting]);

  const nudge = useCallback((deltaY) => {
    smoothingRef.current = SMOOTHING_PRESET_MS;
    setTarget(zoomFromWheel(targetRef.current, deltaY));
    showAdjusting();
  }, [setTarget, showAdjusting]);

  const reset = useCallback(() => {
    window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTimeRef.current = 0;
    targetRef.current = 1;
    currentRef.current = 1;
    displayedRef.current = 1;
    setZoomState(1);
    applyToElement(1);
  }, [applyToElement]);

  const getDigitalZoom = useCallback(() => digitalRef.current, []);

  // Ao virar a câmera, o zoom volta a 1x (como nos celulares).
  useEffect(() => {
    reset();
  }, [facingMode, reset]);

  // Lê se o sensor da câmera atual aceita zoom real.
  useEffect(() => {
    if (!ready) return;
    const [track] = streamRef.current?.getVideoTracks() ?? [];
    const range = track?.getCapabilities?.().zoom;
    const supported = Boolean(range && range.max > range.min && range.max > 1);
    hardwareRef.current = {
      supported,
      min: supported ? Math.max(1, range.min) : 1,
      max: supported ? range.max : 1,
      applied: supported ? track.getSettings?.().zoom ?? 1 : 1,
      wanted: 1,
      pending: false
    };
    applyToElement(currentRef.current);
    if (supported) requestHardwareZoom(currentRef.current);
  }, [ready, facingMode, streamRef, applyToElement, requestHardwareZoom]);

  useEffect(() => () => {
    window.cancelAnimationFrame(rafRef.current);
    window.clearTimeout(hideTimerRef.current);
  }, []);

  return { zoom, adjusting, setTarget, selectPreset, beginGesture, endGesture, nudge, reset, getDigitalZoom };
}
