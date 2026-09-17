import { Link } from 'react-router-dom';
import { navItems } from './landingData.js';

export default function LandingHeader({ isMenuOpen, onCloseMenu, onToggleMenu }) {
  return (
    <header className="sticky top-0 z-20 border-b border-[#232a32] bg-[#0b0d10]/95">
      <nav className="mx-auto flex min-h-[68px] w-full max-w-[1120px] items-center justify-between gap-5 px-4 sm:px-6" aria-label="Navegação principal">
        <a className="inline-flex items-center gap-2.5 text-sm font-bold text-[#f0f0ec] no-underline" href="#topo" aria-label="JOVI Camera - início" onClick={onCloseMenu}>
          <span className="h-[13px] w-[13px] rotate-45 rounded-[2px] border-2 border-[#85afd5]" aria-hidden="true" />
          <span>JOVI Camera</span>
        </a>

        <button
          className="grid h-11 w-11 place-items-center gap-1 rounded border border-[#303740] bg-transparent lg:hidden"
          type="button"
          aria-expanded={isMenuOpen}
          aria-controls="primary-menu"
          onClick={onToggleMenu}
        >
          <span className="sr-only">Abrir menu</span>
          <span className="h-0.5 w-[18px] rounded bg-[#f0f0ec]" aria-hidden="true" />
          <span className="h-0.5 w-[18px] rounded bg-[#f0f0ec]" aria-hidden="true" />
          <span className="h-0.5 w-[18px] rounded bg-[#f0f0ec]" aria-hidden="true" />
        </button>

        <ul
          className={`${isMenuOpen ? 'grid' : 'hidden'} fixed inset-x-0 top-[68px] z-20 m-0 list-none gap-2 border-b border-[#303740] bg-[#0d0f12] px-6 pb-6 pt-[18px] lg:static lg:flex lg:items-center lg:gap-[22px] lg:border-0 lg:bg-transparent lg:p-0`}
          id="primary-menu"
        >
          {navItems.map((item) => (
            <li key={item.href}>
              <a className="block py-3 text-sm font-bold text-[#bec4c8] no-underline hover:text-[#f0f0ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#85afd5] lg:py-2" href={item.href} onClick={onCloseMenu}>
                {item.label}
              </a>
            </li>
          ))}
          <li>
            <Link className="mt-2 inline-flex min-h-10 items-center rounded bg-[#d9d5ca] px-4 text-sm font-bold text-[#14171b] no-underline hover:bg-[#c8c3b7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#85afd5] lg:mt-0" to="/camera" onClick={onCloseMenu}>
              Abrir câmera
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
