// Formato de troca da biblioteca com o JOVI Desktop (programa Python em python/).
// A regra de mesclagem é a mesma de python/jovi/integracao.py:
// - capturas são casadas pelo id e vence o updatedAt mais recente (só os campos editáveis mudam);
// - ids desconhecidos viram capturas novas, a não ser que algum dos lados os tenha excluído;
// - os álbuns são unidos.

import { DEFAULT_ALBUM, DEFAULT_MODE, MODES } from '../data/modes.js';

export const LIBRARY_FORMAT = 'jovi-biblioteca';
export const LIBRARY_VERSION = 1;
export const SYNCED_FIELDS = ['title', 'titleAuto', 'album', 'text', 'summary', 'notes', 'ocrStatus', 'ocrConfidence'];

const KINDS = ['photo', 'video'];
const OCR_STATUSES = ['idle', 'done', 'empty', 'error'];
const MAX_CAPTURES = 5000;
const DELETED_KEY = 'jovi.sync.deleted';
const MAX_DELETED = 500;

export class LibraryFormatError extends Error {}

// Registro do navegador vira item do arquivo: sem o Blob da miniatura e sem o estado transitório do OCR.
export function toTransferCapture(capture, thumbDataUrl = null) {
  const { thumbBlob, ...rest } = capture;
  return {
    ...rest,
    ocrStatus: rest.ocrStatus === 'processing' ? 'idle' : rest.ocrStatus,
    ...(thumbDataUrl ? { thumbDataUrl } : {})
  };
}

export function buildLibraryFile(captures, albums, { deleted = [], exportedAt = new Date().toISOString() } = {}) {
  return {
    formato: LIBRARY_FORMAT,
    versao: LIBRARY_VERSION,
    exportadoEm: exportedAt,
    origem: 'app',
    albuns: albums,
    capturas: captures,
    excluidas: deleted
  };
}

const isDate = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const isOptionalString = (value) => value == null || typeof value === 'string';

export function isValidCapture(item) {
  return Boolean(item)
    && typeof item === 'object'
    && typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 100
    && isDate(item.createdAt) && isDate(item.updatedAt)
    && KINDS.includes(item.kind)
    && ['title', 'album', 'text', 'notes'].every((field) => isOptionalString(item[field]))
    && (item.summary == null || (typeof item.summary === 'object' && Array.isArray(item.summary.sentences)));
}

export function normalizeCapture(item) {
  const text = item.text ?? '';
  return {
    ...item,
    mode: MODES.some((mode) => mode.id === item.mode) ? item.mode : DEFAULT_MODE,
    album: item.album?.trim() || DEFAULT_ALBUM,
    title: item.title?.trim() || 'Captura sem título',
    titleAuto: Boolean(item.titleAuto),
    text,
    notes: item.notes ?? '',
    summary: item.summary ?? null,
    ocrStatus: OCR_STATUSES.includes(item.ocrStatus) ? item.ocrStatus : (text ? 'done' : 'idle'),
    ocrConfidence: item.ocrConfidence ?? null,
    ocrError: item.ocrError ?? null,
    duration: item.duration ?? null
  };
}

// Aceita o texto do arquivo ou o objeto já lido (resposta do servidor).
export function parseLibraryFile(input) {
  let data = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      throw new LibraryFormatError('O arquivo não é um JSON válido.');
    }
  }
  if (!data || typeof data !== 'object' || data.formato !== LIBRARY_FORMAT) {
    throw new LibraryFormatError('Este arquivo não é uma exportação da biblioteca JOVI.');
  }
  if (data.versao !== LIBRARY_VERSION) {
    throw new LibraryFormatError(`Versão ${data.versao} do arquivo não é suportada.`);
  }
  if (!Array.isArray(data.capturas)) throw new LibraryFormatError('O arquivo não tem a lista de capturas.');
  if (data.capturas.length > MAX_CAPTURES) throw new LibraryFormatError(`O arquivo tem mais de ${MAX_CAPTURES} capturas.`);

  const captures = data.capturas.filter(isValidCapture).map(normalizeCapture);
  return {
    albums: (Array.isArray(data.albuns) ? data.albuns : []).filter((name) => typeof name === 'string' && name.trim()).map((name) => name.trim()),
    captures,
    deleted: Array.isArray(data.excluidas) ? data.excluidas.filter((id) => typeof id === 'string') : [],
    invalid: data.capturas.length - captures.length
  };
}

const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Decide o que criar e o que atualizar, sem tocar no armazenamento.
export function planMerge(localCaptures, incomingCaptures, skipIds = new Set()) {
  const local = new Map(localCaptures.map((capture) => [capture.id, capture]));
  const plan = { create: [], update: [], unchanged: 0, skipped: 0 };

  incomingCaptures.forEach((incoming) => {
    const current = local.get(incoming.id);
    if (!current) {
      // Vídeo sem o arquivo original não pode ser reconstruído no navegador.
      if (skipIds.has(incoming.id) || incoming.kind === 'video') plan.skipped += 1;
      else plan.create.push(incoming);
      return;
    }
    if (Date.parse(incoming.updatedAt) <= Date.parse(current.updatedAt)) {
      plan.unchanged += 1;
      return;
    }
    const changed = SYNCED_FIELDS.filter((field) => field in incoming && !sameValue(incoming[field], current[field]));
    if (!changed.length) {
      plan.unchanged += 1;
      return;
    }
    const changes = Object.fromEntries(changed.map((field) => [field, incoming[field]]));
    plan.update.push({ id: incoming.id, changes: { ...changes, updatedAt: incoming.updatedAt } });
  });

  return plan;
}

export function mergeAlbumNames(localAlbums, incomingAlbums, captures = []) {
  const seen = new Set();
  return [...localAlbums, ...incomingAlbums, ...captures.map((capture) => capture.album)].filter((name) => {
    const key = name?.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Ids excluídos no app: vão no arquivo para o JOVI Desktop mandá-los para a lixeira
// e para a captura não voltar na próxima sincronização.
export function getDeletedIds() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(DELETED_KEY) ?? '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function saveDeletedIds(ids) {
  try {
    window.localStorage.setItem(DELETED_KEY, JSON.stringify(ids.slice(-MAX_DELETED)));
  } catch {
    // armazenamento cheio ou bloqueado: a exclusão só não é sincronizada
  }
}

export function rememberDeleted(id) {
  saveDeletedIds([...getDeletedIds().filter((item) => item !== id), id]);
}

export function forgetDeleted(id) {
  saveDeletedIds(getDeletedIds().filter((item) => item !== id));
}
