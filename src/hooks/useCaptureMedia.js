import { useEffect, useState } from 'react';
import { getCaptureMedia } from '../services/captureStore.js';
import { useObjectUrl } from './useObjectUrl.js';

// Carrega o arquivo completo (foto/vídeo) de uma captura sob demanda.
export function useCaptureMedia(id) {
  const [state, setState] = useState({ blob: null, loading: true, error: false });

  useEffect(() => {
    if (!id) return undefined;
    let active = true;
    setState({ blob: null, loading: true, error: false });
    getCaptureMedia(id)
      .then((blob) => {
        if (active) setState({ blob: blob ?? null, loading: false, error: !blob });
      })
      .catch(() => {
        if (active) setState({ blob: null, loading: false, error: true });
      });
    return () => {
      active = false;
    };
  }, [id]);

  const url = useObjectUrl(state.blob);
  return { ...state, url };
}
