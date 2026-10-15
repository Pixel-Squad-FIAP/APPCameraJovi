// Processamento de imagem feito no navegador com <canvas>.
// Funções "puras" (sem DOM) ficam no topo e são cobertas por testes.

export const MAX_OUTPUT_SIDE = 2048;

export function ratioToAspect(ratio) {
  const [w, h] = ratio.split(':').map(Number);
  return w && h ? w / h : 3 / 4;
}

// Maior retângulo central com a proporção desejada, reduzido pelo zoom digital.
export function computeCropRect(srcWidth, srcHeight, aspect, zoom = 1) {
  let width = srcWidth;
  let height = srcWidth / aspect;
  if (height > srcHeight) {
    height = srcHeight;
    width = srcHeight * aspect;
  }
  const factor = Math.max(1, zoom);
  width /= factor;
  height /= factor;
  return {
    x: (srcWidth - width) / 2,
    y: (srcHeight - height) / 2,
    width,
    height
  };
}

// Moldura-guia (documento/slide) centralizada dentro do quadro.
export function computeGuideRect(frameWidth, frameHeight, guideAspect, fill = 0.86) {
  let width = frameWidth * fill;
  let height = width / guideAspect;
  if (height > frameHeight * fill) {
    height = frameHeight * fill;
    width = height * guideAspect;
  }
  return {
    x: (frameWidth - width) / 2,
    y: (frameHeight - height) / 2,
    width,
    height
  };
}

// Posição do visor como nas câmeras de celular: a imagem ocupa sempre a largura toda e
// só a altura muda com a proporção. 3:4 e 1:1 ficam centralizados na mesma região
// (entre as barras); proporções mais altas (9:16) passam por trás dos controles.
export function computeViewfinderLayout({ width, height, aspect, insetTop = 0, insetBottom = 0 }) {
  let frameWidth = width;
  let frameHeight = width / aspect;
  if (frameHeight > height) {
    // tela mais larga que a imagem (ex.: celular deitado): encaixa pela altura
    frameHeight = height;
    frameWidth = height * aspect;
  }

  const available = Math.max(0, height - insetTop - insetBottom);
  const regionHeight = Math.min(width * (4 / 3), available);
  const regionTop = insetTop + (available - regionHeight) / 2;

  let top;
  if (frameHeight <= regionHeight) top = regionTop + (regionHeight - frameHeight) / 2;
  else if (frameHeight <= available) top = insetTop + (available - frameHeight) / 2;
  else if (insetTop + frameHeight <= height) top = insetTop;
  else top = (height - frameHeight) / 2;

  const frameBottom = top + frameHeight;
  return {
    top,
    left: (width - frameWidth) / 2,
    width: frameWidth,
    height: frameHeight,
    // distância do rodapé do container até onde os controles do visor (zoom) devem ficar
    controlsBottom: Math.max(height - frameBottom, insetBottom) + 12
  };
}

export function guideRectPercent(frameAspect, guide) {
  const rect = computeGuideRect(frameAspect, 1, guide.aspect, guide.fill);
  return {
    left: `${(rect.x / frameAspect) * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${(rect.width / frameAspect) * 100}%`,
    height: `${rect.height * 100}%`
  };
}

// Média de vários frames reduz o ruído em pouca luz (modo Noite).
export function averagePixelData(frames) {
  const length = frames[0].length;
  const output = new Uint8ClampedArray(length);
  for (let offset = 0; offset < length; offset += 1) {
    let sum = 0;
    for (let frame = 0; frame < frames.length; frame += 1) sum += frames[frame][offset];
    output[offset] = Math.round(sum / frames.length);
  }
  return output;
}

export function adjustPixels(data, { brightness = 1, contrast = 1, saturation = 1 } = {}) {
  for (let offset = 0; offset < data.length; offset += 4) {
    let r = data[offset] * brightness;
    let g = data[offset + 1] * brightness;
    let b = data[offset + 2] * brightness;
    if (saturation !== 1) {
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = gray + (r - gray) * saturation;
      g = gray + (g - gray) * saturation;
      b = gray + (b - gray) * saturation;
    }
    data[offset] = (r - 128) * contrast + 128;
    data[offset + 1] = (g - 128) * contrast + 128;
    data[offset + 2] = (b - 128) * contrast + 128;
  }
  return data;
}

