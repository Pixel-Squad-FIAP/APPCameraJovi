import { EXTRA_MODES } from '../data/modes.js';

export default function MoreModesOverlay({ isOpen, onModeSelect, onOpenLogin }) {
  return (
    <div id="more-modes-overlay" className={`more-modes-container ${isOpen ? 'show' : ''}`}>
      <div className="more-modes-title">Adicionar modos</div>
      <div className="more-modes-grid">
        {EXTRA_MODES.map((mode) => (
          <button className="mode-chip" key={mode} onClick={() => onModeSelect(mode)}>{mode}</button>
        ))}
        {EXTRA_MODES.length === 0 && (
          <span className="mode-chip disabled">Sem modos extras ativos</span>
        )}
        <button className="mode-chip" id="btn-open-login" onClick={onOpenLogin} style={{ opacity: 0.4, fontSize: '10px' }}>
          Configurações
        </button>
      </div>
    </div>
  );
}
