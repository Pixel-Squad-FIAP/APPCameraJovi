import { useCallback, useRef, useState } from 'react';
import { prepareForOcr } from '../lib/imageProcessing.js';
import { recognizeImage, terminateOcr } from '../lib/ocrEngine.js';
import { titleFromText } from '../lib/ocrText.js';
import { getCaptureMedia } from '../services/captureStore.js';

function friendlyOcrError(error) {
  const message = String(error?.message ?? error ?? '');
  if (/fetch|network|load|traineddata|Failed/i.test(message)) {
    return 'Não foi possível baixar o modelo de OCR. Verifique sua conexão e tente novamente.';
  }
  return 'O reconhecimento de texto falhou. A imagem continua salva — tente novamente.';
}

// Fila de OCR: uma captura por vez, com progresso por etapa. Fica no provider da
// biblioteca para não se perder quando o usuário navega entre telas.
export function useOcrQueue(updateCapture) {
  const [jobs, setJobs] = useState({});
  const queueRef = useRef(Promise.resolve());
  const cancelledRef = useRef(new Set());

  const setJob = useCallback((id, job) => {
    setJobs((current) => {
      if (job === null) {
        const next = { ...current };
        delete next[id];
        return next;
      }
      return { ...current, [id]: job };
    });
  }, []);

  const startOcr = useCallback((id) => {
    cancelledRef.current.delete(id);
    setJob(id, { stage: 'Na fila', progress: null });

    queueRef.current = queueRef.current.then(async () => {
      if (cancelledRef.current.has(id)) return;
      try {
        await updateCapture(id, { ocrStatus: 'processing', ocrError: null });
        const media = await getCaptureMedia(id);
        if (!media) throw new Error('Imagem da captura não encontrada.');
        setJob(id, { stage: 'Preparando imagem', progress: null });
        const prepared = await prepareForOcr(media);
        const result = await recognizeImage(prepared, (progress) => {
          if (!cancelledRef.current.has(id)) setJob(id, progress);
        });
        if (cancelledRef.current.has(id)) return;

        await updateCapture(id, (capture) => {
          const autoTitle = capture.titleAuto ? titleFromText(result.text) : '';
          return {
            text: result.text,
            ocrStatus: result.text ? 'done' : 'empty',
            ocrConfidence: result.confidence,
            ...(autoTitle ? { title: autoTitle, titleAuto: false } : {})
          };
        });
      } catch (error) {
        if (!cancelledRef.current.has(id)) {
          await updateCapture(id, { ocrStatus: 'error', ocrError: friendlyOcrError(error) });
        }
      } finally {
        setJob(id, null);
      }
    });
  }, [setJob, updateCapture]);

  const cancelOcr = useCallback(async (id) => {
    cancelledRef.current.add(id);
    setJob(id, null);
    await terminateOcr();
    await updateCapture(id, { ocrStatus: 'idle' });
  }, [setJob, updateCapture]);

  return { ocrJobs: jobs, startOcr, cancelOcr };
}
