import { createContext, useContext, useMemo, useState } from 'react';

export const AUTH_STORAGE_KEY = 'jovi.auth.session';

const AuthContext = createContext(null);

function readStoredSession() {
  try {
    const rawValue = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!rawValue) return null;
    const parsedValue = JSON.parse(rawValue);
    if (parsedValue?.authenticated === true && typeof parsedValue?.email === 'string') {
      return {
        authenticated: true,
        email: parsedValue.email
      };
    }
  } catch {
    return null;
  }

  return null;
}

function validateDemoCredentials(email, password) {
  if (!email.trim() || !password.trim()) {
    return 'Por favor, preencha todos os campos do formulário.';
  }

  if (!email.includes('@')) {
    return 'Por favor, insira um e-mail válido.';
  }

  if (password.length < 6) {
    return 'A senha deve ter pelo menos 6 caracteres.';
  }

  return '';
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession);

  const value = useMemo(() => {
    const login = ({ email, password }) => {
      const error = validateDemoCredentials(email, password);
      if (error) {
        return { ok: false, error };
      }

      const nextSession = {
        authenticated: true,
        email: email.trim()
      };

      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
      setSession(nextSession);

      return { ok: true, session: nextSession };
    };

    const logout = () => {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      setSession(null);
    };

    return {
      isAuthenticated: Boolean(session?.authenticated),
      login,
      logout,
      session,
      user: session
    };
  }, [session]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
