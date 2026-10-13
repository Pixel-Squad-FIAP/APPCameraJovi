import { useObjectUrl } from '../../hooks/useObjectUrl.js';
import { focusRing } from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';

function shutterLabel({ busy, countdown, isRecording, isVideo }) {
  if (countdown) return 'Cancelar temporizador';
  if (busy) return 'Processando captura';
  if (isVideo) return isRecording ? 'Parar gravação' : 'Iniciar gravação';
  return 'Tirar foto';
}

export default function ShutterBar({
  busy,
  countdown,
  disabled,
  flipDisabled,
  isRecording,
  isVideo,
  latestCapture,
  onFlip,
  onOpenGallery,
  onShutter
}) {
  const thumbUrl = useObjectUrl(latestCapture?.thumbBlob);

  return (
    <div className="flex items-center justify-between px-8 pb-2 pt-3">
      <button
        aria-label={latestCapture ? 'Abrir galeria — última captura' : 'Abrir galeria'}
        className={`relative grid size-12 place-items-center overflow-hidden rounded-xl border-2 border-white/80 bg-white/10 text-white transition-transform hover:scale-105 ${focusRing}`}
        disabled={isRecording}
        onClick={onOpenGallery}
        type="button"
      >
        {thumbUrl ? (
          <img alt="" className="size-full animate-pop object-cover" key={latestCapture.id} src={thumbUrl} />
        ) : (
          <Icon name="image" size={20} />
        )}
      </button>

      <button
        aria-label={shutterLabel({ busy, countdown, isRecording, isVideo })}
        className={`relative grid size-[76px] place-items-center rounded-full border-4 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${isRecording ? 'border-red-500/40' : 'border-white'} ${focusRing}`}
        disabled={disabled || (busy && !countdown)}
        onClick={onShutter}
        type="button"
      >
        {busy && !countdown ? (
          <span className="size-[58px] animate-spin rounded-full border-4 border-white/20 border-t-white" />
        ) : (
          <span
            className={`grid place-items-center transition-all duration-200 ${isVideo
              ? isRecording ? 'size-8 rounded-lg bg-red-500' : 'size-[60px] rounded-full bg-red-500'
              : 'size-[60px] rounded-full bg-white active:scale-90'}`}
          >
            {countdown > 0 && <Icon className={isVideo ? 'text-white' : 'text-ink-900'} name="close" size={26} strokeWidth={2.4} />}
          </span>
        )}
      </button>

      <button
        aria-label="Alternar câmera frontal/traseira"
        className={`grid size-12 place-items-center rounded-full bg-white/10 text-white transition-transform hover:bg-white/15 active:rotate-180 disabled:opacity-35 ${focusRing}`}
        disabled={flipDisabled}
        onClick={onFlip}
        type="button"
      >
        <Icon name="flip" size={22} />
      </button>
    </div>
  );
}
