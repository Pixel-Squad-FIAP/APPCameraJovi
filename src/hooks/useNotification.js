import { useCallback, useEffect, useRef, useState } from 'react';

// Mensagem temporária (toast). Aceita uma ação opcional, como "Desfazer" ou "Ver".
export function useNotification(defaultDuration = 2600) {
  const [notification, setNotification] = useState(null);
  const timeoutRef = useRef(null);

  const hideNotification = useCallback(() => {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setNotification(null);
  }, []);

  const showNotification = useCallback((message, options = {}) => {
    const { action, tone = 'neutral', duration = action ? 5000 : defaultDuration } = options;
    window.clearTimeout(timeoutRef.current);
    setNotification({ id: Date.now(), message, action, tone });
    timeoutRef.current = window.setTimeout(() => {
      setNotification(null);
      timeoutRef.current = null;
    }, duration);
  }, [defaultDuration]);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  return { notification, showNotification, hideNotification };
}
