import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildLibraryFile,
  LibraryFormatError,
  mergeAlbumNames,
  parseLibraryFile,
  planMerge,
  toTransferCapture
} from './libraryTransfer.js';

const capture = (id, overrides = {}) => ({
  id,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  kind: 'photo',
  mode: 'documento',
  album: 'Aulas',
  title: `Captura ${id}`,
  titleAuto: true,
  text: 'Texto',
  ocrStatus: 'done',
  summary: null,
  notes: '',
  ...overrides
});

describe('libraryTransfer', () => {
  it('serializa sem o Blob da miniatura e sem o estado transitório do OCR', () => {
    const item = toTransferCapture(capture('a', { thumbBlob: {}, ocrStatus: 'processing' }), 'data:image/jpeg;base64,AA');
    expect(item).not.toHaveProperty('thumbBlob');
    expect(item.ocrStatus).toBe('idle');
    expect(item.thumbDataUrl).toBe('data:image/jpeg;base64,AA');
    const file = buildLibraryFile([item], ['Geral'], { deleted: ['x'] });
    expect(file).toMatchObject({ formato: 'jovi-biblioteca', versao: 1, origem: 'app', excluidas: ['x'] });
  });

  it('rejeita arquivos que não são da biblioteca JOVI', () => {
    expect(() => parseLibraryFile('{ quebrado')).toThrow(LibraryFormatError);
    expect(() => parseLibraryFile({ formato: 'outro' })).toThrow(LibraryFormatError);
    expect(() => parseLibraryFile({ formato: 'jovi-biblioteca', versao: 2, capturas: [] })).toThrow(LibraryFormatError);
  });

  it('pula capturas inválidas e normaliza as válidas', () => {
    const parsed = parseLibraryFile({
      formato: 'jovi-biblioteca',
      versao: 1,
      albuns: ['Geral', ' Bio ', 3],
      capturas: [capture('a', { mode: 'xyz', album: '' }), { id: 'b' }, capture('c', { kind: 'audio' })],
      excluidas: ['z', 1]
    });
    expect(parsed.captures.map((item) => item.id)).toEqual(['a']);
    expect(parsed.captures[0]).toMatchObject({ mode: 'foto', album: 'Geral' });
    expect(parsed).toMatchObject({ albums: ['Geral', 'Bio'], deleted: ['z'], invalid: 2 });
  });

  it('planeja a mesclagem: nova, mais recente, antiga, excluída e vídeo sem arquivo', () => {
    const local = [capture('x', { notes: 'local' }), capture('y')];
    const incoming = [
      capture('x', { updatedAt: '2026-10-05T10:00:00.000Z', notes: 'do Python', summary: { sentences: ['A.'] } }),
      capture('y', { updatedAt: '2026-09-01T10:00:00.000Z', notes: 'antiga' }),
      capture('novo'),
      capture('excluido'),
      capture('video', { kind: 'video' })
    ];
    const plan = planMerge(local, incoming, new Set(['excluido']));
    expect(plan.create.map((item) => item.id)).toEqual(['novo']);
    expect(plan.update).toEqual([{
      id: 'x',
      changes: { notes: 'do Python', summary: { sentences: ['A.'] }, updatedAt: '2026-10-05T10:00:00.000Z' }
    }]);
    expect(plan).toMatchObject({ unchanged: 1, skipped: 2 });
  });

  it('une álbuns sem duplicar (sem diferenciar maiúsculas)', () => {
    expect(mergeAlbumNames(['Geral', 'Aulas'], ['aulas', 'Bio'], [{ album: 'Química' }, { album: 'Bio' }]))
      .toEqual(['Geral', 'Aulas', 'Bio', 'Química']);
  });

  it('aceita a biblioteca de exemplo gerada pelo JOVI Desktop (Python)', () => {
    const file = readFileSync(new URL('../../python/dados/exemplo_biblioteca.json', import.meta.url), 'utf8');
    const parsed = parseLibraryFile(file);
    expect(parsed.invalid).toBe(0);
    const plan = planMerge([], parsed.captures);
    expect(plan.create.length).toBe(6); // o vídeo fica de fora: não há arquivo para reconstruir
  });
});
