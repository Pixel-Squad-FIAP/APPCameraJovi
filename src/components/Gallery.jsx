import { useState } from 'react';
import { useCapturesApi } from '../hooks/useCapturesApi.js';

const galleryImages = [
  { src: 'assets/photo1.png', alt: 'Foto 1 da galeria' },
  { src: 'assets/photo2.png', alt: 'Foto 2 da galeria' },
  { src: 'assets/photo3.png', alt: 'Foto 3 da galeria' },
  { src: 'assets/photo4.png', alt: 'Foto 4 da galeria' },
  { src: 'assets/photo5.png', alt: 'Foto 5 da galeria' }
];

export default function Gallery({ isOpen, onClose }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const { captures, error, loading, retry } = useCapturesApi(isOpen);

  const showPreviousSlide = () => {
    setSlideIndex((current) => (current === 0 ? galleryImages.length - 1 : current - 1));
  };

  const showNextSlide = () => {
    setSlideIndex((current) => (current === galleryImages.length - 1 ? 0 : current + 1));
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
        {galleryImages.map((image, index) => (
          <div className="slide fade" key={image.src} style={{ display: index === slideIndex ? 'block' : 'none' }}>
            <img src={image.src} alt={image.alt} style={{ width: '100%' }} />
          </div>
        ))}

        <a className="prev" id="prev-slide" onClick={showPreviousSlide} role="button" tabIndex="0" aria-label="Slide anterior">
          &#10094;
        </a>
        <a className="next" id="next-slide" onClick={showNextSlide} role="button" tabIndex="0" aria-label="Próximo slide">
          &#10095;
        </a>
      </div>

      <div className="slideshow-dots" id="slideshow-dots">
        {galleryImages.map((image, index) => (
          <span
            className={`dot ${index === slideIndex ? 'active' : ''}`}
            key={image.src}
            onClick={() => setSlideIndex(index)}
            role="button"
            tabIndex="0"
            aria-label={`Mostrar slide ${index + 1}`}
          />
        ))}
      </div>

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
