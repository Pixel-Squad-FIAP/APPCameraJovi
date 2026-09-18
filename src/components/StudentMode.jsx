import { useEffect, useRef, useState } from 'react';
import { useStudentAnnotation } from '../hooks/useStudentAnnotation.js';

const summaryShortText = 'A análise deste documento identificou padrões térmicos consistentes com o comportamento de fluidos em recipientes isolados, sugerindo uma aplicação direta da lei de conservação...';
const summaryFullText = 'A análise deste documento identificou padrões térmicos consistentes com o comportamento de fluidos em recipientes isolados, sugerindo uma aplicação direta da lei de conservação de energia. O conteúdo analisado aborda os princípios da Termodinâmica, com foco na Primeira Lei e na conservação de energia em sistemas fechados. Foram identificados exemplos práticos envolvendo máquinas térmicas e ciclos de compressão.';
const initialCaptureAlbums = ['Trabalhos', 'Aulas', 'Provas', 'Estudos'];

export default function StudentMode({ activeOverlay, onClose, showNotification }) {
  const [summaryLoaded, setSummaryLoaded] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const {
    annotationText,
    discardAnnotation,
    googleDocsEnabled,
    saveAnnotation,
    setAnnotationText
  } = useStudentAnnotation();
  const [exportFormat, setExportFormat] = useState('.PDF');
  const [exportDestination, setExportDestination] = useState('Google Drive');
  const [docFormat, setDocFormat] = useState('.PDF');
  const [captureAlbums, setCaptureAlbums] = useState(initialCaptureAlbums);
  const [selectedCaptureAlbum, setSelectedCaptureAlbum] = useState('');
  const [newAlbumOpen, setNewAlbumOpen] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const closeTimerRef = useRef(null);
  const resetCaptureTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      window.clearTimeout(closeTimerRef.current);
      window.clearTimeout(resetCaptureTimerRef.current);
    };
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
    const saved = saveAnnotation();
    if (saved) {
      showNotification('Alterações salvas!');
    } else {
      showNotification('Não foi possível salvar a anotação.');
    }
  };

  const handleDiscardAnnotation = () => {
    discardAnnotation();
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

  const resetCaptureDestination = () => {
    setSelectedCaptureAlbum('');
  };

  const handleSkipCaptureDestination = () => {
    window.clearTimeout(resetCaptureTimerRef.current);
    resetCaptureDestination();
    onClose();
  };

  const handleConfirmCaptureDestination = () => {
    showNotification('Captura salva no álbum!');
    window.clearTimeout(closeTimerRef.current);
    window.clearTimeout(resetCaptureTimerRef.current);
    closeTimerRef.current = window.setTimeout(onClose, 500);
    resetCaptureTimerRef.current = window.setTimeout(resetCaptureDestination, 1000);
  };

  const handleOpenNewAlbum = () => {
    setNewAlbumName('');
    setNewAlbumOpen(true);
  };

  const handleCancelNewAlbum = () => {
    setNewAlbumName('');
    setNewAlbumOpen(false);
  };

  const handleCreateAlbum = () => {
    const albumName = newAlbumName.trim();
    if (!albumName) {
      showNotification('Digite um nome válido');
      return;
    }

    setCaptureAlbums((current) => [...current, albumName]);
    setSelectedCaptureAlbum(albumName);
    setNewAlbumName('');
    setNewAlbumOpen(false);
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
      <CaptureDestinationOverlay
        albums={captureAlbums}
        isOpen={activeOverlay === 'captureDestination'}
        onConfirm={handleConfirmCaptureDestination}
        onNewAlbum={handleOpenNewAlbum}
        onSelectAlbum={setSelectedCaptureAlbum}
        onSkip={handleSkipCaptureDestination}
        selectedAlbum={selectedCaptureAlbum}
      />
      <NewAlbumOverlay
        isOpen={newAlbumOpen}
        name={newAlbumName}
        onCancel={handleCancelNewAlbum}
        onCreate={handleCreateAlbum}
        onNameChange={setNewAlbumName}
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
  const saveLabel = `Salvar ${format.replace('.', '')}`;

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
        <button className="student-action-btn primary" id="btn-save-doc" onClick={onSavePdf}>{saveLabel}</button>
        <button className="student-action-btn secondary" onClick={onShare}>Compartilhar</button>
      </div>
    </OverlayFrame>
  );
}

function CaptureDestinationOverlay({
  albums,
  isOpen,
  onConfirm,
  onNewAlbum,
  onSelectAlbum,
  onSkip,
  selectedAlbum
}) {
  return (
    <div id="overlay-capture-destination" className={`student-overlay ${isOpen ? 'show' : ''}`}>
      <div className="student-overlay-panel" style={{ width: '100%', height: 'auto', paddingBottom: '24px' }}>
        <div className="student-overlay-header" style={{ justifyContent: 'center' }}>
          <span className="student-overlay-title">Salvar em...</span>
        </div>
        <div className="student-card" style={{ marginTop: '10px' }}>
          <div className="student-card-label">Escolha o álbum</div>
          <div className="student-tags" id="capture-albums" style={{ marginTop: '12px' }}>
            {albums.map((album) => (
              <span
                className={`student-tag ${selectedAlbum === album ? 'active-tag' : ''}`}
                key={album}
                onClick={() => onSelectAlbum(album)}
              >
                {album}
              </span>
            ))}
            <span className="student-tag" onClick={onNewAlbum}>+ Novo</span>
          </div>
        </div>
        <div className="student-overlay-footer" style={{ marginTop: '20px', gap: '10px', flexDirection: 'column' }}>
          <button
            className="student-action-btn primary"
            disabled={!selectedAlbum}
            id="btn-confirm-capture"
            onClick={onConfirm}
            style={{ width: '100%', opacity: selectedAlbum ? 1 : 0.5 }}
          >
            Confirmar
          </button>
          <button className="student-action-btn secondary" id="btn-skip-capture" onClick={onSkip} style={{ width: '100%' }}>Pular</button>
        </div>
      </div>
    </div>
  );
}

function NewAlbumOverlay({ isOpen, name, onCancel, onCreate, onNameChange }) {
  return (
    <div id="overlay-new-album" className={`student-overlay ${isOpen ? 'show' : ''}`}>
      <div className="student-overlay-panel" style={{ width: '100%', height: 'auto', paddingBottom: '30px' }}>
        <div className="student-overlay-header">
          <button className="student-back-btn" onClick={onCancel} aria-label="Fechar Novo Álbum">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4L6 9L11 14" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="student-overlay-title">Novo Álbum</span>
          <div style={{ width: '32px' }} />
        </div>
        <div className="student-card" style={{ marginTop: '10px' }}>
          <div className="student-card-label">Nome do álbum</div>
          <input
            className="student-textarea"
            id="input-new-album"
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Ex: Biologia, Provas 2024..."
            style={{ height: '48px' }}
            type="text"
            value={name}
          />
        </div>
        <div className="student-overlay-footer" style={{ marginTop: '20px' }}>
          <button className="student-action-btn primary" id="btn-create-album" onClick={onCreate}>Criar</button>
          <button className="student-action-btn secondary" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
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
