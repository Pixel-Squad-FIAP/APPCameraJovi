import { useEffect, useId, useRef } from 'react';
import { IconButton } from './Button.jsx';

// Painel único usado para todos os overlays: abre de baixo no celular e como
// diálogo centralizado em telas maiores. Fecha com Esc, clique fora ou botão.
export default function Sheet({
  children,
  contained = false,
  description,
  footer,
  onClose,
  open,
  title,
  wide = false
}) {
  const titleId = useId();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    const firstField = panel?.querySelector('input, textarea, select');
    (firstField ?? panel)?.focus({ preventScroll: true });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={`${contained ? 'absolute' : 'fixed'} inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/60 backdrop-blur-[2px] sm:items-center sm:p-4`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-describedby={description ? `${titleId}-desc` : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`flex max-h-[88%] w-full animate-sheet-in flex-col rounded-t-3xl border border-white/10 bg-ink-850 text-white shadow-2xl outline-none sm:max-h-[85vh] sm:rounded-3xl ${wide ? 'sm:max-w-xl' : 'sm:max-w-md'}`}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="flex items-start gap-3 px-5 pb-2 pt-4">
          <div className="min-w-0 flex-1 pt-2">
            <h2 className="text-lg font-bold leading-tight" id={titleId}>{title}</h2>
            {description && <p className="mt-1 text-sm text-white/60" id={`${titleId}-desc`}>{description}</p>}
          </div>
          <IconButton icon="close" label="Fechar" onClick={onClose} size={20} className="-mr-2" />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <footer className="flex flex-col-reverse gap-2 border-t border-white/10 px-5 py-4 sm:flex-row sm:justify-end">{footer}</footer>}
      </section>
    </div>
  );
}
