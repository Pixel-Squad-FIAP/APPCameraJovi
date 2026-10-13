import { getMode } from '../../data/modes.js';
import { useAutosave } from '../../hooks/useAutosave.js';
import { formatBytes, formatDuration, formatLongDate } from '../../lib/format.js';
import AlbumPicker from '../library/AlbumPicker.jsx';
import SaveStatus from './SaveStatus.jsx';

export default function OrganizePanel({ capture, onAlbumChange, onTitleSave }) {
  const { draft, setDraft, status } = useAutosave(capture.title, onTitleSave);

  const details = [
    ['Capturada em', formatLongDate(capture.createdAt)],
    ['Modo', getMode(capture.mode).label],
    capture.width ? ['Resolução', `${capture.width} × ${capture.height}`] : null,
    capture.kind === 'video' ? ['Duração', formatDuration(capture.duration ?? 0)] : null,
    ['Tamanho', formatBytes(capture.size)]
  ].filter(Boolean);

  return (
    <div className="space-y-6 py-2">
      <label className="block">
        <span className="mb-2 flex items-center justify-between text-sm font-semibold">
          Título <SaveStatus status={status} />
        </span>
        <input
          className="min-h-11 w-full rounded-xl border border-white/12 bg-white/5 px-3 text-sm text-white outline-none focus:border-jovi-400"
          maxLength={80}
          onBlur={() => {
            if (!draft.trim()) setDraft(capture.title);
          }}
          onChange={(event) => setDraft(event.target.value)}
          value={draft}
        />
      </label>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Álbum / matéria</h3>
        <AlbumPicker onSelect={onAlbumChange} selected={capture.album} />
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-2xl bg-white/5 p-4 text-sm">
        {details.map(([label, value]) => (
          <div className="contents" key={label}>
            <dt className="text-white/50">{label}</dt>
            <dd className="text-white/85">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
