import SectionHeading from './SectionHeading.jsx';
import { workflowSteps } from './landingData.js';

function StepCard({ description, number, title }) {
  return (
    <article className="rounded border border-[#303740] p-[18px]">
      <span className="mb-[22px] grid h-[34px] w-[34px] place-items-center rounded-full border border-[#303740] font-bold text-[#b2c7d8]">{number}</span>
      <h3 className="mb-2 text-base font-bold leading-tight text-[#f0f0ec]">{title}</h3>
      <p className="m-0 text-[#bec4c8]">{description}</p>
    </article>
  );
}

export default function WorkflowSection() {
  return (
    <section className="mx-auto w-full max-w-[1120px] px-4 py-[78px] sm:px-6" aria-labelledby="workflow-title">
      <SectionHeading eyebrow="Como Funciona" id="workflow-title" title="Da captura ao material organizado." />
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {workflowSteps.map((step) => (
          <StepCard {...step} key={step.number} />
        ))}
      </div>
    </section>
  );
}
