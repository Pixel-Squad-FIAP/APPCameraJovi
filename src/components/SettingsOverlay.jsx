import { useState } from 'react';

export default function SettingsOverlay({ isOpen, onClose, showNotification }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      window.alert('Por favor, preencha todos os campos do formulário.');
      return;
    }

    if (!email.includes('@')) {
      window.alert('Por favor, insira um e-mail válido.');
      return;
    }

    if (password.length < 6) {
      window.alert('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    window.alert('Login realizado com sucesso! (Simulação)');
    onClose();
    showNotification('Usuário autenticado');
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

            <div style={{ textAlign: 'right', marginBottom: '15px' }}>
              <a href="#" id="forgot-password" onClick={handleForgotPassword} style={{ color: '#5c9df5', fontSize: '11px', textDecoration: 'none' }}>
                Esqueceu a senha?
              </a>
            </div>

            <button type="submit" className="student-action-btn primary" style={{ width: '100%' }}>Entrar</button>
          </form>
        </div>
      </div>
    </div>
  );
}
