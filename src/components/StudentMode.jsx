import { useEffect, useMemo, useState } from 'react';
import { updateStoredCapture } from '../services/captureStorage.js';
import { exportDocumentAsDocx } from '../services/documentExport.js';
import { buildStudentExportText, createExtractiveSummary } from '../services/studentSummary.js';

function getDocumentLabel(documentCapture) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit'
  }).format(new Date(documentCapture.createdAt));
}

function getReadyDocuments(captures) {
  return captures
    .filter((capture) => capture.kind === 'document' && (capture.documentText?.trim() || capture.ocrText?.trim()))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getDocumentText(capture) {
  return capture?.documentText || capture?.ocrText || '';
}

export default function StudentMode({
  activeOverlay,
  onClose,
  onDocumentUpdated,
  showNotification,
  userCaptures = []
}) {
  const readyDocuments = useMemo(() => getReadyDocuments(userCaptures), [userCaptures]);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const selectedDocument = readyDocuments.find((documentCapture) => documentCapture.id === selectedDocumentId) || readyDocuments[0] || null;
  const [annotationText, setAnnotationText] = useState('');

  useEffect(() => {
    if (!selectedDocument) {
      setSelectedDocumentId('');
      setAnnotationText('');
      return;
    }

    if (!selectedDocumentId || !readyDocuments.some((documentCapture) => documentCapture.id === selectedDocumentId)) {
      setSelectedDocumentId(selectedDocument.id);
    }

    setAnnotationText(selectedDocument.annotation || '');
  }, [readyDocuments, selectedDocument, selectedDocumentId]);

  const updateSelectedDocument = async (patch) => {
    if (!selectedDocument) {
      showNotification('Digitalize um documento para usar o Modo Estudante.');
      return null;
    }

    const updatedDocument = await updateStoredCapture(selectedDocument.id, {
      ...patch,
      updatedAt: new Date().toISOString()
    });
    onDocumentUpdated(updatedDocument);
    return updatedDocument;
  };

  const handleGenerateSummary = async () => {
    if (!selectedDocument) {
      showNotification('Digitalize um documento para usar o Modo Estudante.');
      return;
    }

    const summary = createExtractiveSummary(getDocumentText(selectedDocument));
    if (!summary) {
      showNotification('Não há texto suficiente para resumir.');
      return;
    }

    await updateSelectedDocument({
      summary,
      summaryGeneratedAt: new Date().toISOString(),
      summaryNeedsUpdate: false
    });
    showNotification('Resumo gerado a partir do OCR.');
  };

  const handleSaveAnnotation = async () => {
    await updateSelectedDocument({ annotation: annotationText.trim() });
    showNotification('Anotação salva no documento.');
  };

  const handleCopyText = async () => {
    if (!selectedDocument) {
      showNotification('Nenhum documento disponível.');
      return;
    }

    const text = buildStudentExportText(selectedDocument);
    try {
      await navigator.clipboard.writeText(text);
      showNotification('Texto copiado.');
    } catch {
      showNotification('Não foi possível copiar neste navegador.');
    }
  };

  const handleDownloadDocx = async () => {
    if (!selectedDocument) {
      showNotification('Nenhum documento disponível.');
      return;
    }

    await exportDocumentAsDocx(selectedDocument);
    showNotification('DOCX gerado.');
  };

  return (
    <>
      <StudentDocumentOverlay
        documents={readyDocuments}
        isOpen={activeOverlay === 'summary'}
        mode="summary"
        onClose={onClose}
        onGenerateSummary={handleGenerateSummary}
        onSelectDocument={setSelectedDocumentId}
        selectedDocument={selectedDocument}
        selectedDocumentId={selectedDocument?.id || ''}
      />
      <StudentDocumentOverlay
        annotationText={annotationText}
        documents={readyDocuments}
        isOpen={activeOverlay === 'notes'}
        mode="notes"
        onAnnotationChange={setAnnotationText}
        onClose={onClose}
        onSaveAnnotation={handleSaveAnnotation}
        onSelectDocument={setSelectedDocumentId}
        selectedDocument={selectedDocument}
        selectedDocumentId={selectedDocument?.id || ''}
      />
      <StudentDocumentOverlay
        documents={readyDocuments}
        isOpen={activeOverlay === 'export'}
        mode="export"
        onClose={onClose}
        onCopyText={handleCopyText}
        onDownloadText={handleDownloadDocx}
        onSelectDocument={setSelectedDocumentId}
        selectedDocument={selectedDocument}
        selectedDocumentId={selectedDocument?.id || ''}
      />
    </>
  );
}

function OverlayFrame({ children, id, isOpen, onClose, title }) {
  return (
    <div id={id} className={`student-overlay ${isOpen ? 'show' : ''}`} onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="student-overlay-panel">
        <div className="student-overlay-header">
          <button className="student-back-btn" onClick={onClose} aria-label={`Fechar ${title}`}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4L6 9L11 14" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="student-overlay-title">{title}</span>
          <div style={{ width: '32px' }} />
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyStudentState() {
  return (
    <div className="student-card">
      <div className="student-card-title">Nenhum documento com OCR</div>
      <p className="student-real-text">Digitalize um documento para usar o Modo Estudante.</p>
    </div>
  );
}

function DocumentSelector({ documents, onSelectDocument, selectedDocumentId }) {
  if (documents.length <= 1) return null;

  return (
    <div className="student-card" style={{ marginBottom: '12px' }}>
      <div className="student-card-label">Documento</div>
      <div className="student-tags">
        {documents.map((documentCapture) => (
          <button
            className={`student-tag ${selectedDocumentId === documentCapture.id ? 'active-tag' : ''}`}
            key={documentCapture.id}
            onClick={() => onSelectDocument(documentCapture.id)}
            type="button"
          >
            {getDocumentLabel(documentCapture)}
          </button>
        ))}
      </div>
    </div>
  );
}

function RecognizedTextCard({ documentCapture }) {
  return (
    <div className="student-card">
      <div className="student-card-title">Texto do documento</div>
      <p className="student-real-text">{getDocumentText(documentCapture)}</p>
    </div>
  );
}

function StudentDocumentOverlay({
  annotationText = '',
  documents,
  isOpen,
  mode,
  onAnnotationChange,
  onClose,
  onCopyText,
  onDownloadText,
  onGenerateSummary,
  onSaveAnnotation,
  onSelectDocument,
  selectedDocument,
  selectedDocumentId
}) {
  const title = mode === 'summary'
    ? 'Resumo do Documento'
    : mode === 'notes'
      ? 'Anotação do Documento'
    : 'Exportar DOCX';

  return (
    <OverlayFrame id={`overlay-${mode}`} isOpen={isOpen} onClose={onClose} title={title}>
      <div className="student-ai-badge">OCR real</div>
      {!selectedDocument ? (
        <EmptyStudentState />
      ) : (
        <>
          <DocumentSelector documents={documents} onSelectDocument={onSelectDocument} selectedDocumentId={selectedDocumentId} />
          {mode === 'summary' && (
            <>
              <RecognizedTextCard documentCapture={selectedDocument} />
              <div className="student-card" style={{ marginTop: '12px' }}>
                <div className="student-card-title">Resumo extrativo</div>
                <p className="student-real-text">{selectedDocument.summary || 'Gere um resumo a partir do texto reconhecido.'}</p>
              </div>
              <div className="student-overlay-footer">
                <button className="student-action-btn primary" onClick={onGenerateSummary}>Gerar resumo real</button>
              </div>
            </>
          )}
          {mode === 'notes' && (
            <>
              <RecognizedTextCard documentCapture={selectedDocument} />
              <div className="student-card" style={{ marginTop: '12px' }}>
                <div className="student-card-title">Sua anotação</div>
                <textarea
                  className="student-textarea"
                  onChange={(event) => onAnnotationChange(event.target.value)}
                  placeholder="Adicione uma anotação para este documento..."
                  value={annotationText}
                />
              </div>
              <div className="student-overlay-footer">
                <button className="student-action-btn primary" onClick={onSaveAnnotation}>Salvar anotação</button>
              </div>
            </>
          )}
          {mode === 'export' && (
            <>
              <RecognizedTextCard documentCapture={selectedDocument} />
              <div className="student-card" style={{ marginTop: '12px' }}>
                <div className="student-card-title">Conteúdo do DOCX</div>
                <p className="student-real-text">Texto reconhecido, resumo e anotação vinculada ao documento.</p>
              </div>
              <div className="student-overlay-footer">
                <button className="student-action-btn primary" onClick={onDownloadText}>Baixar DOCX</button>
                <button className="student-action-btn secondary" onClick={onCopyText}>Copiar texto</button>
              </div>
            </>
          )}
        </>
      )}
    </OverlayFrame>
  );
}
