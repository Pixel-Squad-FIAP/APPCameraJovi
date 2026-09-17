export default function LandingFooter() {
  return (
    <footer className="mx-auto grid w-full max-w-[1120px] gap-3.5 border-t border-[#303740] px-4 py-8 text-[#bec4c8] sm:px-6">
      <p className="m-0">Pixel Squad • JOVI Challenge 2026</p>
      <nav className="flex flex-wrap gap-x-[18px] gap-y-3" aria-label="Navegação secundária">
        <a className="text-[#bec4c8] no-underline hover:text-[#f0f0ec]" href="#solucao">Solução</a>
        <a className="text-[#bec4c8] no-underline hover:text-[#f0f0ec]" href="#galeria">Galeria</a>
        <a className="text-[#bec4c8] no-underline hover:text-[#f0f0ec]" href="#contato">Contato</a>
      </nav>
    </footer>
  );
}
