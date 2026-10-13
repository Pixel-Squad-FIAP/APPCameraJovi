export function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `cap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});

const longDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

export function formatDateTime(value) {
  return dateTimeFormatter.format(new Date(value));
}

export function formatLongDate(value) {
  return longDateFormatter.format(new Date(value));
}

export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function formatBytes(bytes) {
  if (!bytes) return '0 MB';
  const megabytes = bytes / (1024 * 1024);
  return megabytes < 1 ? `${Math.round(bytes / 1024)} KB` : `${megabytes.toFixed(1).replace('.', ',')} MB`;
}

export function normalizeSearch(value) {
  return (value ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function slugify(value) {
  return normalizeSearch(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'captura';
}
