import { Link } from 'react-router-dom';
import { heroFacts, prototypeStudentMode } from './landingData.js';

export default function LandingHero() {
  return (
    <section className="mx-auto grid min-h-[calc(100svh-68px)] w-full max-w-[1120px] items-center gap-8 px-4 py-11 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16 lg:py-10" aria-labelledby="hero-title">
      <div className="max-w-[680px]">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.05em] text-[#b2c7d8]">JOVI Camera • Modo Estudante</p>
        <h1 id="hero-title" className="max-w-[720px] text-[clamp(2.05rem,7.7vw,4.1rem)] font-extrabold leading-[1.03] text-[#f0f0ec]">
          Sua câmera pode fazer mais do que registrar a aula.
        </h1>
        <p className="mt-5 max-w-[620px] text-[clamp(1rem,3.1vw,1.18rem)] text-[#bec4c8]">
          Transforme capturas de slides, quadros e documentos em conteúdo útil para estudar.
        </p>
        <p className="mt-[18px] max-w-[560px] border-l-2 border-t border-l-[#85afd5] border-t-[#303740] px-0 pb-0 pl-[18px] pt-3.5 text-[0.96rem] text-[#d9d5ca]">
          Não é só fotografar. É transformar o que você captura em algo útil para estudar.
        </p>

        <dl className="my-7 grid max-w-[580px] grid-cols-1 border-y border-[#303740] sm:grid-cols-3" aria-label="Resumo do protótipo">
          {heroFacts.map((fact, index) => (
            <div className={`grid grid-cols-[112px_minmax(0,1fr)] gap-3.5 border-b border-[#232a32] py-2.5 sm:grid-cols-1 sm:border-b-0 sm:border-r sm:px-3.5 sm:py-3 ${index === 0 ? 'sm:pl-0' : ''} ${index === heroFacts.length - 1 ? 'border-b-0 sm:border-r-0 sm:pr-0' : ''}`} key={fact.label}>
              <dt className="text-xs font-bold uppercase tracking-[0.05em] text-[#899198]">{fact.label}</dt>
              <dd className="m-0 text-sm text-[#f0f0ec]">{fact.value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link className="inline-flex min-h-12 items-center justify-center rounded bg-[#d9d5ca] px-5 font-bold text-[#14171b] no-underline hover:bg-[#c8c3b7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#85afd5]" to="/camera">
            Abrir câmera
          </Link>
          <a className="inline-flex min-h-12 items-center justify-center rounded border border-[#303740] px-5 font-bold text-[#f0f0ec] no-underline hover:border-[#85afd5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#85afd5]" href="#solucao">
            Conheça o Modo Estudante
          </a>
        </div>
      </div>

      <figure className="mx-0 justify-self-center rounded-md border border-[#303740] bg-[#0a0b0e] p-2.5 [width:min(300px,76vw)] lg:w-[340px]">
        <img className="block h-auto w-full rounded-xl border border-[#303740]" src={prototypeStudentMode} alt="Tela real do protótipo JOVI Camera exibindo o Modo Estudante com ações de resumir, anotar e exportar." />
        <figcaption className="mt-3 text-center text-sm text-[#899198]">Screenshot real do protótipo da Sprint 2.</figcaption>
      </figure>
    </section>
  );
}
