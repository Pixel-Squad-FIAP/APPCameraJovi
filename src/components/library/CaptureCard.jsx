import { Link } from 'react-router-dom';
import { getMode } from '../../data/modes.js';
import { useObjectUrl } from '../../hooks/useObjectUrl.js';
import { formatDateTime, formatDuration } from '../../lib/format.js';
import { focusRing } from '../ui/Button.jsx';
import { Spinner } from '../ui/Feedback.jsx';
import Icon from '../ui/Icon.jsx';

function OcrBadge({ capture, processing }) {
  if (processing) {
    return <span className="flex items-center gap-1.5 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold"><Spinner className="size-3" /> Lendo texto</span>;
  }
  if (capture.ocrStatus === 'done' && capture.text) {
    return <span className="flex items-center gap-1 rounded-full bg-jovi-500/90 px-2 py-1 text-[11px] font-semibold"><Icon name="text" size={12} /> Texto</span>;
  }
  if (capture.ocrStatus === 'error') {
    return <span className="flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-1 text-[11px] font-semibold"><Icon name="alert" size={12} /> Falhou</span>;
  }
  return null;
}

export default function CaptureCard({ capture, processing }) {
  const thumbUrl = useObjectUrl(capture.thumbBlob);
  const mode = getMode(capture.mode);

  return (
    <Link className={`group block overflow-hidden rounded-2xl border border-white/8 bg-ink-850 transition-colors hover:border-white/20 ${focusRing}`} to={`/galeria/${capture.id}`}>
      <div className="relative aspect-square bg-ink-800">
        {thumbUrl && <img alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" src={thumbUrl} />}
        <div className="absolute inset-x-2 top-2 flex flex-wrap items-start justify-between gap-1">
          <span className="rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold backdrop-blur">{mode.label}</span>
          <OcrBadge capture={capture} processing={processing} />
        </div>
        {capture.kind === 'video' && (
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold tabular-nums">
            <Icon name="video" size={12} /> {formatDuration(capture.duration ?? 0)}
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white">{capture.title}</h3>
        <p className="mt-1 truncate text-xs text-white/50">{capture.album} · {formatDateTime(capture.createdAt)}</p>
      </div>
    </Link>
  );
}
