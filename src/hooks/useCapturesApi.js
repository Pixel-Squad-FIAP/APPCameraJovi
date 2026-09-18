import { useCallback, useEffect, useState } from 'react';
import { fetchCaptures } from '../services/capturesApi.js';

export function useCapturesApi(enabled) {
  const [captures, setCaptures] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadCaptures = useCallback(async ({ signal } = {}) => {
    setLoading(true);
    setError('');

    try {
      const items = await fetchCaptures({ signal });
      setCaptures(items);
      setHasLoaded(true);
    } catch (currentError) {
      if (currentError.name === 'AbortError') return;
      setError(currentError.message || 'Não foi possível carregar as capturas de estudo.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || hasLoaded) return undefined;

    const controller = new AbortController();
    loadCaptures({ signal: controller.signal });

    return () => controller.abort();
  }, [enabled, hasLoaded, loadCaptures]);

  return {
    captures,
    error,
    loading,
    retry: () => loadCaptures()
  };
}
