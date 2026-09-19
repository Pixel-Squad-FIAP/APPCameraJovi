const ASPECT_RATIOS = {
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

export function getAspectRatio(ratio) {
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

export function getFramedCanvasSize(videoWidth, videoHeight, ratio, zoomFactor = 1) {
  const rect = calculateSourceRect(videoWidth, videoHeight, ratio, zoomFactor);

  return {
    height: Math.max(1, Math.round(rect.height)),
    width: Math.max(1, Math.round(rect.width))
  };
}

export function drawFramedVideoFrame(context, video, options) {
  const {
    mirror = false,
    ratio,
    zoomFactor = 1
  } = options;
  const rect = calculateSourceRect(video.videoWidth, video.videoHeight, ratio, zoomFactor);
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
