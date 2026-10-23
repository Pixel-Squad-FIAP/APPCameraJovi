// Cálculos do zoom da câmera. Escala logarítmica: o mesmo gesto dobra o zoom
// tanto em 1x quanto em 4x, como nas câmeras de celular.

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;
export const ZOOM_PRESETS = [1, 2, 5];

const DRAG_PIXELS_PER_DOUBLING = 180;
const WHEEL_UNITS_PER_DOUBLING = 600;
// Constante de tempo da suavização: maior = transição mais lenta.
export const SMOOTHING_PRESET_MS = 110; // atalhos 1x/2x/5x e roda do mouse
export const SMOOTHING_GESTURE_MS = 45; // arrastar/pinça: segue o dedo quase sem atraso

export function clampZoom(zoom) {
  if (!Number.isFinite(zoom)) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

// Arrastar para cima (deltaY negativo) aproxima; para baixo afasta.
export function zoomFromDrag(startZoom, deltaY) {
  return clampZoom(startZoom * 2 ** (-deltaY / DRAG_PIXELS_PER_DOUBLING));
}

export function zoomFromPinch(startZoom, startDistance, distance) {
  if (!startDistance) return clampZoom(startZoom);
  return clampZoom(startZoom * (distance / startDistance));
}

export function zoomFromWheel(currentZoom, deltaY) {
  return clampZoom(currentZoom * 2 ** (-deltaY / WHEEL_UNITS_PER_DOUBLING));
}

// Aproximação exponencial do valor atual até o alvo (independe da taxa de quadros).
export function smoothStep(current, target, deltaMs, timeConstantMs = SMOOTHING_PRESET_MS) {
  const factor = 1 - Math.exp(-Math.max(0, deltaMs) / timeConstantMs);
  const next = current + (target - current) * factor;
  return Math.abs(target - next) < 0.002 ? target : next;
}

export function formatZoom(zoom) {
  const rounded = Math.round(zoom * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1).replace('.', ',')}x`;
}

// Preset que representa o zoom atual: o maior que não ultrapassa o valor.
export function activePreset(zoom) {
  return [...ZOOM_PRESETS].reverse().find((preset) => zoom >= preset - 0.05) ?? ZOOM_PRESETS[0];
}

// Parte do zoom que precisa ser feita por software depois do zoom do sensor.
export function splitZoom(totalZoom, hardwareZoom = 1) {
  return Math.max(1, totalZoom / Math.max(1, hardwareZoom || 1));
}

// Posição (0–1) de um valor de zoom na régua logarítmica.
export function zoomToRulerPosition(zoom) {
  return Math.log(clampZoom(zoom) / MIN_ZOOM) / Math.log(MAX_ZOOM / MIN_ZOOM);
}
