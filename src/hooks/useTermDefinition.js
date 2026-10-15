import { useCallback, useEffect, useState } from 'react';
import { fetchTermSummary, TermNotFoundError } from '../services/wikipediaApi.js';

// Respostas já consultadas ficam em memória para não repetir a requisição.
const cache = new Map();

// Busca a explicação de um termo na Wikipédia. status: 'idle' | 'loading' | 'success' | 'notFound' | 'error'
export function useTermDefinition(term) {
  const [state, setState] = useState({ status: 'idle', data: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!term) {
      setState({ status: 'idle', data: null });
      return undefined;
    }

    const key = term.toLowerCase();
    if (cache.has(key)) {
      setState({ status: 'success', data: cache.get(key) });
      return undefined;
    }

    const controller = new AbortController();
    setState({ status: 'loading', data: null });

    fetchTermSummary(term, { signal: controller.signal })
      .then((data) => {
        cache.set(key, data);
        setState({ status: 'success', data });
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setState({ status: error instanceof TermNotFoundError ? 'notFound' : 'error', data: null });
      });

    return () => controller.abort();
  }, [term, attempt]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  return { ...state, retry };
}
