import { useDeferredValue, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ApiExamples from '../components/library/ApiExamples.jsx';
import CaptureCard from '../components/library/CaptureCard.jsx';
import Button, { focusRing } from '../components/ui/Button.jsx';
import Chip from '../components/ui/Chip.jsx';
import { EmptyState, Notice, Spinner } from '../components/ui/Feedback.jsx';
import Icon from '../components/ui/Icon.jsx';
import { useAlbums } from '../hooks/usePreference.js';
import { normalizeSearch } from '../lib/format.js';
import { useCaptureLibrary } from '../library/LibraryContext.jsx';

const ALL = 'Todos';
const TYPE_FILTERS = [
  { id: 'all', label: 'Tudo' },
  { id: 'text', label: 'Com texto', icon: 'text' },
  { id: 'photo', label: 'Fotos', icon: 'image' },
  { id: 'video', label: 'Vídeos', icon: 'video' }
];

function matchesType(capture, type) {
  if (type === 'text') return Boolean(capture.text);
  if (type === 'photo' || type === 'video') return capture.kind === type;
  return true;
}

export default function LibraryPage() {
  const { captures, ocrJobs, status } = useCaptureLibrary();
  const { albums } = useAlbums();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const album = searchParams.get('album') ?? ALL;
  const type = searchParams.get('tipo') ?? 'all';

  const updateParam = (key, value, fallback) => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      if (value === fallback) next.delete(key);
      else next.set(key, value);
      return next;
    }, { replace: true });
  };

  // Álbuns criados + álbuns que existem nas capturas (ex.: criados em outra sessão).
  const albumCounts = useMemo(() => {
    const counts = new Map(albums.map((name) => [name, 0]));
    captures.forEach((capture) => counts.set(capture.album, (counts.get(capture.album) ?? 0) + 1));
    return [...counts.entries()];
  }, [albums, captures]);

  const filtered = useMemo(() => {
    const terms = normalizeSearch(deferredQuery).split(/\s+/).filter(Boolean);
    return captures.filter((capture) => {
      if (album !== ALL && capture.album !== album) return false;
      if (!matchesType(capture, type)) return false;
      if (!terms.length) return true;
      const haystack = normalizeSearch(`${capture.title} ${capture.album} ${capture.text} ${capture.notes}`);
      return terms.every((term) => haystack.includes(term));
    });
  }, [album, captures, deferredQuery, type]);

  const hasFilters = album !== ALL || type !== 'all' || query;

  return (
    <div className="min-h-dvh bg-ink-900 text-white">
      <header className="sticky top-0 z-30 border-b border-white/8 bg-ink-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link aria-label="Voltar para a câmera" className={`grid size-11 place-items-center rounded-full bg-white/8 hover:bg-white/15 ${focusRing}`} to="/camera">
            <Icon name="camera" size={20} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight">Galeria</h1>
            <p className="text-xs text-white/50">{captures.length} {captures.length === 1 ? 'captura' : 'capturas'} salvas neste aparelho</p>
          </div>
          <Link className={`hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/8 hover:text-white sm:inline-flex ${focusRing}`} to="/">
            <Icon name="home" size={18} /> Projeto
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-center">
          <label className="relative block">
            <span className="sr-only">Buscar capturas</span>
            <Icon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/45" name="search" size={18} />
            <input
              className="min-h-11 w-full rounded-full border border-white/12 bg-white/5 pl-10 pr-10 text-sm text-white outline-none placeholder:text-white/40 focus:border-jovi-400"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar no título, texto ou anotações"
              type="search"
              value={query}
            />
          </label>
          <div aria-label="Filtrar por tipo" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:justify-end lg:px-0" role="group">
            {TYPE_FILTERS.map((filter) => (
              <Chip active={type === filter.id} icon={filter.icon} key={filter.id} onClick={() => updateParam('tipo', filter.id, 'all')}>
                {filter.label}
              </Chip>
            ))}
          </div>
        </div>

        <nav aria-label="Álbuns" className="scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip active={album === ALL} count={captures.length} onClick={() => updateParam('album', ALL, ALL)}>{ALL}</Chip>
          {albumCounts.map(([name, count]) => (
            <Chip active={album === name} count={count} icon="folder" key={name} onClick={() => updateParam('album', name, ALL)}>{name}</Chip>
          ))}
        </nav>

        <section aria-live="polite" className="mt-6">
          {status === 'loading' && <p className="flex items-center gap-2 text-sm text-white/60"><Spinner className="size-4" /> Carregando galeria…</p>}
          {status === 'error' && <Notice tone="error">Não foi possível abrir o armazenamento local. Verifique se o navegador não está em modo privado restrito.</Notice>}

          {status === 'ready' && captures.length === 0 && (
            <EmptyState description="Fotografe um slide, um quadro ou um documento — o texto é extraído e fica pesquisável aqui." icon="camera" title="Sua galeria está vazia">
              <Link className={`inline-flex min-h-11 items-center gap-2 rounded-full bg-jovi-500 px-4 text-sm font-semibold text-white hover:bg-jovi-400 ${focusRing}`} to="/camera">
                <Icon name="camera" size={18} /> Abrir câmera
              </Link>
            </EmptyState>
          )}

          {status === 'ready' && captures.length > 0 && filtered.length === 0 && (
            <EmptyState description={query ? `Nada encontrado para “${query}”.` : 'Nenhuma captura com esses filtros.'} icon="search" title="Sem resultados">
              {hasFilters && (
                <Button onClick={() => { setQuery(''); setSearchParams({}, { replace: true }); }} variant="secondary">Limpar filtros</Button>
              )}
            </EmptyState>
          )}

          {filtered.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((capture) => (
                <li key={capture.id}>
                  <CaptureCard capture={capture} processing={Boolean(ocrJobs[capture.id])} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <ApiExamples />
      </main>
    </div>
  );
}
