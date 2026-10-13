import Button from './Button.jsx';
import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';

export function ProgressBar({ value, label }) {
  const indeterminate = value === null || value === undefined;
  const percent = indeterminate ? 0 : Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="text-white/80">{label}</span>
        {!indeterminate && <span className="font-semibold tabular-nums text-white">{percent}%</span>}
      </div>
      <div
        aria-label={label}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={indeterminate ? undefined : percent}
        className="h-2 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
      >
        <div
          className={`h-full rounded-full bg-jovi-400 transition-[width] duration-300 ${indeterminate ? 'w-1/3 animate-pulse' : ''}`}
          style={indeterminate ? undefined : { width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function EmptyState({ icon = 'image', title, description, children }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-white/5 text-white/60">
        <Icon name={icon} size={26} />
      </span>
      <h3 className="text-base font-bold text-white">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-white/60">{description}</p>}
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function Notice({ tone = 'info', icon, children }) {
  const tones = {
    info: 'border-jovi-400/25 bg-jovi-500/10 text-jovi-300',
    warning: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
    error: 'border-red-400/30 bg-red-500/10 text-red-200'
  };
  return (
    <div className={`flex gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${tones[tone]}`}>
      <Icon name={icon ?? (tone === 'info' ? 'help' : 'alert')} size={18} className="mt-px shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function ConfirmDialog({ confirmLabel, description, onCancel, onConfirm, open, title, contained, tone = 'danger' }) {
  return (
    <Sheet
      contained={contained}
      description={description}
      footer={(
        <>
          <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button variant={tone} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      )}
      onClose={onCancel}
      open={open}
      title={title}
    />
  );
}

export function Switch({ checked, description, label, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-white/55">{description}</span>}
      </span>
      <input checked={checked} className="peer sr-only" onChange={(event) => onChange(event.target.checked)} role="switch" type="checkbox" />
      <span className="relative h-7 w-12 shrink-0 rounded-full bg-white/15 transition-colors after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-jovi-500 peer-checked:after:translate-x-5 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-jovi-300" />
    </label>
  );
}

export function Spinner({ className = 'size-5' }) {
  return <span aria-hidden="true" className={`inline-block animate-spin rounded-full border-2 border-white/25 border-t-white ${className}`} />;
}
