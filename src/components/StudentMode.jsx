import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'jovi.student.annotation';

const summaryShortText = 'A análise deste documento identificou padrões térmicos consistentes com o comportamento de fluidos em recipientes isolados, sugerindo uma aplicação direta da lei de conservação...';
const summaryFullText = 'A análise deste documento identificou padrões térmicos consistentes com o comportamento de fluidos em recipientes isolados, sugerindo uma aplicação direta da lei de conservação de energia. O conteúdo analisado aborda os princípios da Termodinâmica, com foco na Primeira Lei e na conservação de energia em sistemas fechados. Foram identificados exemplos práticos envolvendo máquinas térmicas e ciclos de compressão.';

function readStoredAnnotation() {
  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) return '';
    const parsedValue = JSON.parse(rawValue);
    return typeof parsedValue?.text === 'string' ? parsedValue.text : '';
  } catch {
    return '';
  }
}

function writeStoredAnnotation(text) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ text }));
    return true;
  } catch {
    return false;
  }
}

export { STORAGE_KEY };

export default function StudentMode({ activeOverlay, onClose, showNotification }) {
  const [summaryLoaded, setSummaryLoaded] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [annotationText, setAnnotationText] = useState(readStoredAnnotation);
  const [savedAnnotationText, setSavedAnnotationText] = useState(readStoredAnnotation);
  const [googleDocsEnabled, setGoogleDocsEnabled] = useState(false);
  const [exportFormat, setExportFormat] = useState('.PDF');
  const [exportDestination, setExportDestination] = useState('Google Drive');
  const [docFormat, setDocFormat] = useState('.PDF');
  const closeTimerRef = useRef(null);

  useEffect(() => {
    return () => window.clearTimeout(closeTimerRef.current);
  }, []);

  useEffect(() => {
    if (activeOverlay !== 'summary' || summaryLoaded) return undefined;

    const loadTimer = window.setTimeout(() => {
      setSummaryLoaded(true);
    }, 1800);

    return () => window.clearTimeout(loadTimer);
  }, [activeOverlay, summaryLoaded]);

  const closeAfterNotification = () => {
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(onClose, 1000);
  };

  const handleSaveAnnotation = () => {
    const saved = writeStoredAnnotation(annotationText);
    if (saved) {
      setSavedAnnotationText(annotationText);
      setGoogleDocsEnabled(true);
      showNotification('Alterações salvas!');
    } else {
      showNotification('Não foi possível salvar a anotação.');
    }
  };

  const handleDiscardAnnotation = () => {
    setAnnotationText(savedAnnotationText);
    onClose();
  };

  const notifyAction = (actionText) => {
    let message = 'Ação realizada!';
    if (actionText === 'Exportar para Google Docs' || actionText === 'Salvar no google docs') message = 'Exportação concluída!';
    else if (actionText === 'Salvar PDF') message = 'Salvo com sucesso!';
    else if (actionText === 'Compartilhar') message = 'Compartilhado com sucesso!';
    else if (actionText.includes('Salvar')) message = 'Salvo com sucesso!';
    else if (actionText.includes('Exportar')) message = 'Exportação iniciada...';

    showNotification(message);
    closeAfterNotification();
  };

  return (
    <>
      <SummaryOverlay
        isOpen={activeOverlay === 'summary'}
        loaded={summaryLoaded}
        expanded={summaryExpanded}
        onClose={onClose}
        onExport={() => notifyAction('Exportar para Google Docs')}
        onToggleExpanded={() => setSummaryExpanded((current) => !current)}
      />
      <NotesOverlay
        googleDocsEnabled={googleDocsEnabled}
        isOpen={activeOverlay === 'notes'}
        note={annotationText}
        onClose={onClose}
        onDiscard={handleDiscardAnnotation}
        onGoogleDocs={() => notifyAction('Salvar no google docs')}
        onNoteChange={setAnnotationText}
        onSave={handleSaveAnnotation}
      />
      <ExportOverlay
        destination={exportDestination}
        format={exportFormat}
        isOpen={activeOverlay === 'export'}
        onClose={onClose}
        onCopy={() => notifyAction('Copiar texto')}
        onDestinationChange={setExportDestination}
        onExport={() => notifyAction('Exportar agora')}
        onFormatChange={setExportFormat}
      />
      <DocExportOverlay
        format={docFormat}
        isOpen={activeOverlay === 'docExport'}
        onClose={onClose}
        onFormatChange={setDocFormat}
        onSavePdf={() => notifyAction('Salvar PDF')}
        onShare={() => notifyAction('Compartilhar')}
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

function SkeletonLines({ widths }) {
  return (
    <div className="student-skeleton-lines">
      {widths.map((width) => (
        <div className="sk-line" key={width} style={{ width }} />
      ))}
    </div>
  );
}

function SummaryOverlay({ expanded, isOpen, loaded, onClose, onExport, onToggleExpanded }) {
  return (
    <OverlayFrame id="overlay-resumir" isOpen={isOpen} onClose={onClose} title="Resumo Gerado">
      <div className="student-card">
        {!loaded ? (
          <SkeletonLines widths={['90%', '75%', '85%', '60%', '80%']} />
        ) : (
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12.5px', lineHeight: 1.6, margin: 0 }}>
            {expanded ? summaryFullText : summaryShortText}
            <span
              className="toggle-text"
              onClick={onToggleExpanded}
              style={{ color: '#5c9df5', cursor: 'pointer', fontWeight: 600, marginLeft: '4px' }}
            >
              {expanded ? 'Ver menos' : 'Ver mais'}
            </span>
          </p>
        )}
      </div>
      <div className="student-overlay-footer">
        <button className="student-action-btn primary" onClick={onExport} style={{ width: '100%' }}>Exportar para Google Docs</button>
      </div>
    </OverlayFrame>
  );
}

function NotesOverlay({
  googleDocsEnabled,
  isOpen,
  note,
  onClose,
  onDiscard,
  onGoogleDocs,
  onNoteChange,
  onSave
}) {
  return (
    <OverlayFrame id="overlay-anotar" isOpen={isOpen} onClose={onClose} title="Anotação">
      <div className="student-ai-badge">✦ AI</div>
      <div className="student-card">
        <div className="student-card-title">Texto reconhecido</div>
        <SkeletonLines widths={['95%', '80%', '88%', '70%']} />
      </div>
      <div className="student-card" style={{ marginTop: '12px' }}>
        <div className="student-card-title">Sua anotação</div>
        <textarea
          className="student-textarea"
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Adicione uma anotação..."
          value={note}
        />
      </div>
      <div className="student-overlay-footer">
        <button className="student-action-btn primary" id="btn-save-changes" onClick={onSave}>Salvar alterações</button>
        <button className="student-action-btn secondary" onClick={onDiscard}>Descartar</button>
        <button
          className={`student-action-btn ${googleDocsEnabled ? 'primary' : 'secondary'}`}
          disabled={!googleDocsEnabled}
          id="btn-google-docs-save"
          onClick={onGoogleDocs}
          style={{
            opacity: googleDocsEnabled ? 1 : 0.5,
            cursor: googleDocsEnabled ? 'pointer' : 'not-allowed'
          }}
        >
          Salvar no google docs
        </button>
      </div>
    </OverlayFrame>
  );
}

function ExportOverlay({
  destination,
  format,
  isOpen,
  onClose,
  onCopy,
  onDestinationChange,
  onExport,
  onFormatChange
}) {
  return (
    <OverlayFrame id="overlay-exportar" isOpen={isOpen} onClose={onClose} title="Exportar Texto">
      <div className="student-ai-badge">✦ AI</div>
      <div className="student-card">
        <div className="student-card-title">Texto extraído</div>
        <SkeletonLines widths={['92%', '78%', '85%', '65%', '88%', '72%']} />
      </div>
      <SingleChoiceCard
        label="Formato de exportação"
        options={['.PDF', '.DOCX', '.TXT']}
        selected={format}
        onSelect={onFormatChange}
      />
      <SingleChoiceCard
        label="Destino"
        options={['Google Drive', 'Downloads']}
        selected={destination}
        onSelect={onDestinationChange}
      />
      <div className="student-overlay-footer">
        <button className="student-action-btn primary" onClick={onExport}>Exportar agora</button>
        <button className="student-action-btn secondary" onClick={onCopy}>Copiar texto</button>
      </div>
    </OverlayFrame>
  );
}

function DocExportOverlay({ format, isOpen, onClose, onFormatChange, onSavePdf, onShare }) {
  return (
    <OverlayFrame id="overlay-doc-exportar" isOpen={isOpen} onClose={onClose} title="Exportar Documento">
      <div className="student-ai-badge">✦ Scanner</div>
      <div className="student-card">
        <div className="student-card-title">Prévia da Digitalização</div>
        <div style={{ height: '160px', background: '#fff', borderRadius: '4px', display: 'flex', flexDirection: 'column', padding: '16px', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ width: '40%', height: '8px', background: '#eee', borderRadius: '4px', marginBottom: '12px' }} />
          <div style={{ width: '100%', height: '4px', background: '#f5f5f5', borderRadius: '2px', marginBottom: '6px' }} />
          <div style={{ width: '90%', height: '4px', background: '#f5f5f5', borderRadius: '2px', marginBottom: '6px' }} />
          <div style={{ width: '95%', height: '4px', background: '#f5f5f5', borderRadius: '2px', marginBottom: '6px' }} />
          <div style={{ width: '85%', height: '4px', background: '#f5f5f5', borderRadius: '2px', marginBottom: '16px' }} />
          <div style={{ width: '100%', height: '60px', background: '#fafafa', border: '1px dashed #ddd', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="assets/photo2.png" alt="Prévia de documento" style={{ width: '80%', height: '80%', objectFit: 'cover', opacity: 0.6, filter: 'grayscale(100%)' }} />
          </div>
        </div>
      </div>
      <SingleChoiceCard
        label="Formato"
        options={['.PDF', '.DOCX', '.DOC']}
        selected={format}
        onSelect={onFormatChange}
      />
      <div className="student-overlay-footer">
        <button className="student-action-btn primary" onClick={onSavePdf}>Salvar PDF</button>
        <button className="student-action-btn secondary" onClick={onShare}>Compartilhar</button>
      </div>
    </OverlayFrame>
  );
}

function SingleChoiceCard({ label, onSelect, options, selected }) {
  return (
    <div className="student-card" style={{ marginTop: '12px' }}>
      <div className="student-card-label">{label}</div>
      <div className="student-tags" style={{ marginTop: '8px' }}>
        {options.map((option) => (
          <span
            className={`student-tag ${selected === option ? 'active-tag' : ''}`}
            key={option}
            onClick={() => onSelect(option)}
          >
            {option}
          </span>
        ))}
      </div>
    </div>
  );
}
