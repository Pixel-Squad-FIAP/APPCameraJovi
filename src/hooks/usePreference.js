import { useCallback, useSyncExternalStore } from 'react';
import { DEFAULT_ALBUM } from '../data/modes.js';
import { getPreferences, setPreference, subscribePreferences } from '../services/preferences.js';

export function usePreference(key) {
  const value = useSyncExternalStore(subscribePreferences, () => getPreferences()[key]);
  const update = useCallback((next) => setPreference(key, next), [key]);
  return [value, update];
}

const MAX_ALBUM_NAME = 30;

// Álbuns = matérias/categorias criadas pelo estudante.
export function useAlbums() {
  const [albums, setAlbums] = usePreference('albums');

  const addAlbum = useCallback((rawName) => {
    const name = rawName.trim().replace(/\s+/g, ' ');
    if (!name) return { ok: false, error: 'Digite um nome para o álbum.' };
    if (name.length > MAX_ALBUM_NAME) return { ok: false, error: `Use no máximo ${MAX_ALBUM_NAME} caracteres.` };
    const existing = albums.find((album) => album.toLowerCase() === name.toLowerCase());
    if (existing) return { ok: true, name: existing, existed: true };
    setAlbums((current) => [...current, name]);
    return { ok: true, name };
  }, [albums, setAlbums]);

  return { albums: albums?.length ? albums : [DEFAULT_ALBUM], addAlbum };
}
