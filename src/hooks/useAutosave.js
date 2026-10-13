import { useCallback, useEffect, useRef, useState } from 'react';

// Rascunho local de um campo de texto salvo automaticamente após uma pausa na digitação.
// status: 'saved' | 'pending' | 'saving' | 'error'
export function useAutosave(savedValue, save, delay = 700) {
  const [draft, setDraftState] = useState(savedValue ?? '');
  const [status, setStatus] = useState('saved');
  const timeoutRef = useRef(null);
  const draftRef = useRef(draft);
  const saveRef = useRef(save);
  saveRef.current = save;

  // Atualiza o rascunho quando o valor salvo muda por fora (ex.: OCR terminou), se não houver edição pendente.
  useEffect(() => {
    if (status === 'saved' && savedValue !== draftRef.current) {
      draftRef.current = savedValue ?? '';
      setDraftState(draftRef.current);
    }
  }, [savedValue, status]);

  const flush = useCallback(async () => {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setStatus('saving');
    try {
      await saveRef.current(draftRef.current);
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }, []);

  const setDraft = useCallback((value) => {
    draftRef.current = value;
    setDraftState(value);
    setStatus('pending');
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(flush, delay);
  }, [delay, flush]);

  // Salva o que estiver pendente ao sair da tela.
  useEffect(() => () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      saveRef.current(draftRef.current);
    }
  }, []);

  return { draft, setDraft, status, flush };
}
