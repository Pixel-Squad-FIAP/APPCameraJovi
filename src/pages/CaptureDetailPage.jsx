import { useCallback, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import ExportSheet from '../components/capture/ExportSheet.jsx';
import NotesPanel from '../components/capture/NotesPanel.jsx';
import OrganizePanel from '../components/capture/OrganizePanel.jsx';
import SummaryPanel from '../components/capture/SummaryPanel.jsx';
import TextPanel from '../components/capture/TextPanel.jsx';
import Button, { focusRing, IconButton } from '../components/ui/Button.jsx';
import { ConfirmDialog, EmptyState, Spinner } from '../components/ui/Feedback.jsx';
import Icon from '../components/ui/Icon.jsx';
import { getMode } from '../data/modes.js';
import { useToast } from '../feedback/ToastContext.jsx';
import { useCaptureMedia } from '../hooks/useCaptureMedia.js';
import { formatLongDate } from '../lib/format.js';
import { useCaptureLibrary } from '../library/LibraryContext.jsx';

const PHOTO_TABS = [
  { id: 'texto', label: 'Texto', icon: 'text' },
  { id: 'resumo', label: 'Resumo', icon: 'sparkles' },
  { id: 'notas', label: 'Notas', icon: 'note' },
  { id: 'organizar', label: 'Organizar', icon: 'folder' }
];
const VIDEO_TABS = PHOTO_TABS.filter((tab) => tab.id === 'notas' || tab.id === 'organizar');

function MediaView({ capture, media }) {
  if (media.loading) {
    return <div className="grid size-full place-items-center"><Spinner /></div>;
  }
  if (media.error || !media.url) {
    return <EmptyState description="O arquivo desta captura não está mais disponível." icon="alert" title="Mídia não encontrada" />;
  }
  if (capture.kind === 'video') {
    return <video className="size-full object-contain" controls playsInline src={media.url} />;
  }
  return (
    <a aria-label="Abrir imagem em tamanho real" className={`block size-full ${focusRing}`} href={media.url} rel="noreferrer" target="_blank">
      <img alt={capture.text ? `Captura: ${capture.title}` : capture.title} className="size-full object-contain" src={media.url} />
    </a>
  );
}

export default function CaptureDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { showNotification } = useToast();
  const { captures, status, updateCapture, removeCapture, restoreCapture, ocrJobs, startOcr, cancelOcr } = useCaptureLibrary();
  const capture = captures.find((item) => item.id === id);
  const media = useCaptureMedia(id);
  const [tab, setTab] = useState('texto');
  const [exportOpen, setExportOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const backTo = location.state?.fromCamera ? '/camera' : '/galeria';

  const saveText = useCallback((text) => updateCapture(id, { text, ocrStatus: 'done' }), [id, updateCapture]);
  const saveNotes = useCallback((notes) => updateCapture(id, { notes }), [id, updateCapture]);
  const saveTitle = useCallback((title) => {
    const value = title.trim();
    return value ? updateCapture(id, { title: value, titleAuto: false }) : Promise.resolve();
  }, [id, updateCapture]);

  if (status === 'loading') {
    return <div className="grid min-h-dvh place-items-center bg-ink-900 text-white"><Spinner /></div>;
  }

  if (!capture) {
    return (
      <div className="grid min-h-dvh place-items-center bg-ink-900 px-4 text-white">
        <EmptyState description="Ela pode ter sido excluída ou o link está incorreto." icon="search" title="Captura não encontrada">
          <Link className={`inline-flex min-h-11 items-center rounded-full bg-white/10 px-4 text-sm font-semibold hover:bg-white/15 ${focusRing}`} to="/galeria">Ir para a Galeria</Link>
        </EmptyState>
      </div>
    );
  }

  const tabs = capture.kind === 'video' ? VIDEO_TABS : PHOTO_TABS;
  const activeTab = tabs.some((item) => item.id === tab) ? tab : tabs[0].id;
  const job = ocrJobs[capture.id];

  const handleDelete = async () => {
    setConfirmDelete(false);
    const removed = await removeCapture(capture.id);
    navigate('/galeria', { replace: true });
    if (removed) {
      showNotification('Captura excluída', { action: { label: 'Desfazer', onClick: () => restoreCapture(removed) } });
    }
  };

  const handleAlbumChange = async (album) => {
    if (album === capture.album) return;
    await updateCapture(capture.id, { album });
    showNotification(`Movida para ${album}`, { tone: 'success' });
  };

  return (
    <div className="min-h-dvh bg-ink-900 text-white">
      <header className="sticky top-0 z-30 border-b border-white/8 bg-ink-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-2 py-2 sm:px-4">
          <Link aria-label={backTo === '/camera' ? 'Voltar para a câmera' : 'Voltar para a galeria'} className={`grid size-11 place-items-center rounded-full hover:bg-white/10 ${focusRing}`} to={backTo}>
            <Icon name="back" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold sm:text-lg">{capture.title}</h1>
            <p className="truncate text-xs text-white/50">{getMode(capture.mode).label} · {capture.album} · {formatLongDate(capture.createdAt)}</p>
          </div>
          <span className="hidden sm:block">
            <Button icon="share" onClick={() => setExportOpen(true)} size="sm" variant="secondary">Exportar</Button>
          </span>
          <span className="sm:hidden">
            <IconButton icon="share" label="Exportar" onClick={() => setExportOpen(true)} />
          </span>
          <IconButton icon="trash" label="Excluir captura" onClick={() => setConfirmDelete(true)} />
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-8">
        <section aria-label="Mídia" className="h-[42vh] overflow-hidden rounded-2xl bg-black sm:h-[52vh] lg:sticky lg:top-24 lg:h-[calc(100dvh-8rem)]">
          <MediaView capture={capture} media={media} />
        </section>

        <section aria-label="Conteúdo da captura" className="min-w-0">
          <div aria-label="Seções" className="grid grid-flow-col gap-1 rounded-2xl bg-white/5 p-1" role="tablist">
            {tabs.map((item) => (
              <button
                aria-controls={`panel-${item.id}`}
                aria-selected={activeTab === item.id}
                className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-semibold transition-colors ${activeTab === item.id ? 'bg-white text-ink-900' : 'text-white/70 hover:text-white'} ${focusRing}`}
                id={`tab-${item.id}`}
                key={item.id}
                onClick={() => setTab(item.id)}
                role="tab"
                type="button"
              >
                <Icon className="hidden sm:block" name={item.icon} size={16} />
                <span>{item.label}</span>
                {item.id === 'texto' && job && <Spinner className="size-3" />}
              </button>
            ))}
          </div>

          <div aria-labelledby={`tab-${activeTab}`} className="mt-3" id={`panel-${activeTab}`} role="tabpanel">
            {activeTab === 'texto' && (
              <TextPanel
                capture={capture}
                job={job}
                key={capture.id}
                onCancel={() => cancelOcr(capture.id)}
                onSave={saveText}
                onStart={() => startOcr(capture.id)}
              />
            )}
            {activeTab === 'resumo' && (
              <SummaryPanel
                capture={capture}
                key={capture.id}
                onGoToText={() => setTab('texto')}
                onSave={(summary) => updateCapture(capture.id, { summary })}
              />
            )}
            {activeTab === 'notas' && <NotesPanel capture={capture} key={capture.id} onSave={saveNotes} />}
            {activeTab === 'organizar' && (
              <OrganizePanel capture={capture} key={capture.id} onAlbumChange={handleAlbumChange} onTitleSave={saveTitle} />
            )}
          </div>
        </section>
      </main>

      <ExportSheet capture={capture} mediaBlob={media.blob} onClose={() => setExportOpen(false)} open={exportOpen} />
      <ConfirmDialog
        confirmLabel="Excluir"
        description="A captura, o texto, o resumo e as anotações serão removidos deste aparelho. Você poderá desfazer logo em seguida."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        open={confirmDelete}
        title="Excluir esta captura?"
      />
    </div>
  );
}
