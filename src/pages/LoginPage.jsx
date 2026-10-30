import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Mantém a query string da página pedida (ex.: /camera?modo=estudante, /galeria?sincronizar=1).
  const from = location.state?.from;
  const redirectTo = from ? `${from.pathname}${from.search ?? ''}` : '/camera';

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    const result = login({ email, password });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setError('');
    navigate(redirectTo, { replace: true });
  };

  // Acesso de demonstração em um clique (para a banca/professor não precisar preencher nada).
  const handleGuestAccess = () => {
    const result = login({ email: 'visitante@jovi.com', password: 'visitante' });
    if (result.ok) navigate(redirectTo, { replace: true });
  };

  return (
    <main className="min-h-screen bg-[#0d0f12] bg-[linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[length:48px_48px] px-4 py-8 text-[#f0f0ec] sm:px-6">
      <section className="mx-auto grid min-h-[calc(100vh-64px)] w-full max-w-[960px] items-center gap-8 lg:grid-cols-[0.9fr_1fr]">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.05em] text-[#b2c7d8]">JOVI Camera</p>
          <h1 className="max-w-[560px] text-[clamp(2.2rem,8vw,4.15rem)] font-extrabold leading-[1.03]">
            Acesse a câmera para continuar.
          </h1>
          <p className="mt-5 max-w-[520px] text-[#bec4c8]">
            Esta autenticação é uma simulação acadêmica para demonstrar rota privada no front-end.
            Qualquer e-mail válido e senha com 6 ou mais caracteres funcionam — ou use o acesso rápido.
          </p>
          <Link className="mt-7 inline-flex min-h-12 items-center justify-center rounded border border-[#303740] px-5 font-bold text-[#f0f0ec] no-underline hover:border-[#85afd5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#85afd5]" to="/">
            Voltar para a Landing
          </Link>
        </div>

        <div className="grid gap-4 rounded border border-[#303740] bg-[#0b0d10] p-5 sm:p-6">
          <button className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded bg-[#3f66f6] px-5 font-bold text-white hover:bg-[#6f8fff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#85afd5]" onClick={handleGuestAccess} type="button">
            <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            Acessar a câmera
          </button>

          <div aria-hidden="true" className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.05em] text-[#899198]">
            <span className="h-px flex-1 bg-[#303740]" /> ou entre com e-mail <span className="h-px flex-1 bg-[#303740]" />
          </div>

          <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-2">
              <label className="font-bold" htmlFor="login-page-email">Email</label>
              <input
                autoComplete="email"
                className="w-full rounded border border-[#303740] bg-[#0b0d10] px-3.5 py-3 text-[#f0f0ec] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#85afd5]"
                id="login-page-email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seu@email.com"
                type="email"
                value={email}
              />
            </div>

            <div className="grid gap-2">
              <label className="font-bold" htmlFor="login-page-password">Senha</label>
              <input
                autoComplete="current-password"
                className="w-full rounded border border-[#303740] bg-[#0b0d10] px-3.5 py-3 text-[#f0f0ec] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#85afd5]"
                id="login-page-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                type="password"
                value={password}
              />
            </div>

            {error && (
              <p className="m-0 rounded border border-[#7b2f3b] bg-[#2a1116] px-3 py-2 text-sm font-bold text-[#ff9cac]" role="alert">
                {error}
              </p>
            )}

            <button className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded bg-[#d9d5ca] px-5 font-bold text-[#14171b] hover:bg-[#c8c3b7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#85afd5]" type="submit">
              Entrar
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
