import { useCallback, useMemo, useState } from 'react';
import { captureFromTransfer } from '../lib/capturePipeline.js';
import { useCaptureLibrary } from '../library/LibraryContext.jsx';
import {
  buildLibraryFile,
  getDeletedIds,
  mergeAlbumNames,
  parseLibraryFile,
  planMerge,
  toTransferCapture
} from '../services/libraryTransfer.js';
import { DEFAULT_DESKTOP_PORT, getDesktopStatus, syncLibrary } from '../services/syncApi.js';
import { blobToDataUrl, downloadBlob } from './useExport.js';
import { usePreference } from './usePreference.js';

async function buildCreatedCapture(item) {
  const { thumbDataUrl, ...capture } = item;
  const { imageBlob, thumbBlob, width, height } = await captureFromTransfer(capture, thumbDataUrl);
  return {
    capture: { ...capture, mimeType: imageBlob.type, size: imageBlob.size, width, height, thumbBlob },
    media: imageBlob
  };
}

// Integração com o JOVI Desktop (Python): exportar/importar a biblioteca em JSON
// e sincronizar direto com o servidor local. Toda a lógica fica aqui; a interface só chama as ações.
export function useLibrarySync(port = DEFAULT_DESKTOP_PORT) {
  const { captures, importCaptures } = useCaptureLibrary();
  const [albums, setAlbums] = usePreference('albums');
  const [busy, setBusy] = useState(null);
  const [desktop, setDesktop] = useState({ status: 'unknown', info: null });
  const [report, setReport] = useState(null);

  const buildFile = useCallback(async () => {
    const items = await Promise.all(captures.map(async (capture) => (
      toTransferCapture(capture, capture.thumbBlob ? await blobToDataUrl(capture.thumbBlob) : null)
    )));
    return buildLibraryFile(items, albums, { deleted: getDeletedIds() });
  }, [albums, captures]);

  const applyFile = useCallback(async (input) => {
    const incoming = parseLibraryFile(input);
    const plan = planMerge(captures, incoming.captures, new Set([...getDeletedIds(), ...incoming.deleted]));
    const created = await Promise.all(plan.create.map(buildCreatedCapture));
    await importCaptures({ created, updated: plan.update });
    setAlbums((current) => mergeAlbumNames(current ?? [], incoming.albums, plan.create));
    const result = {
      created: plan.create.length,
      updated: plan.update.length,
      unchanged: plan.unchanged,
      skipped: plan.skipped + incoming.invalid
    };
    setReport(result);
    return result;
  }, [captures, importCaptures, setAlbums]);

  const run = useCallback(async (id, action) => {
    setBusy(id);
    try {
      return await action();
    } finally {
      setBusy(null);
    }
  }, []);

  const checkDesktop = useCallback(async () => {
    setDesktop((current) => ({ ...current, status: 'checking' }));
    try {
      const info = await getDesktopStatus(port);
      setDesktop({ status: 'online', info });
      return true;
    } catch {
      setDesktop({ status: 'offline', info: null });
      return false;
    }
  }, [port]);

  const exportLibrary = useCallback(() => run('export', async () => {
    const file = await buildFile();
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `jovi-biblioteca-${new Date().toISOString().slice(0, 10)}.json`);
    return file.capturas.length;
  }), [buildFile, run]);

  const importLibrary = useCallback((file) => run('import', async () => applyFile(await file.text())), [applyFile, run]);

  const syncWithDesktop = useCallback(() => run('sync', async () => {
    const response = await syncLibrary(await buildFile(), port);
    const result = await applyFile(response);
    setDesktop({ status: 'online', info: { ...desktop.info, capturas: response.capturas.length } });
    return { ...result, desktop: response.relatorio };
  }), [applyFile, buildFile, desktop.info, port, run]);

  return useMemo(() => ({
    busy, desktop, report, checkDesktop, exportLibrary, importLibrary, syncWithDesktop
  }), [busy, desktop, report, checkDesktop, exportLibrary, importLibrary, syncWithDesktop]);
}
