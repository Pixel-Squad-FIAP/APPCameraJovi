import { useCallback, useEffect, useRef, useState } from 'react';
import { updateStoredCapture } from '../services/captureStorage.js';
import { recognizeDocumentText } from '../services/documentOcr.js';
import { processDocumentImage } from '../services/documentProcessing.js';
import { getDocumentPages, replaceDocumentPage } from '../services/documentModel.js';

const IDLE_STATE = {
  captureId: '',
  error: '',
  message: '',
  progress: null,
  status: 'idle'
};

const LOW_CONFIDENCE_RETRY_THRESHOLD = 58;

function isDocumentCapture(capture) {
  return capture?.kind === 'document' && capture?.blob;
}

function getOcrErrorMessage(error) {
  if (error?.name === 'AbortError') {
    return 'Reconhecimento interrompido.';
  }

  return error?.message || 'Não foi possível reconhecer o texto deste documento.';
}

export function useDocumentScanner({ captureDocument, onCaptureUpdated }) {
  const [state, setState] = useState(IDLE_STATE);
  const mountedRef = useRef(false);
  const abortRef = useRef(null);

  const patchCapture = useCallback(async (captureId, patch) => {
    const updatedCapture = await updateStoredCapture(captureId, patch);
    if (mountedRef.current) {
      onCaptureUpdated(updatedCapture);
    }
    return updatedCapture;
  }, [onCaptureUpdated]);

  const finishWithError = useCallback(async (capture, error) => {
    if (error?.name === 'AbortError' && !mountedRef.current) {
      return capture;
    }

    const errorMessage = getOcrErrorMessage(error);
    const patch = {
      ocrError: errorMessage,
      ocrStatus: error?.name === 'AbortError' ? 'pending' : 'error',
      updatedAt: new Date().toISOString()
    };

    let updatedCapture = capture;
    if (capture?.id) {
      updatedCapture = await patchCapture(capture.id, patch);
    }

    if (mountedRef.current) {
      setState({
        captureId: capture?.id || '',
        error: errorMessage,
        message: errorMessage,
        progress: null,
        status: patch.ocrStatus
      });
    }

    return updatedCapture;
  }, [patchCapture]);

  const prepareDocumentImage = useCallback(async (capture, pageId) => {
    if (!isDocumentCapture(capture)) {
      throw new Error('Selecione um documento para processar.');
    }

    const page = getDocumentPages(capture).find((item) => item.id === pageId) || getDocumentPages(capture)[0];
    if (!page?.blob) throw new Error('Página do documento não encontrada.');
    if (page.processedBlob) return capture;

    const processed = await processDocumentImage(page.rectifiedBlob || page.blob);
    return patchCapture(capture.id, replaceDocumentPage(capture, page.id, {
      height: processed.height,
      processedBlob: processed.blob,
      processedHeight: processed.height,
      processedWidth: processed.width,
      sourceHeight: page.sourceHeight || page.height,
      sourceWidth: page.sourceWidth || page.width,
      width: processed.width
    }));
  }, [patchCapture]);

  const recognizeCapture = useCallback(async (capture, pageId) => {
    if (!isDocumentCapture(capture)) {
      throw new Error('Selecione um documento para reconhecer texto.');
    }

    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    if (mountedRef.current) {
      setState({
        captureId: capture.id,
        error: '',
        message: 'Preparando documento...',
        progress: null,
        status: 'processing'
      });
    }

    let workingCapture = capture;

    try {
      const targetPage = getDocumentPages(capture).find((page) => page.id === pageId) || getDocumentPages(capture)[0];
      workingCapture = await prepareDocumentImage(capture, targetPage?.id);
      const workingPage = getDocumentPages(workingCapture).find((page) => page.id === targetPage?.id) || getDocumentPages(workingCapture)[0];
      workingCapture = await patchCapture(capture.id, {
        ...replaceDocumentPage(workingCapture, workingPage.id, {
          ocrError: '',
          ocrStatus: 'processing'
        }),
        updatedAt: new Date().toISOString(),
      });

      if (mountedRef.current) {
        setState({
          captureId: capture.id,
          error: '',
          message: 'Reconhecendo texto...',
          progress: null,
          status: 'processing'
        });
      }

      const ocrPage = getDocumentPages(workingCapture).find((page) => page.id === workingPage.id) || workingPage;
      const primaryOcrBlob = ocrPage.processedBlob || ocrPage.rectifiedBlob || ocrPage.blob;
      let ocrResult = await recognizeDocumentText(primaryOcrBlob, {
        signal: abortController.signal,
        onProgress: (progress) => {
          if (!mountedRef.current || abortController.signal.aborted) return;
          setState({
            captureId: capture.id,
            error: '',
            message: `Reconhecendo texto... ${progress}%`,
            progress,
            status: 'processing'
          });
        }
      });

      const fallbackBlob = ocrPage.rectifiedBlob || ocrPage.blob;
      const shouldTryFallback = fallbackBlob
        && fallbackBlob !== primaryOcrBlob
        && (!Number.isFinite(ocrResult.confidence) || ocrResult.confidence < LOW_CONFIDENCE_RETRY_THRESHOLD);

      if (shouldTryFallback) {
        if (mountedRef.current) {
          setState({
            captureId: capture.id,
            error: '',
            message: 'Tentando leitura alternativa...',
            progress: null,
            status: 'processing'
          });
        }

        const fallbackResult = await recognizeDocumentText(fallbackBlob, {
          signal: abortController.signal,
          onProgress: (progress) => {
            if (!mountedRef.current || abortController.signal.aborted) return;
            setState({
              captureId: capture.id,
              error: '',
              message: `Leitura alternativa... ${progress}%`,
              progress,
              status: 'processing'
            });
          }
        });

        const primaryConfidence = Number.isFinite(ocrResult.confidence) ? ocrResult.confidence : -1;
        const fallbackConfidence = Number.isFinite(fallbackResult.confidence) ? fallbackResult.confidence : -1;
        if (fallbackConfidence > primaryConfidence || (!ocrResult.text && fallbackResult.text)) {
          ocrResult = fallbackResult;
        }
      }

      const updatedCapture = await patchCapture(capture.id, replaceDocumentPage(workingCapture, workingPage.id, {
        documentText: ocrPage.documentText ?? ocrResult.text,
        ocrError: '',
        ocrConfidence: ocrResult.confidence,
        ocrLanguage: ocrResult.language,
        ocrProcessedAt: new Date().toISOString(),
        ocrStatus: 'done',
        ocrText: ocrResult.text
      }));

      if (mountedRef.current) {
        setState({
          captureId: capture.id,
          error: '',
          message: ocrResult.text ? 'Texto reconhecido' : 'Nenhum texto foi reconhecido neste documento.',
          progress: 100,
          status: 'done'
        });
      }

      return updatedCapture;
    } catch (error) {
      return finishWithError(workingCapture, error);
    } finally {
      if (abortRef.current === abortController) {
        abortRef.current = null;
      }
    }
  }, [finishWithError, patchCapture, prepareDocumentImage]);

  const scanDocument = useCallback(async (initialCorners = null, { prepare = true } = {}) => {
    if (state.status === 'processing') {
      throw new Error('Aguarde o processamento do documento atual.');
    }

    const capture = await captureDocument({ initialCorners });
    return prepare ? prepareDocumentImage(capture) : capture;
  }, [captureDocument, prepareDocumentImage, state.status]);

  const retryDocumentOcr = useCallback(async (capture, pageId) => {
    if (state.status === 'processing') {
      throw new Error('Aguarde o processamento do documento atual.');
    }

    return recognizeCapture(capture, pageId);
  }, [recognizeCapture, state.status]);

  const cancelDocumentOcr = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  return {
    cancelDocumentOcr,
    isDocumentScanning: state.status === 'processing',
    retryDocumentOcr,
    scanDocument,
    state
  };
}
