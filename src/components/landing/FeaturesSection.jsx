import SectionHeading from './SectionHeading.jsx';
import { features } from './landingData.js';

function FeatureCard({ category, description, title }) {
  return (
    <article className="grid content-start gap-1.5 rounded border border-[#303740] p-[18px]">
      <span className="text-[0.68rem] font-bold uppercase tracking-[0.06em] text-[#899198]">{category}</span>
      <h3 className="m-0 text-base font-bold leading-tight text-[#f0f0ec]">{title}</h3>
      <p className="m-0 text-[#bec4c8]">{description}</p>
    </article>
  );
}

export default function FeaturesSection() {
  return (
    <section className="border-y border-[#151a20] bg-[#101317]/85 py-[78px]" aria-labelledby="features-title">
      <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-6">
        <SectionHeading eyebrow="Funcionalidades" id="features-title" title="Recursos sustentados pelo protótipo e backlog." />
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard {...feature} key={feature.title} />
          ))}
        </div>
      </div>
    </section>
  );
}
