import { useEffect, useMemo, useState } from 'react';
import { saveStoredCapture, updateStoredCapture } from '../services/captureStorage.js';
import { exportDocumentAsDocx, exportDocumentAsPdf } from '../services/documentExport.js';
import {
  getCombinedDocumentText,
  getDocumentPages,
  getPageText,
  getPrimaryDocumentBlob,
  replaceDocumentPage
} from '../services/documentModel.js';
import { getInitialDocumentCorners, rectifyDocumentImage } from '../services/documentProcessing.js';
import { createAcademicAnalysis } from '../services/studentSummary.js';

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
  return getCombinedDocumentText(capture);
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
      const displayBlob = kind === 'document' ? getPrimaryDocumentBlob(capture) : capture.blob;
      const url = displayBlob ? URL.createObjectURL(displayBlob) : '';

      return {
        ...capture,
        displayText: kind === 'document' ? getDocumentText(capture) : '',
        displayTitle: kind === 'document' ? getDocumentTitle(capture) : '',
        kind,
        pages: kind === 'document' ? getDocumentPages(capture) : [],
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
  onAddPageRequest,
  onBack,
  onCaptureCreated,
  onCaptureUpdated,
  onRecognizeDocument,
  showNotification = () => {}
}) {
  const pages = useMemo(() => getDocumentPages(capture), [capture]);
  const [activePageId, setActivePageId] = useState('');
  const activePage = pages.find((page) => page.id === activePageId) || pages[0] || null;
  const [activeTab, setActiveTab] = useState(pages.length > 0 ? 'image' : 'text');
  const [annotation, setAnnotation] = useState('');
  const [corners, setCorners] = useState([]);
  const [pageText, setPageText] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setTitle(capture ? getDocumentTitle(capture) : '');
    setAnnotation(capture?.annotation || '');
    setActivePageId(getDocumentPages(capture)[0]?.id || '');
    setActiveTab(getDocumentPages(capture).length > 0 ? 'image' : 'text');
    setStatus('');
    setDirty(false);
  }, [capture, isCreating]);

  useEffect(() => {
    setPageText(getPageText(activePage));
    setCorners(activePage?.corners || []);
  }, [activePage]);

  const handleSave = async () => {
    const trimmedTitle = title.trim() || 'Documento sem titulo';

    if (isCreating) {
      const now = new Date().toISOString();
      const newCapture = {
        id: createCaptureId(),
        createdAt: now,
        documentText: pageText.trim(),
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

    const textChanged = activePage && getPageText(activePage).trim() !== pageText.trim();
    const pagePatch = activePage ? replaceDocumentPage(capture, activePage.id, {
      documentText: pageText.trim()
    }) : {};
    const patch = {
      annotation: annotation.trim(),
      ...pagePatch,
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
    onRecognizeDocument(capture, activePage?.id).catch(() => {});
  };

  const handleAnalyze = async () => {
    if (!capture) return;
    const pagePatch = activePage ? replaceDocumentPage(capture, activePage.id, { documentText: pageText.trim() }) : {};
    const sourceText = pageText.trim() || getCombinedDocumentText({ ...capture, ...pagePatch });
    const summary = createAcademicAnalysis(sourceText);
    if (!summary) {
      showNotification('Não há texto suficiente para analisar.');
      return;
    }
    const updatedCapture = await updateStoredCapture(capture.id, {
      ...pagePatch,
      summary,
      summaryGeneratedAt: new Date().toISOString(),
      summaryNeedsUpdate: false,
      updatedAt: new Date().toISOString()
    });
    onCaptureUpdated?.(updatedCapture);
    setStatus('Análise gerada');
    showNotification('Análise acadêmica gerada.');
  };

  const persistBeforeExport = async () => {
    if (isCreating) {
      showNotification('Salve o documento antes de exportar.');
      return null;
    }
    if (!capture) return;
    const pagePatch = activePage ? replaceDocumentPage(capture, activePage.id, { documentText: pageText.trim() }) : {};
    const updatedCapture = await updateStoredCapture(capture.id, {
      ...pagePatch,
      annotation: annotation.trim(),
      title: title.trim() || getDocumentTitle(capture),
      updatedAt: new Date().toISOString()
    });
    onCaptureUpdated?.(updatedCapture);
    return updatedCapture;
  };

  const handleExportDocx = async () => {
    const updatedCapture = await persistBeforeExport();
    if (!updatedCapture) return;
    await exportDocumentAsDocx(updatedCapture);
    setStatus('DOCX gerado');
    showNotification('DOCX gerado.');
  };

  const handleExportPdf = async () => {
    const updatedCapture = await persistBeforeExport();
    if (!updatedCapture) return;
    await exportDocumentAsPdf(updatedCapture, { study: modeContext === 'student' });
    setStatus('PDF gerado');
    showNotification('PDF gerado.');
  };

  const handleApplyCrop = async () => {
    if (!capture || !activePage?.blob || corners.length !== 4) return;
    setStatus('Ajustando recorte...');
    const rectified = await rectifyDocumentImage(activePage.blob, corners);
    const updatedCapture = await updateStoredCapture(capture.id, {
      ...replaceDocumentPage(capture, activePage.id, {
        corners: rectified.corners,
        height: rectified.height,
        ocrStatus: 'pending',
        processedBlob: null,
        rectifiedBlob: rectified.blob,
        width: rectified.width
      }),
      summary: '',
      summaryNeedsUpdate: true,
      updatedAt: new Date().toISOString()
    });
    onCaptureUpdated?.(updatedCapture);
    setStatus('Recorte aplicado');
    showNotification('Página retificada.');
  };

  const handleDetectCorners = async () => {
    if (!activePage?.blob) return;
    const detected = await getInitialDocumentCorners(activePage.blob);
    setCorners(detected);
    setDirty(true);
  };

  const isOcrProcessing = Boolean(
    capture
    && documentOcrState.captureId === capture.id
    && documentOcrState.status === 'processing'
  );
  const hasImage = pages.length > 0;
  const lowConfidence = Number.isFinite(activePage?.ocrConfidence) && activePage.ocrConfidence < 65;
  const isStudent = modeContext === 'student' || capture?.source === 'student';

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
        {isStudent && (
          <button className={activeTab === 'notes' ? 'active' : ''} type="button" onClick={() => setActiveTab('notes')}>
            Estudo
          </button>
        )}
      </div>

      {pages.length > 1 && (
        <div className="document-page-strip">
          {pages.map((page, index) => (
            <button
              className={page.id === activePage?.id ? 'active' : ''}
              key={page.id}
              onClick={() => setActivePageId(page.id)}
              type="button"
            >
              Página {index + 1}
            </button>
          ))}
        </div>
      )}

      {!isCreating && (
        <div className="document-workspace-actions">
          {activePage?.blob && (
            <button disabled={isOcrProcessing} type="button" onClick={handleRecognize}>
              {activePage.ocrStatus === 'done' ? 'Refazer OCR' : 'Digitalizar texto'}
            </button>
          )}
          {hasImage && <button type="button" onClick={handleApplyCrop}>Aplicar recorte</button>}
          {isStudent && (
            <>
              <button disabled={!pageText.trim() && !getDocumentText(capture).trim()} type="button" onClick={handleAnalyze}>
                Resumir
              </button>
              <button type="button" onClick={() => setActiveTab('notes')}>Anotar</button>
            </>
          )}
          {!isStudent && hasImage && (
            <button type="button" onClick={() => onAddPageRequest?.(capture)}>
              Adicionar página
            </button>
          )}
          <button type="button" onClick={handleExportDocx}>Exportar DOCX</button>
          <button type="button" onClick={handleExportPdf}>Exportar PDF</button>
        </div>
      )}

      {activeTab === 'image' && hasImage && (
        <div className="document-image-pane">
          <CornerEditor
            capture={capture}
            corners={corners}
            onCornersChange={(nextCorners) => {
              setCorners(nextCorners);
              setDirty(true);
            }}
            onDetectCorners={handleDetectCorners}
            page={activePage}
          />
        </div>
      )}

      {activeTab === 'text' && (
        <div className="document-text-pane">
          {activePage?.ocrText && (
            <details>
              <summary>Texto original do OCR</summary>
              <p>{activePage.ocrText}</p>
            </details>
          )}
          {lowConfidence && (
            <p className="document-workspace-status">Alguns trechos podem precisar de correção.</p>
          )}
          {isOcrProcessing && <p className="document-workspace-status">{documentOcrState.message}</p>}
          {!isCreating && activePage?.blob && activePage?.ocrStatus !== 'done' && (
            <button className="document-secondary-action" type="button" onClick={handleRecognize}>
              {activePage.ocrStatus === 'error' ? 'Tentar OCR novamente' : 'Reconhecer texto'}
            </button>
          )}
          <textarea
            onChange={(event) => {
              setPageText(event.target.value);
              setDirty(true);
            }}
            placeholder="Escreva ou corrija o texto do documento..."
            value={pageText}
          />
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="document-text-pane">
          <div className="document-summary-card">
            <strong>Resumo</strong>
            <p>{capture?.summary || 'Gere a análise acadêmica a partir do texto reconhecido.'}</p>
            {capture?.summaryNeedsUpdate && <span>Resumo precisa ser atualizado após a edição.</span>}
          </div>
          <div className="document-summary-card">
            <strong>Anotação</strong>
            <textarea
              onChange={(event) => {
                setAnnotation(event.target.value);
                setDirty(true);
              }}
              placeholder="Anote seus pontos de estudo..."
              value={annotation}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function CornerEditor({ corners, onCornersChange, onDetectCorners, page }) {
  const [imageUrl, setImageUrl] = useState('');
  const [imageRect, setImageRect] = useState({ height: 1, width: 1 });
  const [dragIndex, setDragIndex] = useState(null);
  const blob = page?.rectifiedBlob || page?.blob;
  const naturalWidth = page?.width || 1;
  const naturalHeight = page?.height || 1;
  const safeCorners = corners.length === 4 ? corners : [
    { x: naturalWidth * 0.08, y: naturalHeight * 0.08 },
    { x: naturalWidth * 0.92, y: naturalHeight * 0.08 },
    { x: naturalWidth * 0.92, y: naturalHeight * 0.92 },
    { x: naturalWidth * 0.08, y: naturalHeight * 0.92 }
  ];

  useEffect(() => {
    if (!blob) {
      setImageUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(blob);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  const updateRect = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setImageRect({ height: rect.height, width: rect.width });
  };

  const movePoint = (event, index = dragIndex) => {
    if (index === null) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
    const nextCorners = safeCorners.map((point, pointIndex) => (
      pointIndex === index
        ? {
          x: Math.round((x / rect.width) * naturalWidth),
          y: Math.round((y / rect.height) * naturalHeight)
        }
        : point
    ));
    onCornersChange(nextCorners);
  };

  if (!imageUrl) {
    return <p className="gallery-empty-state">Este documento não possui imagem.</p>;
  }

  const points = safeCorners.map((point) => ({
    left: `${(point.x / naturalWidth) * 100}%`,
    top: `${(point.y / naturalHeight) * 100}%`
  }));

  return (
    <div className="corner-editor">
      <div className="corner-editor-actions">
        <button type="button" onClick={onDetectCorners}>Sugerir recorte</button>
        <span>Arraste os cantos e aplique o recorte.</span>
      </div>
      <div className="corner-editor-stage">
        <div
          className="corner-editor-frame"
          onPointerMove={(event) => movePoint(event)}
          onPointerUp={() => setDragIndex(null)}
          onPointerCancel={() => setDragIndex(null)}
        >
          <img
            alt="Página capturada para ajuste"
            onLoad={updateRect}
            src={imageUrl}
          />
          <svg className="corner-editor-polygon" viewBox={`0 0 ${imageRect.width} ${imageRect.height}`} preserveAspectRatio="none">
            <polygon
              points={safeCorners.map((point) => `${(point.x / naturalWidth) * imageRect.width},${(point.y / naturalHeight) * imageRect.height}`).join(' ')}
            />
          </svg>
          {points.map((style, index) => (
            <button
              aria-label={`Ajustar canto ${index + 1}`}
              className="corner-handle"
              key={index}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture?.(event.pointerId);
                setDragIndex(index);
                movePoint(event, index);
              }}
              style={style}
              type="button"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
