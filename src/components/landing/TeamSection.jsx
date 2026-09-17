import SectionHeading from './SectionHeading.jsx';
import { teamMembers } from './landingData.js';

function TeamCard({ name, rm }) {
  return (
    <article className="rounded border border-[#303740] p-[18px]">
      <h3 className="mb-2 text-base font-bold leading-tight text-[#f0f0ec]">{name}</h3>
      <p className="m-0 text-[#bec4c8]">{rm}</p>
      <span className="mt-2.5 inline-block text-sm font-semibold text-[#b2c7d8]">Responsabilidade: desenvolvimento colaborativo da solução</span>
    </article>
  );
}

export default function TeamSection() {
  return (
    <section className="mx-auto w-full max-w-[1120px] px-4 py-[78px] sm:px-6" id="equipe" aria-labelledby="equipe-title">
      <SectionHeading eyebrow="Nossa Equipe" id="equipe-title" title="Pixel Squad - 1ESPV." />
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-5">
        {teamMembers.map((member) => (
          <TeamCard {...member} key={member.rm} />
        ))}
      </div>
    </section>
  );
}
