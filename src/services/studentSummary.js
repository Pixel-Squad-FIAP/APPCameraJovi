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

const SUBJECT_KEYWORDS = [
  { area: 'Matemática', words: ['função', 'equação', 'exponencial', 'logaritmo', 'fração', 'gráfico', 'variável', 'matriz', 'derivada', 'probabilidade'] },
  { area: 'Física', words: ['força', 'velocidade', 'aceleração', 'energia', 'massa', 'campo', 'elétrica', 'movimento', 'pressão'] },
  { area: 'Química', words: ['mol', 'átomo', 'molécula', 'reação', 'ácido', 'base', 'ligação', 'solução', 'tabela periódica'] },
  { area: 'Biologia', words: ['célula', 'organismo', 'dna', 'gene', 'evolução', 'tecido', 'sistema', 'proteína', 'ecologia'] },
  { area: 'História', words: ['século', 'guerra', 'revolução', 'império', 'colonial', 'política', 'sociedade', 'estado'] },
  { area: 'Geografia', words: ['território', 'clima', 'relevo', 'população', 'urbano', 'rural', 'mapa', 'região'] },
  { area: 'Linguagens', words: ['texto', 'verbo', 'sujeito', 'predicado', 'oração', 'narrativa', 'poema', 'linguagem'] }
];

function detectSubject(text) {
  const normalized = normalizeText(text).toLocaleLowerCase('pt-BR');
  const scored = SUBJECT_KEYWORDS.map((subject) => ({
    ...subject,
    score: subject.words.reduce((sum, word) => sum + (normalized.includes(word) ? 1 : 0), 0)
  })).sort((a, b) => b.score - a.score);

  return scored[0]?.score > 0 ? scored[0] : null;
}

function extractFormulas(text) {
  return Array.from(new Set(
    String(text || '')
      .split(/\n|;/)
      .map((line) => line.trim())
      .filter((line) => /[=+\-*/^√]|[a-z]\([a-z]\)|\b[a-z]\s*\^\s*[0-9a-z]/i.test(line))
      .slice(0, 6)
  ));
}

function getRelevantTerms(text, limit = 8) {
  const frequencies = new Map();
  tokenize(text).forEach((word) => frequencies.set(word, (frequencies.get(word) || 0) + 1));
  return Array.from(frequencies.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

export function createAcademicAnalysis(text) {
  const cleanText = normalizeText(text);
  if (!cleanText) return '';

  const subject = detectSubject(cleanText);
  const terms = getRelevantTerms(cleanText);
  const formulas = extractFormulas(text);
  const narrative = createExtractiveSummary(cleanText, 2);
  const area = subject?.area || 'Área não identificada com confiança';
  const theme = terms.slice(0, 3).join(', ') || 'tema não identificado';

  return [
    `A captura apresenta conteúdo de ${area}${subject ? `, com foco provável em ${theme}.` : '.'}`,
    '',
    'Tema principal:',
    subject ? theme : 'Não foi possível identificar um tema principal com segurança a partir do OCR.',
    '',
    'Conceitos relevantes:',
    ...(terms.length ? terms.map((term) => `- ${term}`) : ['- Nenhum conceito recorrente identificado.']),
    '',
    'Fórmulas ou expressões identificadas:',
    ...(formulas.length ? formulas.map((formula) => `- ${formula}`) : ['- Nenhuma fórmula clara foi identificada.']),
    '',
    'Pontos importantes:',
    ...(narrative ? splitSentences(narrative).map((sentence) => `- ${sentence}`) : ['- O texto reconhecido não possui frases suficientes para destacar pontos com segurança.']),
    '',
    'Observações:',
    '- A análise foi gerada localmente a partir do texto reconhecido e pode exigir revisão se o OCR tiver erros.',
    formulas.length ? '- Fórmulas matemáticas podem ter sido reconhecidas parcialmente pelo OCR.' : '- Não foram detectados padrões fortes de fórmula.'
  ].join('\n');
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
    documentCapture.summary || 'Analise ainda nao gerada.',
    '',
    'Anotacao:',
    documentCapture.annotation || 'Sem anotacao.'
  ].join('\n');
}
