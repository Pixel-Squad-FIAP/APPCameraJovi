// Preferências do usuário salvas no localStorage, com assinatura para que
// todos os componentes que usam a mesma preferência fiquem sincronizados.

import { DEFAULT_ALBUMS, DEFAULT_MODE } from '../data/modes.js';

const STORAGE_KEY = 'jovi.preferences';

export const DEFAULT_PREFERENCES = {
  lastMode: DEFAULT_MODE,
  facingMode: 'environment',
  ratio: '3:4',
  timer: 0,
  grid: false,
  smartHints: true,
  mirrorFront: true,
  onboardingDone: false,
  studyAlbum: 'Aulas',
  albums: DEFAULT_ALBUMS
};

const listeners = new Set();
let cache = null;

function read() {
  if (cache) return cache;
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    cache = { ...DEFAULT_PREFERENCES, ...(stored && typeof stored === 'object' ? stored : {}) };
  } catch {
    cache = { ...DEFAULT_PREFERENCES };
  }
  return cache;
}

export function getPreferences() {
  return read();
}

export function setPreference(key, value) {
  const current = read();
  const nextValue = typeof value === 'function' ? value(current[key]) : value;
  if (Object.is(current[key], nextValue)) return;
  cache = { ...current, [key]: nextValue };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // armazenamento cheio ou bloqueado: mantém a preferência apenas na sessão
  }
  listeners.forEach((listener) => listener());
}

export function subscribePreferences(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
