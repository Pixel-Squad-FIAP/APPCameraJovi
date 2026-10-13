// Resumo extrativo: escolhe as frases mais representativas do próprio texto,
// pontuadas pela frequência normalizada dos termos relevantes.

const STOPWORDS = new Set(`
a ao aos aquela aquelas aquele aqueles aquilo as ate com como da das de dela delas dele deles depois
do dos e ela elas ele eles em entre era eram essa essas esse esses esta estas este estes eu foi foram
ha isso isto ja la lhe lhes mais mas me mesmo meu minha muito na nas nem no nos nossa nosso num numa
o os ou para pela pelas pelo pelos por qual quando que quem se sem ser seu seus sua suas sao so tambem
te tem tinha tu tua um uma umas uns voce voces vos sobre ser sendo pode podem assim onde ainda apenas
cada outro outra outros outras todo toda todos todas tal tais the of and to in is
`.trim().split(/\s+/));

export const SUMMARY_LENGTHS = {
  curto: { label: 'Curto', ratio: 0.2, min: 1, max: 3 },
  medio: { label: 'Médio', ratio: 0.4, min: 2, max: 6 }
};

export function normalizeWord(word) {
  return word.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function words(sentence) {
  return (sentence.match(/[\p{L}\d]+/gu) ?? [])
    .map((word) => ({ original: word.toLowerCase(), token: normalizeWord(word) }))
    .filter(({ token }) => token.length > 2 && !STOPWORDS.has(token));
}

export function tokenize(sentence) {
  return words(sentence).map(({ token }) => token);
}

// Cada linha/parágrafo é tratado separadamente para que títulos não se juntem à frase seguinte.
export function splitSentences(text) {
  return (text ?? '')
    .split(/\n+/)
    .flatMap((paragraph) => paragraph
      .replace(/\s+/g, ' ')
      .trim()
      .split(/(?<=[.!?…;])\s+(?=[A-ZÀ-Ý0-9"“(•\-–])/u))
    .map((sentence) => sentence.replace(/^[•\-–]\s*/, '').trim())
    .filter((sentence) => sentence.length > 0);
}

function termFrequencies(sentences) {
  const frequencies = new Map();
  const display = new Map();
  sentences.forEach((sentence) => {
    words(sentence).forEach(({ original, token }) => {
      frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
      if (!display.has(token)) display.set(token, original);
    });
  });
  return { frequencies, display };
}

const MIN_SENTENCE_WORDS = 4;

export function summarize(text, length = 'curto') {
  const config = SUMMARY_LENGTHS[length] ?? SUMMARY_LENGTHS.curto;
  const allSentences = splitSentences(text ?? '');
  // Títulos e linhas soltas entram na contagem de termos, mas não viram frases do resumo.
  const fullSentences = allSentences.filter((sentence) => (sentence.match(/[\p{L}\d]+/gu) ?? []).length >= MIN_SENTENCE_WORDS);
  const sentences = fullSentences.length ? fullSentences : allSentences;

  if (sentences.length === 0) {
    return { sentences: [], keywords: [], sourceSentences: 0 };
  }

  const { frequencies, display } = termFrequencies(allSentences);
  const maxFrequency = Math.max(1, ...frequencies.values());

  const scored = sentences.map((sentence, index) => {
    const tokens = tokenize(sentence);
    const weight = tokens.reduce((sum, token) => sum + frequencies.get(token) / maxFrequency, 0);
    // Raiz do tamanho evita favorecer apenas frases longas; a primeira frase costuma introduzir o tema.
    const positionBonus = index === 0 ? 0.15 : 0;
    const score = tokens.length ? weight / Math.sqrt(tokens.length) + positionBonus : 0;
    return { sentence, index, score };
  });

  const count = Math.min(
    sentences.length,
    Math.max(config.min, Math.min(config.max, Math.round(sentences.length * config.ratio)))
  );

  const selected = [...scored]
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence);

  const keywords = [...frequencies.entries()]
    .filter(([, frequency]) => frequency > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([token]) => display.get(token));

  return { sentences: selected, keywords, sourceSentences: sentences.length };
}

// Hash simples para saber se o resumo ainda corresponde ao texto atual.
export function textFingerprint(text) {
  let hash = 0;
  const value = text ?? '';
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return `${value.length}:${hash}`;
}
