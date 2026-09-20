function loadImageFromBlob(blob) {
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

export async function processDocumentImage(blob) {
  const image = await loadImageFromBlob(blob);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Não foi possível preparar o processamento do documento.');
  }

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

  const range = Math.max(1, max - min);
  const contrastBoost = range < 90 ? 1.25 : 1.08;

  for (let index = 0; index < pixels.length; index += 4) {
    const normalized = ((pixels[index] - min) / range) * 255;
    const contrasted = Math.max(0, Math.min(255, ((normalized - 128) * contrastBoost) + 128));
    pixels[index] = contrasted;
    pixels[index + 1] = contrasted;
    pixels[index + 2] = contrasted;
  }

  context.putImageData(imageData, 0, 0);

  const processedBlob = await canvasToBlob(canvas, 'image/jpeg', 0.92);

  return {
    blob: processedBlob,
    height: canvas.height,
    width: canvas.width
  };
}
