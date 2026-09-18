import { useCallback, useEffect, useRef, useState } from 'react';

export function useNotification(duration = 2000) {
  const [notification, setNotification] = useState('');
  const notificationTimeoutRef = useRef(null);

  const showNotification = useCallback((message) => {
    window.clearTimeout(notificationTimeoutRef.current);
    setNotification(message);
    notificationTimeoutRef.current = window.setTimeout(() => {
      setNotification('');
      notificationTimeoutRef.current = null;
    }, duration);
  }, [duration]);

  useEffect(() => {
    return () => window.clearTimeout(notificationTimeoutRef.current);
  }, []);

  return {
    notification,
    showNotification
  };
}
