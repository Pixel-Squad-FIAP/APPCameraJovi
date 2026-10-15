import { MODES } from '../../data/modes.js';
import Button from '../ui/Button.jsx';
import Sheet from '../ui/Sheet.jsx';

export default function HelpSheet({ activeMode, onClose, onShowTutorial, open }) {
  return (
    <Sheet
      contained
      description="O que cada modo faz e como seus dados são tratados."
      footer={<Button onClick={onShowTutorial} variant="secondary">Ver tutorial novamente</Button>}
      onClose={onClose}
      open={open}
      title="Ajuda"
    >
      <ul className="divide-y divide-white/8">
        {MODES.map((mode) => (
          <li className="py-3" key={mode.id}>
            <p className="flex items-center gap-2 text-sm font-bold">
              {mode.label}
              {mode.id === activeMode && <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">atual</span>}
              {mode.extractsText && <span className="rounded-full bg-jovi-500/20 px-2 py-0.5 text-[11px] font-semibold text-jovi-300">extrai texto</span>}
            </p>
            <p className="mt-1 text-sm text-white/65">{mode.description}</p>
          </li>
        ))}
      </ul>

      <h3 className="mt-4 text-sm font-bold">Gestos e atalhos</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/65">
        <li>Deslize no visor para trocar de modo.</li>
        <li>Toque no visor para focar e ajustar a exposição.</li>
        <li>No computador: <kbd className="rounded bg-white/10 px-1">Espaço</kbd> captura, <kbd className="rounded bg-white/10 px-1">←</kbd> <kbd className="rounded bg-white/10 px-1">→</kbd> trocam o modo.</li>
      </ul>

      <h3 className="mt-4 text-sm font-bold">Privacidade</h3>
      <p className="mt-2 text-sm text-white/65">
        Fotos, vídeos, textos e anotações ficam salvos apenas neste navegador (IndexedDB). O OCR e o resumo rodam no próprio
        aparelho; só o modelo de idioma do OCR é baixado da internet na primeira vez. Suas imagens e textos não são enviados para servidores — ao tocar em um termo do resumo, apenas a palavra é consultada na Wikipédia.
      </p>
    </Sheet>
  );
}
