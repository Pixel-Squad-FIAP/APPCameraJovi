const STOPWORDS = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'como', 'da', 'das', 'de', 'do', 'dos', 'e',
  'em', 'entre', 'era', 'essa', 'esse', 'esta', 'este', 'foi', 'na', 'nas',
  'no', 'nos', 'o', 'os', 'ou', 'para', 'pela', 'pelas', 'pelo', 'pelos',
  'por', 'que', 'se', 'sem', 'sao', 'ser', 'sua', 'suas', 'tambem', 'um',
  'uma', 'umas', 'uns'
]);

function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function splitSentences(text) {
  return normalizeText(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 24);
}

function tokenize(text) {
  return normalizeText(text)
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

export function createExtractiveSummary(text, maxSentences = 3) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return '';
  if (sentences.length <= maxSentences) return sentences.join(' ');

  const frequencies = new Map();
  tokenize(text).forEach((word) => {
    frequencies.set(word, (frequencies.get(word) || 0) + 1);
  });

  const ranked = sentences.map((sentence, index) => {
    const words = tokenize(sentence);
    const score = words.reduce((sum, word) => sum + (frequencies.get(word) || 0), 0) / Math.max(1, words.length);
    return { index, score, sentence };
  });

  return ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence)
    .join(' ');
}

export function buildStudentExportText(documentCapture) {
  const title = `Documento JOVI - ${new Date(documentCapture.createdAt).toLocaleString('pt-BR')}`;
  const documentText = documentCapture.documentText || documentCapture.ocrText || 'Nenhum texto reconhecido.';
  return [
    title,
    '',
    'Texto do documento:',
    documentText,
    '',
    'Resumo:',
    documentCapture.summary || 'Resumo ainda nao gerado.',
    '',
    'Anotacao:',
    documentCapture.annotation || 'Sem anotacao.'
  ].join('\n');
}
