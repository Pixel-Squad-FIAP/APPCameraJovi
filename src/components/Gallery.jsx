import { useEffect, useState } from 'react';
import { useCapturesApi } from '../hooks/useCapturesApi.js';

const galleryImages = [
  { src: 'assets/photo1.png', alt: 'Foto 1 da galeria' },
  { src: 'assets/photo2.png', alt: 'Foto 2 da galeria' },
  { src: 'assets/photo3.png', alt: 'Foto 3 da galeria' },
  { src: 'assets/photo4.png', alt: 'Foto 4 da galeria' },
  { src: 'assets/photo5.png', alt: 'Foto 5 da galeria' }
];

function useCaptureObjectUrls(userCaptures) {
  const [captureItems, setCaptureItems] = useState([]);

  useEffect(() => {
    const nextItems = userCaptures.map((capture) => {
      const mediaKind = capture.mimeType?.startsWith('video/') ? 'video' : 'image';

      return {
        ...capture,
        mediaKind,
        url: URL.createObjectURL(capture.blob)
      };
    });

    setCaptureItems(nextItems);

    return () => {
      nextItems.forEach((capture) => URL.revokeObjectURL(capture.url));
    };
  }, [userCaptures]);

  return captureItems;
}

export default function Gallery({ isOpen, onClose, userCaptures = [] }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const { captures, error, loading, retry } = useCapturesApi(isOpen);
  const captureItems = useCaptureObjectUrls(userCaptures);
  const mainSlides = [
    ...captureItems.map((capture) => ({
      alt: capture.mediaKind === 'video'
        ? 'Vídeo real gravado pela câmera'
        : 'Foto real capturada pela câmera',
      id: capture.id,
      mediaKind: capture.mediaKind,
      mimeType: capture.mimeType,
      src: capture.url,
      type: 'user'
    })),
    ...galleryImages.map((image) => ({
      ...image,
      id: image.src,
      mediaKind: 'image',
      type: 'demo'
    }))
  ];
  const selectedSlide = mainSlides[slideIndex] || mainSlides[0];

  useEffect(() => {
    if (slideIndex > mainSlides.length - 1) {
      setSlideIndex(Math.max(0, mainSlides.length - 1));
    }
  }, [mainSlides.length, slideIndex]);

  const showPreviousSlide = () => {
    setSlideIndex((current) => (current === 0 ? mainSlides.length - 1 : current - 1));
  };

  const showNextSlide = () => {
    setSlideIndex((current) => (current === mainSlides.length - 1 ? 0 : current + 1));
  };

  return (
    <div id="gallery-overlay" className={`gallery-overlay ${isOpen ? 'show' : ''}`} aria-hidden={!isOpen}>
      <div className="gallery-header">
        <button className="gallery-close" id="gallery-close" onClick={onClose} aria-label="Fechar galeria">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <span>Galeria</span>
      </div>

      <div className="slideshow-container">
        {selectedSlide && (
          <div className="slide fade" style={{ display: 'block' }}>
            {selectedSlide.mediaKind === 'video' ? (
              <video
                controls
                playsInline
                preload="metadata"
                src={selectedSlide.src}
              >
                Seu navegador não consegue reproduzir este vídeo.
              </video>
            ) : (
              <img src={selectedSlide.src} alt={selectedSlide.alt} style={{ width: '100%' }} />
            )}
          </div>
        )}

        <a className="prev" id="prev-slide" onClick={showPreviousSlide} role="button" tabIndex="0" aria-label="Slide anterior">
          &#10094;
        </a>
        <a className="next" id="next-slide" onClick={showNextSlide} role="button" tabIndex="0" aria-label="Próximo slide">
          &#10095;
        </a>
      </div>

      <div className="slideshow-dots" id="slideshow-dots">
        {mainSlides.map((image, index) => (
          <span
            className={`dot ${index === slideIndex ? 'active' : ''}`}
            key={image.id}
            onClick={() => setSlideIndex(index)}
            role="button"
            tabIndex="0"
            aria-label={`Mostrar slide ${index + 1}`}
          />
        ))}
      </div>

      <section className="user-captures" aria-labelledby="user-captures-title">
        <div className="study-captures-header">
          <span id="user-captures-title">Suas capturas</span>
        </div>

        {captureItems.length === 0 ? (
          <p className="study-captures-status">Nenhuma captura feita ainda.</p>
        ) : (
          <div className="user-captures-list">
            {captureItems.map((capture) => (
              <article
                className="user-capture-card"
                key={capture.id}
                onClick={() => {
                  const selectedIndex = mainSlides.findIndex((slide) => slide.id === capture.id);
                  if (selectedIndex >= 0) {
                    setSlideIndex(selectedIndex);
                  }
                }}
              >
                <div className="user-capture-preview">
                  {capture.mediaKind === 'video' ? (
                    <>
                      <video muted playsInline preload="metadata" src={capture.url} />
                      <span className="user-capture-badge">Vídeo</span>
                    </>
                  ) : (
                    <img src={capture.url} alt="Foto real capturada pela câmera" />
                  )}
                </div>
                <time dateTime={capture.createdAt}>
                  {new Intl.DateTimeFormat('pt-BR', {
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    month: '2-digit'
                  }).format(new Date(capture.createdAt))}
                </time>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="study-captures" aria-labelledby="study-captures-title">
        <div className="study-captures-header">
          <span id="study-captures-title">Capturas de estudo</span>
          {error && (
            <button className="study-captures-retry" type="button" onClick={retry}>
              Tentar novamente
            </button>
          )}
        </div>

        {loading && <p className="study-captures-status">Carregando capturas...</p>}
        {error && !loading && <p className="study-captures-status error">{error}</p>}
        {!loading && !error && captures.length > 0 && (
          <div className="study-captures-list">
            {captures.map((capture) => (
              <article className="study-capture-card" key={capture.id}>
                <div className="study-capture-meta">
                  <span>{capture.type}</span>
                  <time dateTime={capture.capturedAt}>
                    {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(capture.capturedAt))}
                  </time>
                </div>
                <h3>{capture.title}</h3>
                <p>{capture.summary}</p>
                <div className="study-capture-tags">
                  {capture.tags.slice(0, 2).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
