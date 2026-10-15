import { useTermDefinition } from '../../hooks/useTermDefinition.js';
import Button, { focusRing } from '../ui/Button.jsx';
import { Notice, Spinner } from '../ui/Feedback.jsx';
import Icon from '../ui/Icon.jsx';
import Sheet from '../ui/Sheet.jsx';

// Explicação de um termo do resumo, consultada na API pública da Wikipédia.
export default function TermSheet({ onClose, term }) {
  const { data, retry, status } = useTermDefinition(term);

  return (
    <Sheet description="Explicação da Wikipédia" onClose={onClose} open={Boolean(term)} title={data?.title ?? term ?? ''}>
      {status === 'loading' && (
        <p className="flex items-center gap-2 py-6 text-sm text-white/60"><Spinner className="size-4" /> Consultando a Wikipédia…</p>
      )}

      {status === 'notFound' && (
        <Notice tone="warning">Não há um artigo específico para “{term}” na Wikipédia em português.</Notice>
      )}

      {status === 'error' && (
        <div className="space-y-3">
          <Notice tone="error">Não foi possível consultar a Wikipédia. Verifique sua conexão.</Notice>
          <Button icon="refresh" onClick={retry} size="sm" variant="secondary">Tentar novamente</Button>
        </div>
      )}

      {status === 'success' && data && (
        <article className="space-y-3 pb-2">
          {data.thumbnail && (
            <img alt="" className="max-h-40 rounded-xl bg-white/5 object-contain" loading="lazy" src={data.thumbnail} />
          )}
          {data.description && <p className="text-xs font-semibold uppercase tracking-wide text-jovi-300">{data.description}</p>}
          <p className="text-sm leading-relaxed text-white/85">{data.extract}</p>
          <a
            className={`inline-flex items-center gap-1.5 rounded-full text-sm font-semibold text-jovi-300 hover:text-jovi-400 ${focusRing}`}
            href={data.url}
            rel="noreferrer"
            target="_blank"
          >
            Ler artigo completo <Icon name="external" size={15} />
          </a>
        </article>
      )}
    </Sheet>
  );
}
