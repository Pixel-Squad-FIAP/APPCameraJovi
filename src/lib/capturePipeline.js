import { getMode } from '../data/modes.js';
import {
  adjustPixels,
  applyPortraitEffect,
  autoLevelsGrayscale,
  averageCanvases,
  canvasToBlob,
  createThumbnail,
  cropToGuide,
  drawSourceFrame,
  exposureToBrightness,
  loadImageCanvas,
  mapPixels,
  ratioToAspect
} from './imageProcessing.js';

const NIGHT_FRAMES = 4;
const NIGHT_FRAME_INTERVAL = 70;

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

function applyModeProcessing(canvas, mode, { useGuide }) {
  let output = canvas;
  if (mode.processing === 'portrait') output = applyPortraitEffect(output);
  if (useGuide && mode.guide) output = cropToGuide(output, mode.guide);
  if (mode.processing === 'document') output = mapPixels(output, autoLevelsGrayscale);
  return output;
}

async function finalize(canvas) {
  const [imageBlob, thumbBlob] = await Promise.all([
    canvasToBlob(canvas, 'image/jpeg', 0.92),
    createThumbnail(canvas)
  ]);
  return { imageBlob, thumbBlob, width: canvas.width, height: canvas.height };
}

// Captura a partir do <video> da câmera, respeitando proporção, zoom, espelhamento e exposição.
export async function captureFromVideo(video, { modeId, ratio, zoom, mirror, exposure }) {
  if (!video || video.readyState < 2 || !video.videoWidth) {
    throw new Error('A câmera ainda não está pronta.');
  }

  const mode = getMode(modeId);
  const frameOptions = { aspect: ratioToAspect(ratio), zoom, mirror };
  let canvas;

  if (mode.processing === 'night') {
    const frames = [];
    for (let index = 0; index < NIGHT_FRAMES; index += 1) {
      frames.push(drawSourceFrame(video, frameOptions));
      if (index < NIGHT_FRAMES - 1) await wait(NIGHT_FRAME_INTERVAL);
    }
    canvas = mapPixels(averageCanvases(frames), (data) => adjustPixels(data, { brightness: 1.45, contrast: 1.08, saturation: 1.05 }));
  } else {
    canvas = drawSourceFrame(video, frameOptions);
  }

  if (exposure) {
    const brightness = exposureToBrightness(exposure);
    mapPixels(canvas, (data) => adjustPixels(data, { brightness }));
  }

  return finalize(applyModeProcessing(canvas, mode, { useGuide: true }));
}

// Imagem importada do aparelho: sem recorte pela moldura (o enquadramento é outro),
// mas com o tratamento do modo (ex.: Documento deixa o papel branco).
export async function captureFromFile(file, { modeId }) {
  const mode = getMode(modeId);
  const canvas = await loadImageCanvas(file);
  return finalize(applyModeProcessing(canvas, mode, { useGuide: false }));
}

export async function thumbnailFromVideo(video) {
  const canvas = drawSourceFrame(video, {});
  return createThumbnail(canvas);
}
