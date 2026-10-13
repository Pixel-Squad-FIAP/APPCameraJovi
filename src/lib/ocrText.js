// Título: linha curta, sem pontuação final e com as palavras principais em maiúscula.
export function isHeadingLine(line) {
  if (/[.!?;:,]$/.test(line)) return false;
  const words = line.match(/[A-Za-zÀ-ÿ0-9]+/g) ?? [];
  const mainWords = words.filter((word) => word.length >= 4);
  return words.length <= 6 && mainWords.length > 0 && mainWords.every((word) => /^[A-ZÀ-Ý0-9]/.test(word));
}

// Limpeza do texto bruto retornado pelo Tesseract.
export function cleanOcrText(raw) {
  if (!raw) return '';

  const paragraphs = raw
    .replace(/\r/g, '')
    // junta palavras hifenizadas na quebra de linha: "conser-\nvação" -> "conservação"
    .replace(/([A-Za-zÀ-ÿ])-\n([a-zà-ÿ])/g, '$1$2')
    .split(/\n{2,}/)
    .flatMap((paragraph) => {
      const lines = paragraph
        .split('\n')
        .map((line) => line.trim())
        // descarta linhas que são só ruído (sem letras/números ou muito curtas)
        .filter((line) => /[A-Za-zÀ-ÿ0-9]/.test(line) && line.replace(/[^A-Za-zÀ-ÿ0-9]/g, '').length >= 2);
      // um título colado no parágrafo vira um parágrafo próprio
      const heading = lines.length > 1 && isHeadingLine(lines[0]) ? [lines.shift()] : [];
      return [...heading, lines.join(' ')];
    })
    .map((paragraph) => paragraph.replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean);

  return paragraphs.join('\n\n');
}

export function countWords(text) {
  return (text?.match(/[A-Za-zÀ-ÿ0-9]+/g) ?? []).length;
}

export function titleFromText(text, maxLength = 48) {
  // Primeira linha com conteúdo real (um título de uma palavra só também vale).
  const firstLine = (text ?? '').split('\n').map((line) => line.trim())
    .find((line) => countWords(line) >= 2 || line.replace(/[^A-Za-zÀ-ÿ]/g, '').length >= 4);
  if (!firstLine) return '';
  return firstLine.length > maxLength ? `${firstLine.slice(0, maxLength - 1).trimEnd()}…` : firstLine;
}
