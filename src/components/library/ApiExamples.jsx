import { useMemo, useState } from 'react';
import { useCapturesApi } from '../../hooks/useCapturesApi.js';
import { formatDateTime } from '../../lib/format.js';
import { summarize } from '../../lib/summarize.js';
import Button, { focusRing } from '../ui/Button.jsx';
import { Notice, Spinner } from '../ui/Feedback.jsx';
import Sheet from '../ui/Sheet.jsx';

// Capturas de exemplo servidas pela API própria (/api/captures), úteis para
// experimentar o resumo sem precisar fotografar nada.
export default function ApiExamples() {
  const { captures, error, loading, retry } = useCapturesApi(true);
  const [selected, setSelected] = useState(null);
  const summary = useMemo(() => (selected?.text ? summarize(selected.text, 'curto') : null), [selected]);

  return (
    <section aria-labelledby="api-examples-title" className="mt-12">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" id="api-examples-title">Exemplos de estudo</h2>
          <p className="text-sm text-white/55">Conteúdos de demonstração carregados da API do projeto (<code className="text-white/70">/api/captures</code>).</p>
        </div>
      </div>

      {loading && <p className="mt-4 flex items-center gap-2 text-sm text-white/60"><Spinner className="size-4" /> Carregando exemplos…</p>}
      {error && !loading && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Notice tone="error">{error}</Notice>
          <Button icon="refresh" onClick={retry} size="sm" variant="secondary">Tentar novamente</Button>
        </div>
      )}

      {!loading && !error && (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {captures.map((item) => (
            <li key={item.id}>
              <button
                className={`h-full w-full rounded-2xl border border-white/8 bg-ink-850 p-4 text-left transition-colors hover:border-white/20 ${focusRing}`}
                onClick={() => setSelected(item)}
                type="button"
              >
                <span className="flex items-center justify-between gap-2 text-xs text-white/50">
                  <span className="font-semibold uppercase tracking-wide text-jovi-300">{item.type}</span>
                  <time dateTime={item.capturedAt}>{formatDateTime(item.capturedAt)}</time>
                </span>
                <span className="mt-2 block font-semibold text-white">{item.title}</span>
                <span className="mt-1 line-clamp-3 block text-sm text-white/60">{item.summary}</span>
                <span className="mt-3 flex flex-wrap gap-1.5">
                  {item.tags.slice(0, 3).map((tag) => <span className="rounded-full bg-white/8 px-2 py-0.5 text-[11px] text-white/70" key={tag}>{tag}</span>)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet description={selected?.type} onClose={() => setSelected(null)} open={Boolean(selected)} title={selected?.title ?? ''} wide>
        {selected && (
          <div className="space-y-4">
            {summary?.sentences.length > 0 && (
              <div className="rounded-2xl bg-jovi-500/10 p-4">
                <h3 className="text-sm font-bold text-jovi-300">Resumo gerado ({summary.sentences.length} de {summary.sourceSentences} frases)</h3>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-white/85">
                  {summary.sentences.map((sentence) => <li key={sentence}>{sentence}</li>)}
                </ul>
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold">Texto completo</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/70">{selected.text}</p>
            </div>
          </div>
        )}
      </Sheet>
    </section>
  );
}
