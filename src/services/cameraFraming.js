export const ASPECT_RATIOS = {
  '3:4': 3 / 4,
  '9:16': 9 / 16,
  '1:1': 1,
  Full: 9 / 16
};

const DIGITAL_ZOOM_FACTORS = {
  '.5': 1,
  1: 1,
  2: 1.5,
  3: 2.2
};

const REQUESTED_HARDWARE_ZOOM = {
  '.5': 0.5,
  1: 1,
  2: 2,
  3: 3
};

export const DOCUMENT_FRAME_ASPECT_RATIO = 280 / 380;
const DOCUMENT_FRAME = {
  aspectRatio: 280 / 380,
  maxHeightRatio: 0.76,
  topRatio: 0.42,
  widthRatio: 0.72
};

export function getAspectRatio(ratio) {
  if (Number.isFinite(ratio) && ratio > 0) return ratio;
  return ASPECT_RATIOS[ratio] || ASPECT_RATIOS['3:4'];
}

export function getDigitalZoomFactor(zoomLevel) {
  return DIGITAL_ZOOM_FACTORS[zoomLevel] || 1;
}

export function getRequestedHardwareZoom(zoomLevel) {
  return REQUESTED_HARDWARE_ZOOM[zoomLevel] || 1;
}

export function calculateSourceRect(videoWidth, videoHeight, ratio, zoomFactor = 1) {
  const aspectRatio = getAspectRatio(ratio);
  const sourceAspectRatio = videoWidth / videoHeight;
  let width = videoWidth;
  let height = videoHeight;

  if (sourceAspectRatio > aspectRatio) {
    width = videoHeight * aspectRatio;
  } else {
    height = videoWidth / aspectRatio;
  }

  const safeZoom = Math.max(1, Number(zoomFactor) || 1);
  width /= safeZoom;
  height /= safeZoom;

  return {
    height,
    width,
    x: (videoWidth - width) / 2,
    y: (videoHeight - height) / 2
  };
}

export function createFramingPlan(videoWidth, videoHeight, ratio, zoomFactor = 1) {
  const sourceRect = calculateSourceRect(videoWidth, videoHeight, ratio, zoomFactor);
  const aspectRatio = getAspectRatio(ratio);
  let outputWidth = Math.max(1, Math.round(sourceRect.width));
  let outputHeight = Math.max(1, Math.round(outputWidth / aspectRatio));

  if (outputHeight > Math.round(sourceRect.height)) {
    outputHeight = Math.max(1, Math.round(sourceRect.height));
    outputWidth = Math.max(1, Math.round(outputHeight * aspectRatio));
  }

  return {
    outputHeight,
    outputWidth,
    sourceRect: {
      height: sourceRect.height,
      width: sourceRect.width,
      x: sourceRect.x,
      y: sourceRect.y
    }
  };
}

export function getFramedCanvasSize(videoWidth, videoHeight, ratio, zoomFactor = 1) {
  const plan = createFramingPlan(videoWidth, videoHeight, ratio, zoomFactor);

  return {
    height: plan.outputHeight,
    width: plan.outputWidth
  };
}

export function drawFramedVideoFrame(context, video, options) {
  const {
    mirror = false,
    ratio,
    zoomFactor = 1
  } = options;
  const plan = createFramingPlan(video.videoWidth, video.videoHeight, ratio, zoomFactor);
  const rect = plan.sourceRect;
  const canvas = context.canvas;

  context.save();
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (mirror) {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }

  context.drawImage(
    video,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    canvas.width,
    canvas.height
  );
  context.restore();
}

export function getDocumentCanvasSize(videoWidth, videoHeight, viewportWidth, viewportHeight, zoomFactor = 1) {
  const rect = calculateDocumentSourceRect(videoWidth, videoHeight, viewportWidth, viewportHeight, zoomFactor);

  return {
    height: Math.max(1, Math.round(rect.height)),
    width: Math.max(1, Math.round(rect.width))
  };
}

export function drawDocumentVideoFrame(context, video, options) {
  const {
    mirror = false,
    viewportHeight,
    viewportWidth,
    zoomFactor = 1
  } = options;
  const rect = calculateDocumentSourceRect(video.videoWidth, video.videoHeight, viewportWidth, viewportHeight, zoomFactor);
  const canvas = context.canvas;

  context.save();
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (mirror) {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }

  context.drawImage(
    video,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    canvas.width,
    canvas.height
  );
  context.restore();
}

function calculateDocumentSourceRect(videoWidth, videoHeight, viewportWidth, viewportHeight, zoomFactor = 1) {
  const viewportRatio = viewportWidth / viewportHeight;
  const viewportSourceRect = calculateSourceRect(videoWidth, videoHeight, viewportRatio, zoomFactor);
  const frameWidthByViewport = viewportWidth * DOCUMENT_FRAME.widthRatio;
  const frameHeightByWidth = frameWidthByViewport / DOCUMENT_FRAME.aspectRatio;
  const frameHeight = Math.min(frameHeightByWidth, viewportHeight * DOCUMENT_FRAME.maxHeightRatio);
  const frameWidth = frameHeight * DOCUMENT_FRAME.aspectRatio;
  const frameX = clamp((viewportWidth - frameWidth) / 2, 0, viewportWidth - frameWidth);
  const frameY = clamp((viewportHeight * DOCUMENT_FRAME.topRatio) - (frameHeight / 2), 0, viewportHeight - frameHeight);

  return {
    height: viewportSourceRect.height * (frameHeight / viewportHeight),
    width: viewportSourceRect.width * (frameWidth / viewportWidth),
    x: viewportSourceRect.x + viewportSourceRect.width * (frameX / viewportWidth),
    y: viewportSourceRect.y + viewportSourceRect.height * (frameY / viewportHeight)
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
