import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';

export default function SettingsOverlay({ isOpen, onClose, showNotification }) {
  const { isAuthenticated, login, logout, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const result = login({ email, password });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setError('');
    window.alert('Login realizado com sucesso! (Simulação)');
    onClose();
    showNotification('Usuário autenticado');
  };

  const handleLogout = () => {
    logout();
    setEmail('');
    setPassword('');
    setError('');
    onClose();
    showNotification('Sessão encerrada');
  };

  const handleForgotPassword = (event) => {
    event.preventDefault();
    const userEmail = window.prompt('Para recuperar sua senha, digite seu e-mail cadastrado:');

    if (userEmail) {
      if (userEmail.includes('@')) {
        window.alert(`Um link de recuperação foi enviado para: ${userEmail}`);
      } else {
        window.alert('E-mail inválido.');
      }
    }
  };

  return (
    <div
      className={`student-overlay ${isOpen ? 'show' : ''}`}
      id="overlay-login"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="student-overlay-panel" style={{ maxWidth: '300px', height: 'auto', paddingBottom: '30px' }}>
        <div className="student-overlay-header">
          <button className="student-back-btn" onClick={onClose} aria-label="Fechar área do usuário">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4L6 9L11 14" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="student-overlay-title">Área do Usuário</span>
          <div style={{ width: '32px' }} />
        </div>

        <div className="student-card" style={{ marginTop: '20px' }}>
          {isAuthenticated ? (
            <div>
              <div className="student-card-label">Usuário autenticado</div>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px', lineHeight: 1.5, margin: '8px 0 16px' }}>
                {user?.email}
              </p>
              <button type="button" className="student-action-btn secondary" onClick={handleLogout} style={{ width: '100%' }}>Sair</button>
            </div>
          ) : (
            <form id="login-form" onSubmit={handleSubmit}>
              <div className="student-card-label">Email</div>
              <input
                className="student-textarea"
                id="login-email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seu@email.com"
                style={{ height: '40px', marginBottom: '15px' }}
                type="email"
                value={email}
              />

              <div className="student-card-label">Senha</div>
              <input
                className="student-textarea"
                id="login-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                style={{ height: '40px', marginBottom: '10px' }}
                type="password"
                value={password}
              />

              {error && (
                <p style={{ color: '#ff9cac', fontSize: '11px', fontWeight: 700, lineHeight: 1.4, margin: '0 0 12px' }}>
                  {error}
                </p>
              )}

              <div style={{ textAlign: 'right', marginBottom: '15px' }}>
                <a href="#" id="forgot-password" onClick={handleForgotPassword} style={{ color: '#5c9df5', fontSize: '11px', textDecoration: 'none' }}>
                  Esqueceu a senha?
                </a>
              </div>

              <button type="submit" className="student-action-btn primary" style={{ width: '100%' }}>Entrar</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
