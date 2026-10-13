import { useState } from 'react';
import { useToast } from '../../feedback/ToastContext.jsx';
import { useAutosave } from '../../hooks/useAutosave.js';
import { useExport } from '../../hooks/useExport.js';
import { countWords } from '../../lib/ocrText.js';
import Button from '../ui/Button.jsx';
import { ConfirmDialog, EmptyState, Notice, ProgressBar } from '../ui/Feedback.jsx';
import SaveStatus from './SaveStatus.jsx';

const LOW_CONFIDENCE = 60;

export default function TextPanel({ capture, job, onCancel, onSave, onStart }) {
  const { showNotification } = useToast();
  const { copyText } = useExport();
  const [confirmRedo, setConfirmRedo] = useState(false);
  const { draft, setDraft, status } = useAutosave(capture.text, onSave);

  if (job) {
    return (
      <div className="space-y-4 py-4">
        <ProgressBar label={job.stage} value={job.progress} />
        <p className="text-sm text-white/55">O reconhecimento acontece no seu aparelho. Você pode sair desta tela — o resultado fica salvo na captura.</p>
        <Button onClick={onCancel} size="sm" variant="secondary">Cancelar</Button>
      </div>
    );
  }

  if (capture.ocrStatus === 'idle') {
    return (
      <EmptyState description="Transforme o texto da imagem em texto editável, pesquisável e pronto para resumir." icon="text" title="Nenhum texto extraído ainda">
        <Button icon="sparkles" onClick={onStart}>Extrair texto (OCR)</Button>
        <Button onClick={() => onSave('')} variant="secondary">Digitar manualmente</Button>
      </EmptyState>
    );
  }

  if (capture.ocrStatus === 'error') {
    return (
      <div className="space-y-4 py-4">
        <Notice tone="error">{capture.ocrError ?? 'O reconhecimento de texto falhou.'}</Notice>
        <div className="flex flex-wrap gap-2">
          <Button icon="refresh" onClick={onStart}>Tentar novamente</Button>
          <Button onClick={() => onSave('')} variant="secondary">Digitar manualmente</Button>
        </div>
      </div>
    );
  }

  if (capture.ocrStatus === 'empty') {
    return (
      <EmptyState description="Dicas: aproxime a câmera, evite reflexos e sombras, use boa luz ou o modo Documento." icon="search" title="Não encontramos texto legível">
        <Button icon="refresh" onClick={onStart}>Tentar novamente</Button>
        <Button onClick={() => onSave('')} variant="secondary">Digitar manualmente</Button>
      </EmptyState>
    );
  }

  const handleCopy = async () => {
    try {
      await copyText(draft);
      showNotification('Texto copiado');
    } catch {
      showNotification('Não foi possível copiar o texto.', { tone: 'error' });
    }
  };

  return (
    <div className="space-y-3 py-2">
      {capture.ocrConfidence !== null && capture.ocrConfidence < LOW_CONFIDENCE && (
        <Notice tone="warning">A leitura teve baixa confiança ({capture.ocrConfidence}%). Revise o texto antes de usar.</Notice>
      )}
      <label className="block">
        <span className="sr-only">Texto extraído</span>
        <textarea
          className="min-h-72 w-full resize-y rounded-2xl border border-white/12 bg-white/5 p-4 text-sm leading-relaxed text-white outline-none placeholder:text-white/35 focus:border-jovi-400"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Digite ou cole o texto desta captura…"
          value={draft}
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-white/45">
          {countWords(draft)} palavras
          {capture.ocrConfidence !== null && ` · confiança do OCR ${capture.ocrConfidence}%`}
          {' · '}<SaveStatus status={status} />
        </span>
        <div className="flex gap-2">
          <Button disabled={!draft} icon="copy" onClick={handleCopy} size="sm" variant="secondary">Copiar</Button>
          {capture.kind === 'photo' && (
            <Button icon="refresh" onClick={() => (draft ? setConfirmRedo(true) : onStart())} size="sm" variant="secondary">Refazer OCR</Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        confirmLabel="Substituir texto"
        description="O texto atual, incluindo suas correções, será substituído pela nova leitura."
        onCancel={() => setConfirmRedo(false)}
        onConfirm={() => {
          setConfirmRedo(false);
          onStart();
        }}
        open={confirmRedo}
        title="Refazer o OCR?"
      />
    </div>
  );
}
