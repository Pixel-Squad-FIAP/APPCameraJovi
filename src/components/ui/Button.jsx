import Icon from './Icon.jsx';

const VARIANTS = {
  primary: 'bg-jovi-500 text-white hover:bg-jovi-400 disabled:bg-jovi-500/40',
  secondary: 'bg-white/10 text-white hover:bg-white/15 disabled:text-white/40',
  ghost: 'text-white/80 hover:bg-white/10 hover:text-white disabled:text-white/30',
  danger: 'bg-red-500/90 text-white hover:bg-red-500 disabled:bg-red-500/40',
  light: 'bg-white text-ink-900 hover:bg-white/90 disabled:bg-white/50'
};

const SIZES = {
  sm: 'min-h-9 gap-1.5 px-3 text-sm',
  md: 'min-h-11 gap-2 px-4 text-sm',
  lg: 'min-h-12 gap-2 px-5 text-base'
};

export const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jovi-300';

export default function Button({
  children,
  className = '',
  icon,
  size = 'md',
  type = 'button',
  variant = 'primary',
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-full font-semibold transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${focusRing} ${className}`}
      type={type}
      {...props}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
    </button>
  );
}

export function IconButton({ className = '', icon, label, size = 22, active = false, ...props }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`inline-grid size-11 shrink-0 place-items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${active ? 'bg-white/15 text-jovi-300' : 'text-white hover:bg-white/10'} ${focusRing} ${className}`}
      type="button"
      {...props}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}
