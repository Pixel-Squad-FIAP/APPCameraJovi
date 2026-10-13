import { useCallback, useEffect, useRef, useState } from 'react';

// Contagem regressiva do temporizador da câmera; pode ser cancelada a qualquer momento.
export function useCountdown() {
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef(null);

  const cancel = useCallback(() => {
    window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRemaining(0);
  }, []);

  const start = useCallback((seconds, onDone) => {
    window.clearInterval(intervalRef.current);
    let left = seconds;
    setRemaining(left);
    intervalRef.current = window.setInterval(() => {
      left -= 1;
      if (left > 0) {
        setRemaining(left);
        return;
      }
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      setRemaining(0);
      onDone();
    }, 1000);
  }, []);

  useEffect(() => () => window.clearInterval(intervalRef.current), []);

  return { remaining, isRunning: remaining > 0, start, cancel };
}
