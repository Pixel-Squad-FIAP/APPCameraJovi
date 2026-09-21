export function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(blob);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível carregar a imagem do documento.'));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error('Não foi possível gerar a imagem processada do documento.'));
    }, mimeType, quality);
  });
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getDefaultCorners(width, height) {
  const insetX = width * 0.08;
  const insetY = height * 0.08;
  return [
    { x: insetX, y: insetY },
    { x: width - insetX, y: insetY },
    { x: width - insetX, y: height - insetY },
    { x: insetX, y: height - insetY }
  ];
}

export async function getInitialDocumentCorners(blob) {
  const image = await loadImageFromBlob(blob);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  return getDefaultCorners(width, height);
}

export async function rectifyDocumentImage(blob, corners) {
  const image = await loadImageFromBlob(blob);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const safeCorners = (corners?.length === 4 ? corners : getDefaultCorners(sourceWidth, sourceHeight))
    .map((point) => ({
      x: clamp(point.x, 0, sourceWidth),
      y: clamp(point.y, 0, sourceHeight)
    }));
  const [topLeft, topRight, bottomRight, bottomLeft] = safeCorners;
  const outputWidth = Math.max(1, Math.round(Math.max(distance(topLeft, topRight), distance(bottomLeft, bottomRight))));
  const outputHeight = Math.max(1, Math.round(Math.max(distance(topLeft, bottomLeft), distance(topRight, bottomRight))));
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = sourceWidth;
  sourceCanvas.height = sourceHeight;
  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!sourceContext) throw new Error('Não foi possível preparar a correção do documento.');
  sourceContext.drawImage(image, 0, 0, sourceWidth, sourceHeight);
  const sourceData = sourceContext.getImageData(0, 0, sourceWidth, sourceHeight);

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;
  const outputContext = outputCanvas.getContext('2d', { willReadFrequently: true });
  if (!outputContext) throw new Error('Não foi possível retificar o documento.');
  const outputData = outputContext.createImageData(outputWidth, outputHeight);

  for (let y = 0; y < outputHeight; y += 1) {
    const v = outputHeight <= 1 ? 0 : y / (outputHeight - 1);
    for (let x = 0; x < outputWidth; x += 1) {
      const u = outputWidth <= 1 ? 0 : x / (outputWidth - 1);
      const topX = topLeft.x + (topRight.x - topLeft.x) * u;
      const topY = topLeft.y + (topRight.y - topLeft.y) * u;
      const bottomX = bottomLeft.x + (bottomRight.x - bottomLeft.x) * u;
      const bottomY = bottomLeft.y + (bottomRight.y - bottomLeft.y) * u;
      const sourceX = Math.round(topX + (bottomX - topX) * v);
      const sourceY = Math.round(topY + (bottomY - topY) * v);
      const clampedX = clamp(sourceX, 0, sourceWidth - 1);
      const clampedY = clamp(sourceY, 0, sourceHeight - 1);
      const sourceIndex = (clampedY * sourceWidth + clampedX) * 4;
      const outputIndex = (y * outputWidth + x) * 4;
      outputData.data[outputIndex] = sourceData.data[sourceIndex];
      outputData.data[outputIndex + 1] = sourceData.data[sourceIndex + 1];
      outputData.data[outputIndex + 2] = sourceData.data[sourceIndex + 2];
      outputData.data[outputIndex + 3] = sourceData.data[sourceIndex + 3];
    }
  }

  outputContext.putImageData(outputData, 0, 0);
  return {
    blob: await canvasToBlob(outputCanvas, 'image/jpeg', 0.96),
    corners: safeCorners,
    height: outputHeight,
    width: outputWidth
  };
}

export async function processDocumentImage(blob) {
  const image = await loadImageFromBlob(blob);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = sourceWidth < 1400 ? Math.min(2, 1400 / Math.max(1, sourceWidth)) : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Não foi possível preparar o processamento do documento.');
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  let min = 255;
  let max = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const luminance = Math.round(
      pixels[index] * 0.299
      + pixels[index + 1] * 0.587
      + pixels[index + 2] * 0.114
    );
    min = Math.min(min, luminance);
    max = Math.max(max, luminance);
    pixels[index] = luminance;
    pixels[index + 1] = luminance;
    pixels[index + 2] = luminance;
  }

  const low = Math.max(0, min - 8);
  const high = Math.min(255, max + 8);
  const adjustedRange = Math.max(1, high - low);
  const contrastBoost = adjustedRange < 80 ? 1.14 : 1.06;

  for (let index = 0; index < pixels.length; index += 4) {
    const normalized = ((pixels[index] - low) / adjustedRange) * 255;
    const contrasted = Math.max(0, Math.min(255, ((normalized - 128) * contrastBoost) + 128 + 3));
    pixels[index] = contrasted;
    pixels[index + 1] = contrasted;
    pixels[index + 2] = contrasted;
  }

  context.putImageData(imageData, 0, 0);

  const processedBlob = await canvasToBlob(canvas, 'image/jpeg', 0.96);

  return {
    blob: processedBlob,
    height: canvas.height,
    width: canvas.width
  };
}
