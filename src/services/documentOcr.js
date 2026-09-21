export const DOCUMENT_OCR_LANGUAGE = 'por';

function normalizeRecognizedText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function createAbortError() {
  const error = new Error('Reconhecimento de texto interrompido.');
  error.name = 'AbortError';
  return error;
}

export async function recognizeDocumentText(imageBlob, { onProgress, signal } = {}) {
  let worker = null;
  let workerTerminated = false;

  const throwIfAborted = () => {
    if (signal?.aborted) {
      throw createAbortError();
    }
  };

  const terminateWorker = async () => {
    if (!worker || workerTerminated) return;
    workerTerminated = true;
    await worker.terminate();
  };

  const handleAbort = () => {
    terminateWorker().catch(() => {});
  };

  signal?.addEventListener('abort', handleAbort, { once: true });

  try {
    throwIfAborted();
    const { createWorker } = await import('tesseract.js');
    throwIfAborted();

    worker = await createWorker(DOCUMENT_OCR_LANGUAGE, 1, {
      logger: (message) => {
        if (message?.status === 'recognizing text' && Number.isFinite(message.progress)) {
          onProgress?.(Math.round(message.progress * 100));
        }
      }
    });

    throwIfAborted();
    if (typeof worker.setParameters === 'function') {
      await worker.setParameters({
        tessedit_pageseg_mode: '3'
      });
    }

    const result = await worker.recognize(imageBlob);
    throwIfAborted();

    return {
      confidence: Number.isFinite(result?.data?.confidence) ? Math.round(result.data.confidence) : null,
      language: DOCUMENT_OCR_LANGUAGE,
      text: normalizeRecognizedText(result?.data?.text)
    };
  } finally {
    signal?.removeEventListener('abort', handleAbort);
    await terminateWorker();
  }
}
