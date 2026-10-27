import { useEffect, useRef } from 'react';
import { useToast } from '../../feedback/ToastContext.jsx';
import { useLibrarySync } from '../../hooks/useLibrarySync.js';
import { LibraryFormatError } from '../../services/libraryTransfer.js';
import { DesktopError, desktopUrl } from '../../services/syncApi.js';
import { ExportOption } from '../capture/ExportSheet.jsx';
import { IconButton } from '../ui/Button.jsx';
import { Notice, Spinner } from '../ui/Feedback.jsx';
import Sheet from '../ui/Sheet.jsx';

function describeReport({ created, updated, unchanged, skipped }) {
  const parts = [`${created} nova(s)`, `${updated} atualizada(s)`, `${unchanged} sem mudança`];
  if (skipped) parts.push(`${skipped} ignorada(s)`);
  return parts.join(' · ');
}

function DesktopStatus({ desktop, onRefresh, port }) {
  const { status, info } = desktop;
  const online = status === 'online';
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${online ? 'bg-emerald-400' : status === 'checking' ? 'bg-amber-300' : 'bg-white/30'}`} />
      <div className="min-w-0 flex-1 text-sm">
        {status === 'checking' && <p className="flex items-center gap-2 text-white/70"><Spinner className="size-3.5" /> Procurando o JOVI Desktop…</p>}
        {online && (
          <>
            <p className="font-semibold">JOVI Desktop conectado</p>
            <p className="text-xs text-white/55">{info?.capturas ?? 0} capturas no computador · {desktopUrl(port)}</p>
          </>
        )}
        {(status === 'offline' || status === 'unknown') && (
          <>
            <p className="font-semibold">JOVI Desktop não encontrado</p>
            <p className="mt-0.5 text-xs leading-relaxed text-white/55">
              No computador, rode <code className="rounded bg-white/10 px-1">python python/main.py --servidor</code> (ou menu 6 › 3) e toque em atualizar.
              Se o navegador pedir acesso à rede local, permita.
            </p>
          </>
        )}
      </div>
      <IconButton className="-my-1.5 -mr-1.5" disabled={status === 'checking'} icon="refresh" label="Procurar de novo" onClick={onRefresh} size={18} />
    </div>
  );
}

// Integração com o programa Python: sincronização pelo servidor local ou troca de arquivo JSON.
export default function SyncSheet({ onClose, open, port }) {
  const { showNotification } = useToast();
  const sync = useLibrarySync(port);
  const fileInputRef = useRef(null);
  const { checkDesktop } = sync;

  useEffect(() => {
    if (open) checkDesktop();
  }, [checkDesktop, open]);

  const handle = (action, successMessage) => async (...args) => {
    try {
      const result = await action(...args);
      showNotification(successMessage(result), { tone: 'success' });
    } catch (error) {
      const known = error instanceof LibraryFormatError || error instanceof DesktopError;
      showNotification(known ? error.message : 'Não foi possível concluir. Verifique se o JOVI Desktop está aberto.', { tone: 'error' });
      if (!known) checkDesktop();
    }
  };

  const syncNow = handle(sync.syncWithDesktop, (result) => `Sincronizado: ${describeReport(result)}`);
  const exportFile = handle(sync.exportLibrary, (total) => `Biblioteca exportada (${total} capturas)`);
  const importFile = handle(sync.importLibrary, (result) => `Importado: ${describeReport(result)}`);

  return (
    <Sheet
      description="Leve suas capturas para o JOVI Desktop (Python) e traga de volta resumos, anotações, álbuns e documentos."
      onClose={onClose}
      open={open}
      title="Sincronizar"
    >
      <div className="space-y-4">
        <DesktopStatus desktop={sync.desktop} onRefresh={checkDesktop} port={port} />

        <ul className="-mx-2 space-y-1">
          <ExportOption
            busy={sync.busy === 'sync'}
            description={sync.desktop.status === 'online' ? 'Envia e recebe as alterações numa só vez' : 'Abra o servidor do JOVI Desktop primeiro'}
            disabled={sync.desktop.status !== 'online' || Boolean(sync.busy)}
            icon="refresh"
            label="Sincronizar com o JOVI Desktop"
            onClick={syncNow}
          />
          <ExportOption
            busy={sync.busy === 'export'}
            description="Arquivo .json para importar no JOVI Desktop (menu 6 › 1)"
            disabled={Boolean(sync.busy)}
            icon="download"
            label="Exportar biblioteca"
            onClick={exportFile}
          />
          <ExportOption
            busy={sync.busy === 'import'}
            description="Arquivo .json gerado pelo JOVI Desktop (menu 6 › 2)"
            disabled={Boolean(sync.busy)}
            icon="upload"
            label="Importar biblioteca"
            onClick={() => fileInputRef.current?.click()}
          />
        </ul>
        <input
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => {
            const [file] = event.target.files;
            event.target.value = '';
            if (file) importFile(file);
          }}
          ref={fileInputRef}
          type="file"
        />

        {sync.report && <Notice icon="check">Última sincronização: {describeReport(sync.report)}.</Notice>}
        <p className="text-xs leading-relaxed text-white/45">
          Vence sempre a edição mais recente. Documentos criados no JOVI Desktop chegam com uma capa gerada; o que você excluir aqui vai para a lixeira do JOVI Desktop.
        </p>
      </div>
    </Sheet>
  );
}
