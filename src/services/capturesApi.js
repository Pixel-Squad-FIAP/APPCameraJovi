const CAPTURES_ENDPOINT = '/api/captures';

function isValidCapture(item) {
  return Boolean(
    item
    && typeof item.id === 'string'
    && typeof item.title === 'string'
    && typeof item.type === 'string'
    && typeof item.summary === 'string'
    && typeof item.capturedAt === 'string'
    && Array.isArray(item.tags)
  );
}

export async function fetchCaptures({ signal } = {}) {
  const response = await fetch(CAPTURES_ENDPOINT, {
    headers: {
      Accept: 'application/json'
    },
    signal
  });

  if (!response.ok) {
    throw new Error('Não foi possível carregar as capturas de estudo.');
  }

  const payload = await response.json();

  if (!payload || !Array.isArray(payload.items) || !payload.items.every(isValidCapture)) {
    throw new Error('Resposta inválida da API de capturas.');
  }

  return payload.items;
}
