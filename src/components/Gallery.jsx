import { useEffect, useMemo, useRef, useState } from 'react';
import { saveStoredCapture, updateStoredCapture } from '../services/captureStorage.js';
import { exportDocumentAsDocx, exportDocumentAsPdf } from '../services/documentExport.js';
import {
  getCombinedDocumentText,
  getDocumentPages,
  getPageText,
  getPrimaryDocumentBlob,
  replaceDocumentPage
} from '../services/documentModel.js';
import { rectifyDocumentImage } from '../services/documentProcessing.js';
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
  initialPageId = '',
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
  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [pageText, setPageText] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('');
  const [dirty, setDirty] = useState(false);

  const isStudent = modeContext === 'student' || capture?.source === 'student';
  const pageIdsKey = pages.map((page) => page.id).join('|');

  useEffect(() => {
    setTitle(capture ? getDocumentTitle(capture) : '');
    setAnnotation(capture?.annotation || '');
    setActivePageId(initialPageId || getDocumentPages(capture)[0]?.id || '');
    setActiveTab(isStudent ? 'notes' : getDocumentPages(capture).length > 0 ? 'image' : 'text');
    setExportSheetOpen(false);
    setMoreOpen(false);
    setStatus('');
    setDirty(false);
  }, [capture?.id, initialPageId, isCreating, isStudent]);

  useEffect(() => {
    setActivePageId((currentPageId) => {
      if (currentPageId && pages.some((page) => page.id === currentPageId)) {
        return currentPageId;
      }
      return pages[0]?.id || '';
    });
  }, [pageIdsKey, pages]);

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
    setActivePageId(activePage?.id || '');
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
    setActivePageId(activePage?.id || '');
    setStatus('Análise gerada');
    showNotification('Análise acadêmica gerada.');
  };

  const handleDeletePage = async () => {
    if (!capture || !activePage || pages.length <= 1) return;
    const removedIndex = pages.findIndex((page) => page.id === activePage.id);
    const nextPages = pages.filter((page) => page.id !== activePage.id);
    const nextActivePage = nextPages[Math.min(Math.max(removedIndex, 0), nextPages.length - 1)] || nextPages[0] || null;
    const updatedCapture = await updateStoredCapture(capture.id, {
      blob: nextPages[0]?.blob || null,
      documentText: nextPages.map(getPageText).filter(Boolean).join('\n\n'),
      pages: nextPages,
      processedBlob: nextPages[0]?.processedBlob || null,
      updatedAt: new Date().toISOString()
    });
    onCaptureUpdated?.(updatedCapture);
    setActivePageId(nextActivePage?.id || '');
    setMoreOpen(false);
    setStatus('Página excluída');
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
    setActivePageId(activePage?.id || '');
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
        sourceHeight: activePage.sourceHeight || activePage.height,
        sourceWidth: activePage.sourceWidth || activePage.width,
        width: rectified.width
      }),
      summary: '',
      summaryNeedsUpdate: true,
      updatedAt: new Date().toISOString()
    });
    onCaptureUpdated?.(updatedCapture);
    setActivePageId(activePage.id);
    setMoreOpen(false);
    setStatus('Recorte aplicado');
    showNotification('Página retificada.');
  };

  const isOcrProcessing = Boolean(
    capture
    && documentOcrState.captureId === capture.id
    && documentOcrState.status === 'processing'
  );
  const hasImage = pages.length > 0;
  const lowConfidence = Number.isFinite(activePage?.ocrConfidence) && activePage.ocrConfidence < 65;

  return (
    <section className="document-workspace">
      <div className="document-workspace-toolbar">
        <button type="button" onClick={onBack}>{backLabel}</button>
        <strong>{isStudent ? 'Material de estudo' : 'Documento'}</strong>
        {!isStudent && !isCreating && (
          <button aria-label="Mais ações do documento" type="button" onClick={() => setMoreOpen((current) => !current)}>
            •••
          </button>
        )}
        {isStudent && <button type="button" onClick={handleSave}>Salvar</button>}
      </div>

      {(!hasImage || isStudent || activeTab === 'text') && (
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
      )}

      {isStudent && (
        <div className="document-workspace-tabs">
          <button className={activeTab === 'notes' ? 'active' : ''} type="button" onClick={() => setActiveTab('notes')}>
            Resumo
          </button>
          <button className={activeTab === 'text' ? 'active' : ''} type="button" onClick={() => setActiveTab('text')}>
            Texto
          </button>
          <button className={activeTab === 'annotation' ? 'active' : ''} type="button" onClick={() => setActiveTab('annotation')}>
            Anotações
          </button>
        </div>
      )}

      {hasImage && !isStudent && activeTab !== 'text' && (
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
          <button className="add-page" type="button" onClick={() => onAddPageRequest?.(capture)}>+</button>
        </div>
      )}

      {!isCreating && isStudent && (
        <div className="document-workspace-actions">
          <button disabled={!pageText.trim() && !getDocumentText(capture).trim()} type="button" onClick={handleAnalyze}>
            Atualizar resumo
          </button>
          <button type="button" onClick={() => setExportSheetOpen(true)}>Exportar</button>
        </div>
      )}

      {!isCreating && !isStudent && moreOpen && (
        <div className="document-more-menu">
          {activePage?.blob && <button disabled={isOcrProcessing} type="button" onClick={handleRecognize}>Refazer OCR</button>}
          {activePage?.blob && <button type="button" onClick={() => {
            setActiveTab('image');
            setMoreOpen(false);
          }}>Reajustar recorte</button>}
          {pages.length > 1 && <button type="button" onClick={handleDeletePage}>Excluir página</button>}
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
            onApplyCrop={handleApplyCrop}
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

      {!isCreating && !isStudent && activeTab !== 'text' && (
        <div className="document-bottom-actions">
          <button type="button" onClick={() => setActiveTab('text')}>Texto</button>
          <button type="button" onClick={() => setExportSheetOpen(true)}>Exportar</button>
        </div>
      )}

      {!isCreating && !isStudent && activeTab === 'text' && (
        <div className="document-bottom-actions">
          <button type="button" onClick={() => setActiveTab('image')}>Página</button>
          <button type="button" onClick={handleSave}>Salvar texto</button>
        </div>
      )}

      {(activeTab === 'notes' || activeTab === 'annotation') && (
        <div className="document-text-pane">
          {activeTab === 'notes' && (
            <div className="document-summary-card student-study-card">
              <strong>Resumo acadêmico</strong>
              <pre>{capture?.summary || 'Gere a análise acadêmica a partir do texto reconhecido.'}</pre>
              {capture?.summaryNeedsUpdate && <span>Resumo precisa ser atualizado após a edição.</span>}
            </div>
          )}
          {activeTab === 'annotation' && (
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
          )}
        </div>
      )}

      {exportSheetOpen && (
        <div className="export-sheet" role="dialog" aria-label="Exportar">
          <div className="export-sheet-panel">
            <strong>Exportar {isStudent ? 'material de estudo' : 'documento'}</strong>
            <button type="button" onClick={handleExportPdf}>PDF</button>
            <button type="button" onClick={handleExportDocx}>DOCX</button>
            <button type="button" onClick={() => setExportSheetOpen(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </section>
  );
}

function CornerEditor({ corners, onApplyCrop, onCornersChange, page }) {
  const [imageUrl, setImageUrl] = useState('');
  const [imageRect, setImageRect] = useState({ height: 1, width: 1 });
  const [dragIndex, setDragIndex] = useState(null);
  const frameRef = useRef(null);
  const blob = page?.blob;
  const naturalWidth = page?.sourceWidth || page?.width || 1;
  const naturalHeight = page?.sourceHeight || page?.height || 1;
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

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    const updateRect = () => {
      const rect = frame.getBoundingClientRect();
      setImageRect({ height: Math.max(1, rect.height), width: Math.max(1, rect.width) });
    };

    updateRect();
    if (!window.ResizeObserver) {
      window.addEventListener('resize', updateRect);
      return () => window.removeEventListener('resize', updateRect);
    }

    const observer = new ResizeObserver(updateRect);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [imageUrl]);

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
      <div className="corner-editor-header">
        <span>Ajustar documento</span>
        <button type="button" onClick={onApplyCrop}>Confirmar</button>
      </div>
      <div className="corner-editor-stage">
        <div
          className="corner-editor-frame"
          ref={frameRef}
          onPointerMove={(event) => movePoint(event)}
          onPointerUp={() => setDragIndex(null)}
          onPointerCancel={() => setDragIndex(null)}
        >
          <img
            alt="Página capturada para ajuste"
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
