import { useState } from 'react';
import { useToast } from '../../feedback/ToastContext.jsx';
import { buildPlainText, useExport } from '../../hooks/useExport.js';
import { focusRing } from '../ui/Button.jsx';
import { Spinner } from '../ui/Feedback.jsx';
import Icon from '../ui/Icon.jsx';
import Sheet from '../ui/Sheet.jsx';

function ExportOption({ busy, description, disabled, icon, label, onClick }) {
  return (
    <li>
      <button
        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${focusRing}`}
        disabled={disabled || busy}
        onClick={onClick}
        type="button"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/8 text-white/85">
          {busy ? <Spinner className="size-4" /> : <Icon name={icon} size={20} />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{label}</span>
          <span className="block text-xs text-white/55">{description}</span>
        </span>
      </button>
    </li>
  );
}

export default function ExportSheet({ capture, mediaBlob, onClose, open }) {
  const { showNotification } = useToast();
  const exporter = useExport();
  const [busy, setBusy] = useState(null);
  const hasContent = Boolean(capture.text || capture.notes || capture.summary);
  const isPhoto = capture.kind === 'photo';

  const run = (id, action, successMessage) => async () => {
    setBusy(id);
    try {
      const done = await action();
      if (done !== false && successMessage) showNotification(successMessage, { tone: 'success' });
      if (done !== false) onClose();
    } catch {
      showNotification('Não foi possível concluir a exportação.', { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet description="Os arquivos são gerados no próprio aparelho." onClose={onClose} open={open} title="Exportar">
      <ul className="-mx-2 space-y-1">
        <ExportOption
          busy={busy === 'pdf'}
          description={isPhoto ? 'Imagem + resumo + texto + anotações' : 'Resumo, texto e anotações'}
          icon="file"
          label="Baixar PDF"
          onClick={run('pdf', () => exporter.exportPdf(capture, mediaBlob), 'PDF gerado')}
        />
        <ExportOption
          busy={busy === 'txt'}
          description={hasContent ? 'Texto puro, abre em qualquer editor' : 'Extraia o texto ou escreva uma anotação primeiro'}
          disabled={!hasContent}
          icon="text"
          label="Baixar texto (.txt)"
          onClick={run('txt', () => exporter.exportText(capture), 'Arquivo .txt baixado')}
        />
        <ExportOption
          busy={busy === 'media'}
          description={isPhoto ? 'Arquivo JPG original' : 'Arquivo de vídeo original'}
          disabled={!mediaBlob}
          icon="download"
          label={isPhoto ? 'Baixar imagem' : 'Baixar vídeo'}
          onClick={run('media', () => exporter.exportMedia(capture, mediaBlob), 'Download iniciado')}
        />
        <ExportOption
          busy={busy === 'copy'}
          description="Título, resumo, texto e anotações"
          disabled={!hasContent}
          icon="copy"
          label="Copiar tudo"
          onClick={run('copy', () => exporter.copyText(buildPlainText(capture)), 'Conteúdo copiado')}
        />
        <ExportOption
          busy={busy === 'docs'}
          description="Copia o conteúdo e abre um documento novo — é só colar (Ctrl+V)"
          disabled={!hasContent}
          icon="external"
          label="Abrir no Google Docs"
          onClick={run('docs', () => exporter.openInGoogleDocs(capture), 'Conteúdo copiado — cole no Google Docs')}
        />
        {exporter.canShare && (
          <ExportOption
            busy={busy === 'share'}
            description="WhatsApp, e-mail, Drive e outros apps do aparelho"
            icon="share"
            label="Compartilhar…"
            onClick={run('share', () => exporter.share(capture, mediaBlob))}
          />
        )}
      </ul>
    </Sheet>
  );
}
