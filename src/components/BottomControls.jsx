import { useEffect, useState } from 'react';
import ModeCarousel from './ModeCarousel.jsx';
import { createVideoThumbnailBlob } from '../services/mediaThumbnail.js';

function useLatestCaptureThumbnail(latestCapture) {
  const [thumbnail, setThumbnail] = useState({ isVideo: false, url: '' });

  useEffect(() => {
    let active = true;
    let objectUrl = '';

    const clearThumbnail = () => {
      if (active) {
        setThumbnail({ isVideo: false, url: '' });
      }
    };

    if (!latestCapture?.blob) {
      clearThumbnail();
      return () => {
        active = false;
      };
    }

    const isVideo = latestCapture.mimeType?.startsWith('video/');
    const isDocument = latestCapture.kind === 'document';
    const sourceBlob = isVideo
      ? latestCapture.thumbnailBlob
      : isDocument && latestCapture.processedBlob
        ? latestCapture.processedBlob
        : latestCapture.blob;

    if (sourceBlob) {
      objectUrl = URL.createObjectURL(sourceBlob);
      setThumbnail({ isVideo, url: objectUrl });
    } else if (isVideo) {
      createVideoThumbnailBlob(latestCapture.blob)
        .then((thumbnailBlob) => {
          if (!active) return;
          objectUrl = URL.createObjectURL(thumbnailBlob);
          setThumbnail({ isVideo: true, url: objectUrl });
        })
        .catch(clearThumbnail);
    } else {
      clearThumbnail();
    }

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [latestCapture]);

  return thumbnail;
}

export default function BottomControls({ activeMode, flipDisabled = false, flipped, isRecording, latestCapture, onFlip, onGalleryOpen, onModeChange, onShutter }) {
  const latestThumbnail = useLatestCaptureThumbnail(latestCapture);

  return (
    <div className="bottom-controls">
      <div className="controls-row">
        <button className={`btn-gallery ${latestThumbnail.url ? 'has-thumbnail' : ''}`} aria-label="Galeria" onClick={onGalleryOpen} type="button">
          {latestThumbnail.url && (
            <>
              <img src={latestThumbnail.url} alt="" aria-hidden="true" />
              {latestThumbnail.isVideo && <span className="gallery-video-indicator" aria-hidden="true" />}
            </>
          )}
        </button>

        <div className="shutter-wrapper">
          <div className="shutter-ring" style={{ borderColor: isRecording ? 'rgba(255,59,48,0.3)' : '' }} />
          <button
            className="shutter-btn"
            id="shutter-btn"
            aria-label="Tirar foto"
            onClick={onShutter}
            style={{
              backgroundColor: activeMode === 'Vídeo' ? '#ff3b30' : '',
              borderRadius: isRecording ? '14px' : '',
              transform: isRecording ? 'scale(0.72)' : ''
            }}
          />
        </div>

        <button
          className={`btn-flip ${flipped ? 'rotated' : ''}`}
          aria-label="Virar câmera"
          disabled={flipDisabled}
          onClick={onFlip}
        >
          <svg width="22" height="18" viewBox="0 0 22 18">
            <path d="M2 9 C2 4.6 5.6 1 10 1 L18 1" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="15,1 18,1 18,4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20 9 C20 13.4 16.4 17 12 17 L4 17" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="7,17 4,17 4,14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <ModeCarousel activeMode={activeMode} onModeChange={onModeChange} />
    </div>
  );
}
