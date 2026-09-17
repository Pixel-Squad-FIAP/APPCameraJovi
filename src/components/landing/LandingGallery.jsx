import SectionHeading from './SectionHeading.jsx';
import { galleryImages } from './landingData.js';

function GalleryFigure({ alt, caption, src }) {
  return (
    <figure className="m-0 rounded border border-[#232a32] bg-[#0b0d10] p-2.5 pb-3">
      <img className="block aspect-[9/16] w-full rounded-sm bg-[#05060a] object-cover" src={src} alt={alt} />
      <figcaption className="mt-3 text-center text-sm text-[#899198]">{caption}</figcaption>
    </figure>
  );
}

export default function LandingGallery() {
  return (
    <section className="border-y border-[#151a20] bg-[#101317]/85 py-[78px]" id="galeria" aria-labelledby="galeria-title">
      <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-6">
        <SectionHeading
          eyebrow="Galeria"
          id="galeria-title"
          title="Telas reais capturadas do protótipo."
          intro="A seção abaixo funciona como uma folha de contato: cada tela vem do protótipo HTML/CSS da câmera, capturada no navegador."
        />
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {galleryImages.map((image) => (
            <GalleryFigure {...image} key={image.caption} />
          ))}
        </div>
      </div>
    </section>
  );
}
