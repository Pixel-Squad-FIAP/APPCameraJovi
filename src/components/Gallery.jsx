import { useEffect, useMemo, useState } from 'react';
import { saveStoredCapture, updateStoredCapture } from '../services/captureStorage.js';
import { exportDocumentAsDocx } from '../services/documentExport.js';
import { createExtractiveSummary } from '../services/studentSummary.js';

function createCaptureId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `capture-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getDocumentTitle(capture) {
  if (capture.title?.trim()) return capture.title.trim();
  if (capture.source === 'created') return 'Documento criado';
  return `Documento ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(capture.createdAt))}`;
}

export function getDocumentText(capture) {
  return capture?.documentText ?? capture?.ocrText ?? '';
}

function getCaptureKind(capture) {
  if (capture.kind === 'document') return 'document';
  if (capture.kind === 'panorama') return 'panorama';
  if (capture.mimeType?.startsWith('video/')) return 'video';
  return 'photo';
}

function useCaptureObjectUrls(userCaptures) {
  const [captureItems, setCaptureItems] = useState([]);

  useEffect(() => {
    const nextItems = userCaptures.map((capture) => {
      const kind = getCaptureKind(capture);
      const displayBlob = kind === 'document' && capture.processedBlob ? capture.processedBlob : capture.blob;
      const url = displayBlob ? URL.createObjectURL(displayBlob) : '';

      return {
        ...capture,
        displayText: kind === 'document' ? getDocumentText(capture) : '',
        displayTitle: kind === 'document' ? getDocumentTitle(capture) : '',
        kind,
        url
      };
    });

    setCaptureItems(nextItems);

    return () => {
      nextItems.forEach((capture) => {
        if (capture.url) URL.revokeObjectURL(capture.url);
      });
    };
  }, [userCaptures]);

  return captureItems;
}

function formatCaptureDate(capture) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit'
  }).format(new Date(capture.createdAt));
}

export default function Gallery({
  documentOcrState = { captureId: '', message: '', progress: null, status: 'idle' },
  isOpen,
  onCaptureCreated,
  onCaptureUpdated,
  onClose,
  onRecognizeDocument,
  userCaptures = []
}) {
  const captureItems = useCaptureObjectUrls(userCaptures);
  const mediaItems = captureItems.filter((capture) => capture.kind !== 'document');
  const [slideIndex, setSlideIndex] = useState(0);
  const [workspaceCaptureId, setWorkspaceCaptureId] = useState('');
  const [creatingDocument, setCreatingDocument] = useState(false);
  const selectedSlide = mediaItems[slideIndex] || mediaItems[0] || null;
  const workspaceCapture = workspaceCaptureId
    ? captureItems.find((capture) => capture.id === workspaceCaptureId) || null
    : null;

  useEffect(() => {
    if (slideIndex > mediaItems.length - 1) {
      setSlideIndex(Math.max(0, mediaItems.length - 1));
    }
  }, [mediaItems.length, slideIndex]);

  const showPreviousSlide = () => {
    if (mediaItems.length === 0) return;
    setSlideIndex((current) => (current === 0 ? mediaItems.length - 1 : current - 1));
  };

  const showNextSlide = () => {
    if (mediaItems.length === 0) return;
    setSlideIndex((current) => (current === mediaItems.length - 1 ? 0 : current + 1));
  };

  const openCapture = (capture) => {
    if (capture.kind === 'document') {
      setWorkspaceCaptureId(capture.id);
      setCreatingDocument(false);
      return;
    }

    const selectedIndex = mediaItems.findIndex((item) => item.id === capture.id);
    if (selectedIndex >= 0) setSlideIndex(selectedIndex);
  };

  const handleCreateDocument = () => {
    setCreatingDocument(true);
    setWorkspaceCaptureId('');
  };

  const hasWorkspace = creatingDocument || workspaceCapture;

  return (
    <div id="gallery-overlay" className={`gallery-overlay ${isOpen ? 'show' : ''}`} aria-hidden={!isOpen}>
      <div className="gallery-header">
        <button className="gallery-close" id="gallery-close" onClick={onClose} aria-label="Fechar galeria">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <span>{hasWorkspace ? 'Documento' : 'Galeria'}</span>
        {!hasWorkspace && (
          <button className="gallery-new-document" type="button" onClick={handleCreateDocument}>
            Novo documento
          </button>
        )}
      </div>

      {hasWorkspace ? (
        <DocumentWorkspace
          capture={workspaceCapture}
          documentOcrState={documentOcrState}
          isCreating={creatingDocument}
          onBack={() => {
            setCreatingDocument(false);
            setWorkspaceCaptureId('');
          }}
          onCaptureCreated={(capture) => {
            onCaptureCreated?.(capture);
            setCreatingDocument(false);
            setWorkspaceCaptureId(capture.id);
          }}
          onCaptureUpdated={onCaptureUpdated}
          onRecognizeDocument={onRecognizeDocument}
        />
      ) : (
        <>
          <div className="slideshow-container">
            {selectedSlide ? (
              <div className="slide fade" style={{ display: 'block' }}>
                {selectedSlide.kind === 'video' ? (
                  <video controls playsInline preload="metadata" src={selectedSlide.url}>
                    Seu navegador não consegue reproduzir este vídeo.
                  </video>
                ) : (
                  <img src={selectedSlide.url} alt={selectedSlide.kind === 'panorama' ? 'Panorâmica real capturada pela câmera' : 'Foto real capturada pela câmera'} />
                )}
              </div>
            ) : (
              <p className="gallery-empty-state">Nenhuma foto, vídeo ou panorâmica criada ainda.</p>
            )}

            {mediaItems.length > 1 && (
              <>
                <a className="prev" id="prev-slide" onClick={showPreviousSlide} role="button" tabIndex="0" aria-label="Slide anterior">
                  &#10094;
                </a>
                <a className="next" id="next-slide" onClick={showNextSlide} role="button" tabIndex="0" aria-label="Próximo slide">
                  &#10095;
                </a>
              </>
            )}
          </div>

          {mediaItems.length > 1 && (
            <div className="slideshow-dots" id="slideshow-dots">
              {mediaItems.map((capture, index) => (
                <span
                  className={`dot ${index === slideIndex ? 'active' : ''}`}
                  key={capture.id}
                  onClick={() => setSlideIndex(index)}
                  role="button"
                  tabIndex="0"
                  aria-label={`Mostrar item ${index + 1}`}
                />
              ))}
            </div>
          )}

          <section className="user-captures" aria-labelledby="user-captures-title">
            <div className="study-captures-header">
              <span id="user-captures-title">Seus arquivos</span>
            </div>

            {captureItems.length === 0 ? (
              <p className="study-captures-status">Nenhum arquivo criado ainda.</p>
            ) : (
              <div className="user-captures-list">
                {captureItems.map((capture) => (
                  <CaptureCard capture={capture} key={capture.id} onOpen={() => openCapture(capture)} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function CaptureCard({ capture, onOpen }) {
  const label = {
    document: 'Documento',
    panorama: 'Panorâmica',
    photo: 'Foto',
    video: 'Vídeo'
  }[capture.kind];

  return (
    <article className={`user-capture-card ${capture.kind === 'document' && !capture.url ? 'is-text-document' : ''}`} onClick={onOpen}>
      <div className="user-capture-preview">
        {capture.kind === 'video' && (
          <>
            <video muted playsInline preload="metadata" src={capture.url} />
            <span className="user-capture-badge">Vídeo</span>
          </>
        )}
        {capture.kind !== 'video' && capture.url && (
          <>
            <img src={capture.url} alt={`${label} criado na JOVI`} />
            <span className="user-capture-badge">{label}</span>
          </>
        )}
        {capture.kind === 'document' && !capture.url && (
          <div className="text-document-preview">
            <strong>{capture.displayTitle}</strong>
            <p>{capture.displayText || 'Documento vazio'}</p>
            <span className="user-capture-badge">Documento</span>
          </div>
        )}
      </div>
      <time dateTime={capture.createdAt}>{formatCaptureDate(capture)}</time>
    </article>
  );
}

export function DocumentWorkspace({
  backLabel = 'Voltar',
  capture,
  documentOcrState,
  isCreating,
  modeContext = 'document',
  onBack,
  onCaptureCreated,
  onCaptureUpdated,
  onRecognizeDocument,
  showNotification = () => {}
}) {
  const [activeTab, setActiveTab] = useState(capture?.url ? 'image' : 'text');
  const [annotation, setAnnotation] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setTitle(capture ? getDocumentTitle(capture) : '');
    setText(capture ? getDocumentText(capture) : '');
    setAnnotation(capture?.annotation || '');
    setActiveTab(capture?.url ? 'image' : 'text');
    setStatus('');
    setDirty(false);
  }, [capture, isCreating]);

  const handleSave = async () => {
    const trimmedTitle = title.trim() || 'Documento sem titulo';
    const nextText = text.trim();

    if (isCreating) {
      const now = new Date().toISOString();
      const newCapture = {
        id: createCaptureId(),
        createdAt: now,
        documentText: nextText,
        kind: 'document',
        source: 'created',
        title: trimmedTitle,
        updatedAt: now
      };
      await saveStoredCapture(newCapture);
      onCaptureCreated?.(newCapture);
      setStatus('Salvo');
      setDirty(false);
      return;
    }

    if (!capture) return;

    const previousText = getDocumentText(capture).trim();
    const textChanged = previousText !== nextText;
    const patch = {
      annotation: annotation.trim(),
      documentText: nextText,
      title: trimmedTitle,
      updatedAt: new Date().toISOString()
    };

    if (textChanged) {
      patch.summary = '';
      patch.summaryGeneratedAt = '';
      patch.summaryNeedsUpdate = true;
    }

    const updatedCapture = await updateStoredCapture(capture.id, patch);
    onCaptureUpdated?.(updatedCapture);
    setStatus('Alterações salvas');
    setDirty(false);
  };

  const handleRecognize = () => {
    if (!capture || !onRecognizeDocument) return;
    onRecognizeDocument(capture).catch(() => {});
  };

  const handleSummary = async () => {
    if (!capture) return;
    const sourceText = text.trim() || getDocumentText(capture);
    const summary = createExtractiveSummary(sourceText);
    if (!summary) {
      showNotification('Não há texto suficiente para resumir.');
      return;
    }
    const updatedCapture = await updateStoredCapture(capture.id, {
      documentText: sourceText,
      summary,
      summaryGeneratedAt: new Date().toISOString(),
      summaryNeedsUpdate: false,
      updatedAt: new Date().toISOString()
    });
    onCaptureUpdated?.(updatedCapture);
    setStatus('Resumo gerado');
    showNotification('Resumo gerado.');
  };

  const handleExportDocx = async () => {
    if (isCreating) {
      showNotification('Salve o documento antes de exportar.');
      return;
    }
    if (!capture) return;
    const updatedCapture = await updateStoredCapture(capture.id, {
      annotation: annotation.trim(),
      documentText: text.trim() || getDocumentText(capture),
      title: title.trim() || getDocumentTitle(capture),
      updatedAt: new Date().toISOString()
    });
    onCaptureUpdated?.(updatedCapture);
    await exportDocumentAsDocx(updatedCapture);
    setStatus('DOCX gerado');
    showNotification('DOCX gerado.');
  };

  const isOcrProcessing = Boolean(
    capture
    && documentOcrState.captureId === capture.id
    && documentOcrState.status === 'processing'
  );
  const hasImage = Boolean(capture?.url);
  const originalOcrText = capture?.ocrText || '';
  const lowConfidence = Number.isFinite(capture?.ocrConfidence) && capture.ocrConfidence < 65;
  const showStudentActions = modeContext === 'student' || capture?.source === 'student';

  return (
    <section className="document-workspace">
      <div className="document-workspace-toolbar">
        <button type="button" onClick={onBack}>{backLabel}</button>
        <span>{dirty ? 'Alterações não salvas' : status}</span>
        <button type="button" onClick={handleSave}>Salvar</button>
      </div>

      <label className="document-workspace-title">
        <span>Título</span>
        <input
          onChange={(event) => {
            setTitle(event.target.value);
            setDirty(true);
          }}
          placeholder="Título do documento"
          value={title}
        />
      </label>

      <div className="document-workspace-tabs">
        {hasImage && (
          <button className={activeTab === 'image' ? 'active' : ''} type="button" onClick={() => setActiveTab('image')}>
            Imagem
          </button>
        )}
        <button className={activeTab === 'text' ? 'active' : ''} type="button" onClick={() => setActiveTab('text')}>
          Texto
        </button>
        <button className={activeTab === 'notes' ? 'active' : ''} type="button" onClick={() => setActiveTab('notes')}>
          Estudo
        </button>
      </div>

      {!isCreating && (
        <div className="document-workspace-actions">
          {capture?.blob && (
            <button disabled={isOcrProcessing} type="button" onClick={handleRecognize}>
              {capture.ocrStatus === 'done' ? 'Refazer OCR' : 'Digitalizar texto'}
            </button>
          )}
          <button disabled={!text.trim() && !getDocumentText(capture).trim()} type="button" onClick={handleSummary}>
            Resumir
          </button>
          <button type="button" onClick={() => setActiveTab('notes')}>Anotar</button>
          <button type="button" onClick={handleExportDocx}>Exportar DOCX</button>
        </div>
      )}

      {activeTab === 'image' && hasImage && (
        <div className="document-image-pane">
          <img src={capture.url} alt="Documento digitalizado" />
        </div>
      )}

      {activeTab === 'text' && (
        <div className="document-text-pane">
          {originalOcrText && (
            <details>
              <summary>Texto original do OCR</summary>
              <p>{originalOcrText}</p>
            </details>
          )}
          {lowConfidence && (
            <p className="document-workspace-status">Alguns trechos podem precisar de correção.</p>
          )}
          {isOcrProcessing && <p className="document-workspace-status">{documentOcrState.message}</p>}
          {!isCreating && capture?.blob && capture?.ocrStatus !== 'done' && (
            <button className="document-secondary-action" type="button" onClick={handleRecognize}>
              {capture.ocrStatus === 'error' ? 'Tentar OCR novamente' : 'Reconhecer texto'}
            </button>
          )}
          <textarea
            onChange={(event) => {
              setText(event.target.value);
              setDirty(true);
            }}
            placeholder="Escreva ou corrija o texto do documento..."
            value={text}
          />
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="document-text-pane">
          <div className="document-summary-card">
            <strong>Resumo</strong>
            <p>{capture?.summary || 'Gere o resumo pelo Modo Estudante após salvar o texto.'}</p>
            {capture?.summaryNeedsUpdate && <span>Resumo precisa ser atualizado após a edição.</span>}
          </div>
          <div className="document-summary-card">
            <strong>Anotação</strong>
            <textarea
              onChange={(event) => {
                setAnnotation(event.target.value);
                setDirty(true);
              }}
              placeholder={showStudentActions ? 'Anote seus pontos de estudo...' : 'Adicione uma anotação para este documento...'}
              value={annotation}
            />
          </div>
        </div>
      )}
    </section>
  );
}
