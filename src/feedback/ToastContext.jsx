import { createContext, useContext, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import Toast from '../components/ui/Toast.jsx';
import { useNotification } from '../hooks/useNotification.js';

const ToastContext = createContext(null);

// Fica acima das rotas para que a mensagem sobreviva à navegação (ex.: "Desfazer" após excluir).
export function ToastProvider({ children }) {
  const { notification, showNotification, hideNotification } = useNotification();
  const { pathname } = useLocation();
  const value = useMemo(() => ({ showNotification, hideNotification }), [showNotification, hideNotification]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Na câmera, a mensagem fica acima do disparador para não cobrir os controles. */}
      <Toast elevated={pathname === '/camera'} notification={notification} onDismiss={hideNotification} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
