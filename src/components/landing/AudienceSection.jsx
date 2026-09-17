import { audiencePains } from './landingData.js';

function PainCard({ description, title }) {
  return (
    <article className="rounded border border-[#303740] p-[18px]">
      <h3 className="mb-2 text-base font-bold leading-tight text-[#f0f0ec]">{title}</h3>
      <p className="m-0 text-[#bec4c8]">{description}</p>
    </article>
  );
}

export default function AudienceSection() {
  return (
    <section className="mx-auto grid w-full max-w-[1120px] gap-7 px-4 py-[78px] sm:px-6 lg:grid-cols-[0.88fr_1.12fr] lg:items-start" id="publico" aria-labelledby="publico-title">
      <div className="max-w-[540px]">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.05em] text-[#b2c7d8]">Público-Alvo</p>
        <h2 id="publico-title" className="max-w-[740px] text-[clamp(1.55rem,4.6vw,2.45rem)] font-bold leading-[1.12] text-[#f0f0ec]">Estudantes universitários full-time.</h2>
        <p className="mt-4 text-[#bec4c8]">A proposta atende uma rotina com muitas capturas acadêmicas, pouco tempo para organizar materiais e necessidade de acessar informações rapidamente.</p>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2" aria-label="Principais dores do público-alvo">
        {audiencePains.map((pain) => (
          <PainCard {...pain} key={pain.title} />
        ))}
      </div>
    </section>
  );
}
