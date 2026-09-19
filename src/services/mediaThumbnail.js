export function createVideoThumbnailBlob(videoBlob) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(videoBlob);
    let shouldDrawOnLoadedData = true;
    let settled = false;

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('seeked', drawFrame);
      video.removeEventListener('error', handleError);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };

    const drawFrame = () => {
      if (!video.videoWidth || !video.videoHeight) {
        finish(reject, new Error('Não foi possível gerar miniatura do vídeo.'));
        return;
      }

      const maxWidth = 240;
      const scale = Math.min(1, maxWidth / video.videoWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

      const context = canvas.getContext('2d');
      if (!context) {
        finish(reject, new Error('Não foi possível preparar a miniatura do vídeo.'));
        return;
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) {
          finish(reject, new Error('Não foi possível salvar a miniatura do vídeo.'));
          return;
        }

        finish(resolve, blob);
      }, 'image/jpeg', 0.72);
    };

    const handleLoadedMetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0.2) {
        shouldDrawOnLoadedData = false;
        try {
          video.currentTime = 0.1;
        } catch {
          shouldDrawOnLoadedData = true;
        }
        return;
      }

      shouldDrawOnLoadedData = true;
    };

    const handleLoadedData = () => {
      if (shouldDrawOnLoadedData) {
        drawFrame();
      }
    };

    const handleError = () => {
      finish(reject, new Error('Não foi possível carregar o vídeo para miniatura.'));
    };

    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
    video.addEventListener('loadeddata', handleLoadedData, { once: true });
    video.addEventListener('seeked', drawFrame, { once: true });
    video.addEventListener('error', handleError, { once: true });
    video.src = objectUrl;
    video.load();
  });
}
