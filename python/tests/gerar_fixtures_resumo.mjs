// Gera python/tests/fixtures/resumos.json rodando o resumo REAL do app (src/lib/summarize.js).
// O teste python/tests/test_resumo.py compara o porte em Python com estas saídas.
// Uso (na raiz do projeto): node python/tests/gerar_fixtures_resumo.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { keywordsInSummary, splitSentences, summarize, textFingerprint } from '../../src/lib/summarize.js';

const here = dirname(fileURLToPath(import.meta.url));
const exemplo = JSON.parse(readFileSync(join(here, '..', 'dados', 'exemplo_biblioteca.json'), 'utf8'));

const textos = [
  ...exemplo.capturas.map((captura) => captura.text).filter(Boolean),
  '',
  'Curto demais.',
  'TÍTULO EM CAIXA ALTA\nPrimeira frase do conteúdo com várias palavras. Segunda frase continua o tema principal do conteúdo; Terceira frase encerra.',
  '• Item de lista com marcador e palavras suficientes\n- Outro item com hífen e palavras suficientes\n– Travessão também conta como marcador aqui',
  'Emoji 📷 fora do BMP muda o comprimento em UTF-16. Câmera câmera CÂMERA acentuação é normalizada! "Aspas abrem frase". (Parênteses também) 123 números contam.',
  'Linha um sem ponto\n\n\nLinha dois depois de várias quebras\tcom\ttabs e   espaços   múltiplos. Espaço duro no fim. ',
  'Repetição repetição repetição. Palavra palavra palavra repetição. Termo termo repetição palavra. Outro outro termo. Fim fim fim palavra termo.'
];

const casos = textos.flatMap((texto) => ['curto', 'medio'].map((tamanho) => {
  const resumo = summarize(texto, tamanho);
  return {
    texto,
    tamanho,
    frases: splitSentences(texto),
    resumo,
    palavrasNoResumo: keywordsInSummary(resumo),
    impressao: textFingerprint(texto)
  };
}));

writeFileSync(join(here, 'fixtures', 'resumos.json'), `${JSON.stringify(casos, null, 2)}\n`);
console.log(`${casos.length} casos gravados em python/tests/fixtures/resumos.json`);
