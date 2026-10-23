import { describe, expect, it } from 'vitest';
import {
  autoLevelsGrayscale,
  averagePixelData,
  computeCropRect,
  computeGuideRect,
  computeViewfinderLayout,
  ratioToAspect
} from './imageProcessing.js';
import { cleanOcrText, countWords, titleFromText } from './ocrText.js';
import { analyzeFrame, suggestMode } from './sceneAnalysis.js';
import { splitSentences, summarize, textFingerprint } from './summarize.js';
import {
  activePreset,
  clampZoom,
  formatZoom,
  smoothStep,
  splitZoom,
  zoomFromDrag,
  zoomFromPinch,
  zoomFromWheel,
  zoomToRulerPosition
} from './zoom.js';

const STUDY_TEXT = `A termodinâmica estuda a energia e suas transformações. A primeira lei da termodinâmica afirma que a energia de um sistema isolado se conserva.
Em máquinas térmicas, parte do calor é convertida em trabalho. O rendimento de uma máquina térmica nunca chega a cem por cento.
A segunda lei explica por que o calor flui do corpo quente para o frio. Exemplos do cotidiano incluem geladeiras e motores de carro.
Na prova, revise a conservação de energia e os ciclos térmicos.`;

describe('summarize', () => {
  it('separa frases', () => {
    expect(splitSentences('Primeira frase. Segunda frase! Terceira?')).toHaveLength(3);
  });

  it('gera resumo menor que o texto e na ordem original', () => {
    const result = summarize(STUDY_TEXT, 'curto');
    expect(result.sourceSentences).toBe(7);
    expect(result.sentences.length).toBeGreaterThan(0);
    expect(result.sentences.length).toBeLessThan(result.sourceSentences);
    const positions = result.sentences.map((sentence) => STUDY_TEXT.replace(/\s+/g, ' ').indexOf(sentence));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(result.keywords).toContain('termodinâmica');
    const summaryText = result.sentences.join(' ').toLowerCase();
    expect(result.keywords.every((keyword) => summaryText.includes(keyword))).toBe(true);
  });

  it('resumo médio tem pelo menos o tamanho do curto', () => {
    expect(summarize(STUDY_TEXT, 'medio').sentences.length).toBeGreaterThanOrEqual(summarize(STUDY_TEXT, 'curto').sentences.length);
  });

  it('não junta título com a frase seguinte nem usa título como frase', () => {
    const result = summarize('Fotossíntese\n\nA fotossíntese produz glicose a partir da luz. Ela ocorre nos cloroplastos das plantas verdes.', 'medio');
    expect(result.sentences.every((sentence) => !sentence.startsWith('Fotossíntese'))).toBe(true);
  });

  it('lida com texto vazio', () => {
    expect(summarize('').sentences).toEqual([]);
  });

  it('fingerprint muda quando o texto muda', () => {
    expect(textFingerprint('abc')).not.toBe(textFingerprint('abd'));
  });
});

describe('ocrText', () => {
  it('junta hifenização e remove ruído', () => {
    expect(cleanOcrText('A conser-\nvação de energia\n|\n\nNovo parágrafo')).toBe('A conservação de energia\n\nNovo parágrafo');
  });

  it('separa título colado no parágrafo', () => {
    expect(cleanOcrText('Revolução Industrial\nA Revolução Industrial começou na\nInglaterra no século XVIII.'))
      .toBe('Revolução Industrial\n\nA Revolução Industrial começou na Inglaterra no século XVIII.');
    expect(cleanOcrText('A produção começou na\nInglaterra no século XVIII.')).toBe('A produção começou na Inglaterra no século XVIII.');
  });

  it('conta palavras e gera título', () => {
    expect(countWords('Lei de Ohm: V = R . I')).toBe(6);
    expect(titleFromText('x\nCapítulo 3 Termodinâmica\nresto')).toBe('Capítulo 3 Termodinâmica');
    expect(titleFromText('Fotossíntese\n\nA fotossíntese é...')).toBe('Fotossíntese');
  });
});