// Converte para tons de cinza e estica o histograma (percentis 2% e 98%), deixando o papel branco.
export function autoLevelsGrayscale(data) {
  const histogram = new Uint32Array(256);
  const pixels = data.length / 4;
  for (let offset = 0; offset < data.length; offset += 4) {
    const gray = Math.round(0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2]);
    data[offset] = gray;
    histogram[gray] += 1;
  }

  const percentile = (target) => {
    let accumulated = 0;
    for (let level = 0; level < 256; level += 1) {
      accumulated += histogram[level];
      if (accumulated >= target) return level;
    }
    return 255;
  };

  const low = percentile(pixels * 0.02);
  const high = Math.max(low + 1, percentile(pixels * 0.98));
  const range = high - low;

  for (let offset = 0; offset < data.length; offset += 4) {
    const normalized = Math.min(1, Math.max(0, (data[offset] - low) / range));
    const value = Math.round(255 * Math.pow(normalized, 0.85));
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
  }
  return data;
}

export function exposureToBrightness(exposure) {
  return Math.pow(2, exposure * 0.6);
}

// ---------- Funções com DOM ----------

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function context2d(canvas) {
  return canvas.getContext('2d', { willReadFrequently: true });
}

function outputSize(width, height, maxSide = MAX_OUTPUT_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: width * scale, height: height * scale };
}

export function drawSourceFrame(source, { aspect, zoom = 1, mirror = false } = {}) {
  const sourceWidth = source.videoWidth || source.naturalWidth || source.width;
  const sourceHeight = source.videoHeight || source.naturalHeight || source.height;
  const crop = aspect
    ? computeCropRect(sourceWidth, sourceHeight, aspect, zoom)
    : { x: 0, y: 0, width: sourceWidth, height: sourceHeight };
  const size = outputSize(crop.width, crop.height);
  const canvas = createCanvas(size.width, size.height);
  const ctx = context2d(canvas);

  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function mapPixels(canvas, transform) {
  const ctx = context2d(canvas);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  transform(imageData.data);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function averageCanvases(canvases) {
  const [first] = canvases;
  const frames = canvases.map((canvas) => context2d(canvas).getImageData(0, 0, first.width, first.height).data);
  const output = createCanvas(first.width, first.height);
  const ctx = context2d(output);
  ctx.putImageData(new ImageData(averagePixelData(frames), first.width, first.height), 0, 0);
  return output;
}

export function cropCanvas(canvas, rect) {
  const output = createCanvas(rect.width, rect.height);
  context2d(output).drawImage(canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, output.width, output.height);
  return output;
}

export function cropToGuide(canvas, guide) {
  return cropCanvas(canvas, computeGuideRect(canvas.width, canvas.height, guide.aspect, guide.fill));
}

// Desfoque barato e compatível com todos os navegadores: reduz e amplia a imagem.
function blurredCopy(canvas, factor = 14) {
  const small = createCanvas(canvas.width / factor, canvas.height / factor);
  const smallCtx = context2d(small);
  smallCtx.imageSmoothingQuality = 'high';
  smallCtx.drawImage(canvas, 0, 0, small.width, small.height);
  const output = createCanvas(canvas.width, canvas.height);
  const ctx = context2d(output);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, output.width, output.height);
  return output;
}

// Efeito Retrato (simulado): mantém o centro nítido e desfoca as bordas com transição suave.
export function applyPortraitEffect(canvas) {
  const { width, height } = canvas;
  const sharpMask = createCanvas(width, height);
  const maskCtx = context2d(sharpMask);
  maskCtx.drawImage(canvas, 0, 0);
  const radius = Math.min(width, height) * 0.5;
  const gradient = maskCtx.createRadialGradient(width / 2, height * 0.45, radius * 0.45, width / 2, height * 0.45, radius * 1.05);
  gradient.addColorStop(0, 'rgba(0,0,0,1)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  maskCtx.globalCompositeOperation = 'destination-in';
  maskCtx.fillStyle = gradient;
  maskCtx.fillRect(0, 0, width, height);

  const output = blurredCopy(canvas);
  context2d(output).drawImage(sharpMask, 0, 0);
  return output;
}

export function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem.'))), type, quality);
  });
}

export async function createThumbnail(source, maxSide = 360) {
  const width = source.videoWidth || source.width;
  const height = source.videoHeight || source.height;
  const size = outputSize(width, height, maxSide);
  const canvas = createCanvas(size.width, size.height);
  context2d(canvas).drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvasToBlob(canvas, 'image/jpeg', 0.8);
}

export async function loadImageCanvas(blob) {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const size = outputSize(bitmap.width, bitmap.height);
  const canvas = createCanvas(size.width, size.height);
  context2d(canvas).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas;
}

// Prepara a imagem para o OCR: tamanho adequado + tons de cinza com contraste.
export async function prepareForOcr(blob) {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const longSide = Math.max(bitmap.width, bitmap.height);
  const scale = longSide < 1200 ? 1200 / longSide : Math.min(1, 2200 / longSide);
  const canvas = createCanvas(bitmap.width * scale, bitmap.height * scale);
  const ctx = context2d(canvas);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return mapPixels(canvas, autoLevelsGrayscale);
}
