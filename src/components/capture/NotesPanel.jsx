import { useAutosave } from '../../hooks/useAutosave.js';
import SaveStatus from './SaveStatus.jsx';

const MAX_NOTES = 5000;

export default function NotesPanel({ capture, onSave }) {
  const { draft, setDraft, status } = useAutosave(capture.notes, onSave);

  return (
    <div className="space-y-2 py-2">
      <label className="block">
        <span className="mb-2 block text-sm text-white/60">Suas anotações sobre esta captura (dúvidas, datas de prova, complementos…)</span>
        <textarea
          className="min-h-56 w-full resize-y rounded-2xl border border-white/12 bg-white/5 p-4 text-sm leading-relaxed text-white outline-none placeholder:text-white/35 focus:border-jovi-400"
          maxLength={MAX_NOTES}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ex.: cai na P2 — revisar exemplos da página 42"
          value={draft}
        />
      </label>
      <div className="flex justify-between text-xs text-white/45">
        <SaveStatus status={status} />
        <span className="tabular-nums">{draft.length}/{MAX_NOTES}</span>
      </div>
    </div>
  );
}
