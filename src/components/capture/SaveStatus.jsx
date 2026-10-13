const LABELS = {
  saved: 'Salvo',
  pending: 'Alterações não salvas…',
  saving: 'Salvando…',
  error: 'Erro ao salvar'
};

export default function SaveStatus({ status }) {
  return (
    <span aria-live="polite" className={`text-xs ${status === 'error' ? 'text-red-300' : 'text-white/45'}`}>
      {LABELS[status]}
    </span>
  );
}
