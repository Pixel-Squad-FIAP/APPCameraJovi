import { useCallback, useEffect, useRef, useState } from 'react';
import { updateStoredCapture } from '../services/captureStorage.js';
import { recognizeDocumentText } from '../services/documentOcr.js';
import { processDocumentImage } from '../services/documentProcessing.js';

const IDLE_STATE = {
  captureId: '',
  error: '',
  message: '',
  progress: null,
  status: 'idle'
};

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

  const prepareDocumentImage = useCallback(async (capture) => {
    if (!isDocumentCapture(capture)) {
      throw new Error('Selecione um documento para processar.');
    }

    if (capture.processedBlob) return capture;

    const processed = await processDocumentImage(capture.blob);
    return patchCapture(capture.id, {
      height: processed.height,
      processedBlob: processed.blob,
      processedHeight: processed.height,
      processedWidth: processed.width,
      updatedAt: new Date().toISOString(),
      width: processed.width
    });
  }, [patchCapture]);

  const recognizeCapture = useCallback(async (capture) => {
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
      workingCapture = await prepareDocumentImage(capture);
      workingCapture = await patchCapture(capture.id, {
        ocrError: '',
        ocrStatus: 'processing',
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

      const ocrResult = await recognizeDocumentText(workingCapture.processedBlob || workingCapture.blob, {
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

      const updatedCapture = await patchCapture(capture.id, {
        ocrError: '',
        ocrConfidence: ocrResult.confidence,
        ocrLanguage: ocrResult.language,
        ocrProcessedAt: new Date().toISOString(),
        ocrStatus: 'done',
        ocrText: ocrResult.text,
        documentText: workingCapture.documentText ?? ocrResult.text,
        updatedAt: new Date().toISOString()
      });

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

  const scanDocument = useCallback(async () => {
    if (state.status === 'processing') {
      throw new Error('Aguarde o processamento do documento atual.');
    }

    const capture = await captureDocument();
    return prepareDocumentImage(capture);
  }, [captureDocument, prepareDocumentImage, state.status]);

  const retryDocumentOcr = useCallback(async (capture) => {
    if (state.status === 'processing') {
      throw new Error('Aguarde o processamento do documento atual.');
    }

    return recognizeCapture(capture);
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
