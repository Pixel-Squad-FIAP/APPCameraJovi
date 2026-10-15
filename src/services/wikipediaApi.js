// Cliente da API pública da Wikipédia em português (REST, sem chave).
// https://pt.wikipedia.org/api/rest_v1/

const SUMMARY_ENDPOINT = 'https://pt.wikipedia.org/api/rest_v1/page/summary/';

export class TermNotFoundError extends Error {}

export async function fetchTermSummary(term, { signal } = {}) {
  const response = await fetch(`${SUMMARY_ENDPOINT}${encodeURIComponent(term.trim())}`, {
    headers: { Accept: 'application/json' },
    signal
  });

  if (response.status === 404) throw new TermNotFoundError(term);
  if (!response.ok) throw new Error('Não foi possível consultar a Wikipédia.');

  const data = await response.json();
  // Páginas de desambiguação não explicam o termo, só listam significados.
  if (data.type === 'disambiguation' || !data.extract) throw new TermNotFoundError(term);

  return {
    title: data.title,
    description: data.description ?? '',
    extract: data.extract,
    thumbnail: data.thumbnail?.source ?? null,
    url: data.content_urls?.desktop?.page ?? `https://pt.wikipedia.org/wiki/${encodeURIComponent(term)}`
  };
}
