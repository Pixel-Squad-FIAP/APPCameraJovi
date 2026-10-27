import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_ALBUM, getMode } from '../data/modes.js';
import { useOcrQueue } from '../hooks/useOcrQueue.js';
import { createId, formatDateTime } from '../lib/format.js';
import {
  deleteCaptureRecord,
  listCaptures,
  saveCapture,
  updateCaptureRecord
} from '../services/captureStore.js';
import { forgetDeleted, rememberDeleted } from '../services/libraryTransfer.js';

const LibraryContext = createContext(null);

const byNewest = (a, b) => b.createdAt.localeCompare(a.createdAt);

export function LibraryProvider({ children }) {
  const [captures, setCapturesState] = useState([]);
  const [status, setStatus] = useState('loading');
  const capturesRef = useRef([]);

  const setCaptures = useCallback((updater) => {
    capturesRef.current = typeof updater === 'function' ? updater(capturesRef.current) : updater;
    setCapturesState(capturesRef.current);
  }, []);

  useEffect(() => {
    let active = true;
    listCaptures()
      .then((items) => {
        if (!active) return;
        // OCR interrompido por recarregar a página volta a ficar disponível para nova tentativa.
        setCaptures(items.map((item) => (item.ocrStatus === 'processing' ? { ...item, ocrStatus: 'idle' } : item)));
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [setCaptures]);

  const addCapture = useCallback(async ({ kind = 'photo', modeId, album, mediaBlob, thumbBlob, width, height, duration }) => {
    const mode = getMode(modeId);
    const createdAt = new Date().toISOString();
    const capture = {
      id: createId(),
      createdAt,
      updatedAt: createdAt,
      kind,
      mode: mode.id,
      album: album || DEFAULT_ALBUM,
      title: `${mode.label} · ${formatDateTime(createdAt)}`,
      titleAuto: true,
      mimeType: mediaBlob.type,
      size: mediaBlob.size,
      thumbBlob,
      width,
      height,
      duration: duration ?? null,
      text: '',
      ocrStatus: 'idle',
      ocrConfidence: null,
      ocrError: null,
      summary: null,
      notes: ''
    };
    await saveCapture(capture, mediaBlob);
    setCaptures((current) => [capture, ...current]);
    return capture;
  }, [setCaptures]);

  const updateCapture = useCallback(async (id, patch) => {
    const current = capturesRef.current.find((capture) => capture.id === id);
    if (!current) return null;
    const changes = typeof patch === 'function' ? patch(current) : patch;
    const next = { ...current, ...changes, updatedAt: new Date().toISOString() };
    setCaptures((items) => items.map((capture) => (capture.id === id ? next : capture)));
    await updateCaptureRecord(next);
    return next;
  }, [setCaptures]);

  const removeCapture = useCallback(async (id) => {
    const capture = capturesRef.current.find((item) => item.id === id);
    if (!capture) return null;
    const media = await deleteCaptureRecord(id);
    rememberDeleted(id);
    setCaptures((items) => items.filter((item) => item.id !== id));
    return { capture, media };
  }, [setCaptures]);

  const restoreCapture = useCallback(async ({ capture, media }) => {
    await saveCapture(capture, media);
    forgetDeleted(capture.id);
    setCaptures((items) => [...items, capture].sort(byNewest));
  }, [setCaptures]);

  // Aplica uma sincronização com o JOVI Desktop. As alterações mantêm o updatedAt de origem
  // para que a próxima sincronização não as trate como novas edições.
  const importCaptures = useCallback(async ({ created = [], updated = [] }) => {
    const changesById = new Map(updated.map(({ id, changes }) => [id, changes]));
    const next = capturesRef.current.map((capture) => (changesById.has(capture.id) ? { ...capture, ...changesById.get(capture.id) } : capture));
    await Promise.all([
      ...created.map(({ capture, media }) => saveCapture(capture, media)),
      ...next.filter((capture) => changesById.has(capture.id)).map(updateCaptureRecord)
    ]);
    setCaptures([...next, ...created.map(({ capture }) => capture)].sort(byNewest));
  }, [setCaptures]);

  const { ocrJobs, startOcr, cancelOcr } = useOcrQueue(updateCapture);

  const value = useMemo(() => ({
    captures,
    status,
    addCapture,
    updateCapture,
    removeCapture,
    restoreCapture,
    importCaptures,
    ocrJobs,
    startOcr,
    cancelOcr
  }), [captures, status, addCapture, updateCapture, removeCapture, restoreCapture, importCaptures, ocrJobs, startOcr, cancelOcr]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useCaptureLibrary() {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useCaptureLibrary must be used within LibraryProvider');
  return context;
}
