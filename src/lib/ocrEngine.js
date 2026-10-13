// Motor de OCR (Tesseract.js) executado no navegador, em português.
// O worker é criado uma única vez e reaproveitado; o modelo de idioma é baixado
// do CDN do Tesseract na primeira execução e fica em cache no navegador.

import { cleanOcrText } from './ocrText.js';

const STAGE_LABELS = {
  'loading tesseract core': 'Carregando motor de OCR',
  'initializing tesseract': 'Inicializando OCR',
  'initialized tesseract': 'Inicializando OCR',
  'loading language traineddata': 'Baixando modelo de português (só na 1ª vez)',
  'loading language traineddata (from cache)': 'Carregando modelo de português',
  'initializing api': 'Preparando reconhecimento',
  'initialized api': 'Preparando reconhecimento',
  'recognizing text': 'Reconhecendo texto'
};

let workerPromise = null;
let progressListener = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = import('tesseract.js')
      .then(({ createWorker }) => createWorker('por', 1, {
        logger: (message) => progressListener?.(message)
      }))
      .catch((error) => {
        workerPromise = null;
        throw error;
      });
  }
  return workerPromise;
}

export function preloadOcr() {
  getWorker().catch(() => {});
}

export async function terminateOcr() {
  if (!workerPromise) return;
  const pending = workerPromise;
  workerPromise = null;
  try {
    const worker = await pending;
    await worker.terminate();
  } catch {
    // worker já indisponível
  }
}

export async function recognizeImage(image, onProgress) {
  progressListener = (message) => {
    onProgress?.({
      stage: STAGE_LABELS[message.status] ?? 'Processando',
      progress: message.status === 'recognizing text' ? message.progress : null
    });
  };

  try {
    onProgress?.({ stage: 'Carregando motor de OCR', progress: null });
    const worker = await getWorker();
    const { data } = await worker.recognize(image);
    return {
      text: cleanOcrText(data.text),
      confidence: Math.round(data.confidence ?? 0)
    };
  } finally {
    progressListener = null;
  }
}
