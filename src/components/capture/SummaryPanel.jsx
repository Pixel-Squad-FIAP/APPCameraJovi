import { useState } from 'react';
import { useToast } from '../../feedback/ToastContext.jsx';
import { useExport } from '../../hooks/useExport.js';
import { countWords } from '../../lib/ocrText.js';
import { keywordsInSummary, SUMMARY_LENGTHS, summarize, textFingerprint } from '../../lib/summarize.js';
import Button, { focusRing } from '../ui/Button.jsx';
import Chip from '../ui/Chip.jsx';
import { EmptyState, Notice } from '../ui/Feedback.jsx';
import Icon from '../ui/Icon.jsx';
import TermSheet from './TermSheet.jsx';

const MIN_WORDS = 25;

export default function SummaryPanel({ capture, onGoToText, onSave }) {
  const { showNotification } = useToast();
  const { copyText } = useExport();
  const [length, setLength] = useState(capture.summary?.length ?? 'curto');
  const [selectedTerm, setSelectedTerm] = useState(null);
  const words = countWords(capture.text);

  if (!capture.text) {
    return (
      <EmptyState description="O resumo é gerado a partir do texto extraído da imagem." icon="sparkles" title="Extraia o texto primeiro">
        <Button onClick={onGoToText} variant="secondary">Ir para Texto</Button>
      </EmptyState>
    );
  }

  const summary = capture.summary;
  const stale = summary && summary.fingerprint !== textFingerprint(capture.text);
  const tooShort = words < MIN_WORDS;

  const generate = () => {
    const result = summarize(capture.text, length);
    if (!result.sentences.length) {
      showNotification('Não há frases suficientes para resumir.', { tone: 'error' });
      return;
    }
    onSave({ ...result, length, fingerprint: textFingerprint(capture.text), createdAt: new Date().toISOString() });
  };

  const handleCopy = async () => {
    try {
      await copyText(summary.sentences.map((sentence) => `• ${sentence}`).join('\n'));
      showNotification('Resumo copiado');
    } catch {
      showNotification('Não foi possível copiar.', { tone: 'error' });
    }
  };

  return (
    <div className="space-y-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-white/60">Tamanho:</span>
        {Object.entries(SUMMARY_LENGTHS).map(([id, config]) => (
          <Chip active={length === id} key={id} onClick={() => setLength(id)}>{config.label}</Chip>
        ))}
        <Button className="ml-auto" disabled={tooShort} icon="sparkles" onClick={generate} size="sm">
          {summary ? 'Gerar novamente' : 'Gerar resumo'}
        </Button>
      </div>

      {tooShort && <Notice tone="warning">O texto tem só {words} palavras — curto demais para um resumo útil (mínimo {MIN_WORDS}).</Notice>}
      {stale && <Notice tone="warning">O texto mudou depois deste resumo. Gere novamente para atualizá-lo.</Notice>}

      {summary ? (
        <article className="rounded-2xl border border-jovi-400/20 bg-jovi-500/8 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-jovi-300">
            {summary.sentences.length} de {summary.sourceSentences} frases
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-white/90">
            {summary.sentences.map((sentence) => <li key={sentence}>{sentence}</li>)}
          </ul>
          {keywordsInSummary(summary).length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-white/50">Termos principais — toque para ver a explicação:</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {keywordsInSummary(summary).map((keyword) => (
                  <button
                    className={`inline-flex items-center gap-1 rounded-full bg-white/8 px-2.5 py-1 text-xs text-white/85 transition-colors hover:bg-jovi-500/25 hover:text-white ${focusRing}`}
                    key={keyword}
                    onClick={() => setSelectedTerm(keyword)}
                    type="button"
                  >
                    {keyword} <Icon name="help" size={12} />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button icon="copy" onClick={handleCopy} size="sm" variant="secondary">Copiar resumo</Button>
          </div>
        </article>
      ) : (
        !tooShort && <p className="text-sm text-white/55">Escolha o tamanho e gere um resumo com as frases mais importantes do texto.</p>
      )}

      <p className="text-xs text-white/40">
        Resumo extrativo: as frases são escolhidas do próprio texto pela frequência dos termos — nada é inventado. Funciona offline.
      </p>

      <TermSheet onClose={() => setSelectedTerm(null)} term={selectedTerm} />
    </div>
  );
}
