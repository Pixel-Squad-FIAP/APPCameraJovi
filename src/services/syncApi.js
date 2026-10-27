// Cliente do servidor local do JOVI Desktop (python/jovi/servidor.py).
// O programa Python roda no computador do estudante e escuta só em 127.0.0.1.

export const DEFAULT_DESKTOP_PORT = 5050;

export class DesktopOfflineError extends Error {}
export class DesktopError extends Error {}

export function desktopUrl(port = DEFAULT_DESKTOP_PORT) {
  return `http://127.0.0.1:${port}`;
}

async function request(path, { port, method = 'GET', body, timeout = 4000 } = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  let response;
  try {
    response = await fetch(`${desktopUrl(port)}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
  } catch {
    // Servidor desligado, porta errada, tempo esgotado ou acesso à rede local bloqueado pelo navegador.
    throw new DesktopOfflineError('JOVI Desktop não encontrado.');
  } finally {
    window.clearTimeout(timer);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new DesktopError(data?.erro ?? `O JOVI Desktop respondeu com erro ${response.status}.`);
  return data;
}

export function getDesktopStatus(port) {
  return request('/api/status', { port, timeout: 2500 });
}

// Envia a biblioteca do navegador; o Python mescla, salva e devolve a biblioteca mesclada.
export function syncLibrary(libraryFile, port) {
  return request('/api/biblioteca', { port, method: 'POST', body: libraryFile, timeout: 60000 });
}
