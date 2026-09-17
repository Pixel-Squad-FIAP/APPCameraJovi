import SectionHeading from './SectionHeading.jsx';

export default function SolutionSection() {
  return (
    <section className="border-y border-[#151a20] bg-[#101317]/85 py-[78px]" id="solucao" aria-labelledby="solucao-title">
      <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-6">
        <SectionHeading eyebrow="A Solução" id="solucao-title" title="Uma câmera contextual para apoiar a rotina acadêmica." />

        <div className="grid gap-3.5 sm:grid-cols-2">
          <article className="rounded border border-[#303740] p-[18px]">
            <h3 className="mb-2 text-base font-bold leading-tight text-[#f0f0ec]">Problema</h3>
            <p className="m-0 text-[#bec4c8]">Estudantes registram slides, quadros, apostilas e documentos, mas essas imagens frequentemente exigem trabalho posterior para localizar, interpretar, transcrever e organizar.</p>
          </article>

          <article className="rounded border border-[#49657f] bg-[rgba(110,163,223,0.06)] p-[18px]">
            <h3 className="mb-2 text-base font-bold leading-tight text-[#f0f0ec]">Solução</h3>
            <p className="m-0 text-[#bec4c8]">A JOVI Camera propõe uma experiência de câmera que conecta captura a recursos de produtividade acadêmica, com destaque para o Modo Estudante.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
