// Análise leve de cena feita sobre um frame reduzido (ex.: 64x48) do visor.
// Não usa IA: são heurísticas de luminância, "cor de papel" e bordas.

export const SAMPLE_WIDTH = 64;
export const SAMPLE_HEIGHT = 48;
export const MIN_CONFIDENCE = 0.6;

const LOW_LIGHT_THRESHOLD = 0.2;
const PAPER_RATIO_THRESHOLD = 0.4;

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function lumaAt(data, offset) {
  return (0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2]) / 255;
}

export function analyzeFrame(data, width, height) {
  const pixels = width * height;
  if (!pixels) return { luminance: 0, paperRatio: 0, edgeDensity: 0 };

  const luma = new Float32Array(pixels);
  let lumaSum = 0;
  let paperPixels = 0;
  let centerPixels = 0;
  const x0 = Math.floor(width * 0.2);
  const x1 = Math.ceil(width * 0.8);
  const y0 = Math.floor(height * 0.15);
  const y1 = Math.ceil(height * 0.85);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const offset = index * 4;
      const value = lumaAt(data, offset);
      luma[index] = value;
      lumaSum += value;

      if (x >= x0 && x < x1 && y >= y0 && y < y1) {
        centerPixels += 1;
        const max = Math.max(data[offset], data[offset + 1], data[offset + 2]);
        const min = Math.min(data[offset], data[offset + 1], data[offset + 2]);
        const saturation = max === 0 ? 0 : (max - min) / max;
        if (value > 0.55 && saturation < 0.2) paperPixels += 1;
      }
    }
  }

  let edges = 0;
  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const index = y * width + x;
      const gradient = Math.abs(luma[index] - luma[index + 1]) + Math.abs(luma[index] - luma[index + width]);
      if (gradient > 0.18) edges += 1;
    }
  }

  return {
    luminance: lumaSum / pixels,
    paperRatio: centerPixels ? paperPixels / centerPixels : 0,
    edgeDensity: edges / ((width - 1) * (height - 1) || 1)
  };
}

// Retorna a sugestão de modo mais confiável para a cena, ou null (mantém o modo atual).
export function suggestMode(metrics, currentMode) {
  if (!metrics) return null;
  const candidates = [];

  if (currentMode !== 'noite' && currentMode !== 'video' && metrics.luminance < LOW_LIGHT_THRESHOLD) {
    candidates.push({
      type: 'lowLight',
      mode: 'noite',
      confidence: clamp(0.55 + (LOW_LIGHT_THRESHOLD - metrics.luminance) * 4)
    });
  }

  // Papel claro ocupando o centro + algum texto (bordas), mas não uma cena cheia de detalhes.
  const looksLikeText = metrics.edgeDensity > 0.015 && metrics.edgeDensity < 0.35;
  if (!['documento', 'estudante', 'video'].includes(currentMode)
    && metrics.paperRatio > PAPER_RATIO_THRESHOLD
    && looksLikeText
    && metrics.luminance >= LOW_LIGHT_THRESHOLD) {
    candidates.push({
      type: 'document',
      mode: 'documento',
      confidence: clamp(0.4 + (metrics.paperRatio - PAPER_RATIO_THRESHOLD) * 1.5 + Math.min(metrics.edgeDensity, 0.1))
    });
  }

  const best = candidates.sort((a, b) => b.confidence - a.confidence)[0];
  return best && best.confidence >= MIN_CONFIDENCE ? best : null;
}
