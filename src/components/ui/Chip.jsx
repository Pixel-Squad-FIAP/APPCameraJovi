import { focusRing } from './Button.jsx';
import Icon from './Icon.jsx';

export default function Chip({ active = false, children, count, icon, className = '', ...props }) {
  return (
    <button
      aria-pressed={active}
      className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors ${active ? 'border-jovi-400 bg-jovi-500/20 text-white' : 'border-white/12 bg-white/5 text-white/75 hover:border-white/25 hover:text-white'} ${focusRing} ${className}`}
      type="button"
      {...props}
    >
      {icon && <Icon name={icon} size={15} />}
      {children}
      {count !== undefined && <span className={`text-xs ${active ? 'text-jovi-300' : 'text-white/45'}`}>{count}</span>}
    </button>
  );
}
