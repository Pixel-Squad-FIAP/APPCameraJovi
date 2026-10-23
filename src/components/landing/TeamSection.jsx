import SectionHeading from './SectionHeading.jsx';
import { teamMembers } from './landingData.js';

function TeamCard({ description, name, rm, role }) {
  return (
    <article className="grid content-start gap-2 rounded border border-[#303740] p-[18px]">
      <p className="m-0 text-xs font-bold uppercase tracking-[0.05em] text-[#85afd5]">{role}</p>
      <h3 className="m-0 text-base font-bold leading-tight text-[#f0f0ec]">{name}</h3>
      <p className="m-0 text-sm text-[#899198]">{rm}</p>
      <p className="m-0 text-sm text-[#bec4c8]">{description}</p>
    </article>
  );
}

export default function TeamSection() {
  return (
    <section className="mx-auto w-full max-w-[1120px] px-4 py-[78px] sm:px-6" id="equipe" aria-labelledby="equipe-title">
      <SectionHeading eyebrow="Nossa Equipe" id="equipe-title" title="Pixel Squad - 1ESPV." />
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {teamMembers.map((member) => (
          <TeamCard {...member} key={member.rm} />
        ))}
      </div>
    </section>
  );
}
