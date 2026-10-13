import { focusRing } from './Button.jsx';

const TONES = {
  neutral: 'bg-ink-800/95 text-white',
  success: 'bg-ink-800/95 text-white ring-1 ring-emerald-400/40',
  error: 'bg-red-950/95 text-red-100 ring-1 ring-red-400/40'
};

export default function Toast({ elevated = false, notification, onDismiss }) {
  return (
    <div className={`pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4 ${elevated ? 'bottom-[calc(13rem_+_env(safe-area-inset-bottom))] md:bottom-[calc(max(50dvh_-_430px,24px)_+_13rem)]' : 'bottom-[max(1.25rem,env(safe-area-inset-bottom))] md:bottom-8'}`} aria-live="polite" role="status">
      {notification && (
        <div
          className={`pointer-events-auto flex max-w-md animate-sheet-in items-center gap-3 rounded-2xl py-2.5 pl-4 pr-2 text-sm font-medium shadow-2xl backdrop-blur ${TONES[notification.tone] ?? TONES.neutral}`}
          key={notification.id}
        >
          <span className="py-1">{notification.message}</span>
          {notification.action && (
            <button
              className={`rounded-full px-3 py-1.5 font-bold text-jovi-300 hover:bg-white/10 ${focusRing}`}
              onClick={() => {
                notification.action.onClick();
                onDismiss();
              }}
              type="button"
            >
              {notification.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
