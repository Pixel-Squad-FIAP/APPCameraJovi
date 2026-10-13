import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { usePreference } from '../../hooks/usePreference.js';
import { formatBytes } from '../../lib/format.js';
import { estimateStorage } from '../../services/captureStore.js';
import Button, { focusRing } from '../ui/Button.jsx';
import { Switch } from '../ui/Feedback.jsx';
import Icon from '../ui/Icon.jsx';
import Sheet from '../ui/Sheet.jsx';

function MenuLink({ icon, children, ...props }) {
  return (
    <Link className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white hover:bg-white/8 ${focusRing}`} {...props}>
      <Icon className="text-white/70" name={icon} size={20} />
      <span className="flex-1">{children}</span>
      <Icon className="text-white/40" name="forward" size={18} />
    </Link>
  );
}

export default function SettingsSheet({ captureCount, onClose, onImport, open }) {
  const { logout, user } = useAuth();
  const [smartHints, setSmartHints] = usePreference('smartHints');
  const [mirrorFront, setMirrorFront] = usePreference('mirrorFront');
  const [grid, setGrid] = usePreference('grid');
  const [storage, setStorage] = useState(null);

  useEffect(() => {
    if (open) estimateStorage().then(setStorage).catch(() => setStorage(null));
  }, [open, captureCount]);

  const usedPercent = storage?.quota ? Math.max(1, Math.round((storage.usage / storage.quota) * 100)) : null;

  return (
    <Sheet contained onClose={onClose} open={open} title="Ajustes">
      <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
        <span className="grid size-10 place-items-center rounded-full bg-jovi-500/25 text-jovi-300"><Icon name="user" size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user?.email}</p>
          <p className="text-xs text-white/55">Conta de demonstração</p>
        </div>
        <Button icon="logout" onClick={logout} size="sm" variant="secondary">Sair</Button>
      </div>

      <div className="mt-3 divide-y divide-white/8">
        <Switch
          checked={smartHints}
          description="Sugere Noite ou Documento conforme a cena."
          label="Sugestões inteligentes"
          onChange={setSmartHints}
        />
        <Switch checked={grid} description="Linhas para alinhar a composição." label="Grade" onChange={setGrid} />
        <Switch
          checked={mirrorFront}
          description="Salva a selfie como aparece na tela."
          label="Espelhar câmera frontal"
          onChange={setMirrorFront}
        />
      </div>

      <div className="mt-3 space-y-1">
        <button className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-white/8 ${focusRing}`} onClick={onImport} type="button">
          <Icon className="text-white/70" name="upload" size={20} />
          <span className="flex-1">Importar imagem do aparelho</span>
        </button>
        <MenuLink icon="image" to="/galeria">Galeria ({captureCount})</MenuLink>
        <MenuLink icon="home" to="/">Página inicial do projeto</MenuLink>
      </div>

      {storage && (
        <p className="mt-4 text-xs text-white/50">
          Armazenamento local usado: {formatBytes(storage.usage)}{usedPercent !== null && ` (${usedPercent}% do disponível)`}
        </p>
      )}
    </Sheet>
  );
}