describe('imageProcessing', () => {
  it('recorta 3:4 de um frame 16:9 com zoom', () => {
    const rect = computeCropRect(1920, 1080, ratioToAspect('3:4'), 2);
    expect(rect.height).toBeCloseTo(540);
    expect(rect.width).toBeCloseTo(405);
    expect(rect.x).toBeCloseTo((1920 - 405) / 2);
  });

  it('visor ocupa a largura toda em qualquer proporção, como no celular', () => {
    const screen = { width: 390, height: 844, insetTop: 56, insetBottom: 185 };
    const r34 = computeViewfinderLayout({ ...screen, aspect: 3 / 4 });
    const r11 = computeViewfinderLayout({ ...screen, aspect: 1 });
    const r916 = computeViewfinderLayout({ ...screen, aspect: 9 / 16 });
    [r34, r11, r916].forEach((layout) => {
      expect(layout.width).toBe(390);
      expect(layout.left).toBe(0);
    });
    expect(r34.height).toBeCloseTo(520);
    expect(r11.top + r11.height / 2).toBeCloseTo(r34.top + r34.height / 2); // mesmo centro
    expect(r916.top).toBe(56); // começa logo abaixo da barra superior
    expect(r916.top + r916.height).toBeLessThanOrEqual(844);
  });

  it('moldura cabe dentro do quadro', () => {
    const rect = computeGuideRect(0.75, 1, 1 / 1.414, 0.86);
    expect(rect.width).toBeLessThanOrEqual(0.75 * 0.86 + 1e-9);
    expect(rect.height).toBeLessThanOrEqual(0.86 + 1e-9);
  });

  it('média de frames', () => {
    expect([...averagePixelData([new Uint8ClampedArray([0, 100]), new Uint8ClampedArray([10, 200])])]).toEqual([5, 150]);
  });

  it('auto levels estica o contraste', () => {
    const data = new Uint8ClampedArray([100, 100, 100, 255, 150, 150, 150, 255]);
    autoLevelsGrayscale(data);
    expect(data[0]).toBe(0);
    expect(data[4]).toBe(255);
  });
});

function solidFrame(width, height, [r, g, b]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = 255;
  }
  return data;
}

describe('sceneAnalysis', () => {
  it('sugere Noite em cena escura', () => {
    const metrics = analyzeFrame(solidFrame(64, 48, [20, 20, 25]), 64, 48);
    expect(suggestMode(metrics, 'foto')?.mode).toBe('noite');
    expect(suggestMode(metrics, 'noite')).toBeNull();
  });

  it('sugere Documento para papel com texto', () => {
    const data = solidFrame(64, 48, [235, 235, 230]);
    // linhas de "texto"
    for (let y = 10; y < 40; y += 4) {
      for (let x = 14; x < 50; x += 1) {
        const offset = (y * 64 + x) * 4;
        data[offset] = 20;
        data[offset + 1] = 20;
        data[offset + 2] = 20;
      }
    }
    const metrics = analyzeFrame(data, 64, 48);
    expect(suggestMode(metrics, 'foto')?.mode).toBe('documento');
    expect(suggestMode(metrics, 'documento')).toBeNull();
  });

  it('não sugere nada em cena comum', () => {
    const metrics = analyzeFrame(solidFrame(64, 48, [90, 130, 70]), 64, 48);
    expect(suggestMode(metrics, 'foto')).toBeNull();
  });
});

describe('zoom', () => {
  it('limita entre 1x e 5x', () => {
    expect(clampZoom(0.5)).toBe(1);
    expect(clampZoom(9)).toBe(5);
    expect(clampZoom(Number.NaN)).toBe(1);
  });

  it('arrastar 180px para cima dobra o zoom e para baixo reduz', () => {
    expect(zoomFromDrag(1, -180)).toBeCloseTo(2);
    expect(zoomFromDrag(2, -180)).toBeCloseTo(4);
    expect(zoomFromDrag(2, 180)).toBeCloseTo(1);
    expect(zoomFromDrag(1, 500)).toBe(1);
    expect(zoomFromDrag(4, -1000)).toBe(5);
  });

  it('pinça e roda do mouse', () => {
    expect(zoomFromPinch(1, 100, 250)).toBeCloseTo(2.5);
    expect(zoomFromPinch(2, 0, 100)).toBe(2);
    expect(zoomFromWheel(2, -600)).toBeCloseTo(4);
    expect(zoomFromWheel(2, 600)).toBeCloseTo(1);
  });

  it('suavização converge sem ultrapassar o alvo', () => {
    let value = 1;
    const values = [];
    for (let frame = 0; frame < 60; frame += 1) {
      value = smoothStep(value, 5, 16);
      values.push(value);
    }
    expect(values[0]).toBeGreaterThan(1);
    expect(values[0]).toBeLessThan(2);
    expect(values.every((item, index) => index === 0 || item >= values[index - 1])).toBe(true);
    expect(Math.max(...values)).toBeLessThanOrEqual(5);
    expect(values.at(-1)).toBe(5);
  });

  it('formata, escolhe o preset e divide o zoom do sensor', () => {
    expect(formatZoom(1)).toBe('1x');
    expect(formatZoom(1.74)).toBe('1,7x');
    expect(formatZoom(2.98)).toBe('3x');
    expect(activePreset(1.6)).toBe(1);
    expect(activePreset(3)).toBe(2);
    expect(activePreset(5)).toBe(5);
    expect(splitZoom(4, 2)).toBe(2);
    expect(splitZoom(1.5, 3)).toBe(1);
    expect(zoomToRulerPosition(1)).toBe(0);
    expect(zoomToRulerPosition(5)).toBeCloseTo(1);
  });
});
