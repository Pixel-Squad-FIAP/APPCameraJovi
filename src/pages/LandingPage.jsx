import { useEffect, useState } from 'react';
import AudienceSection from '../components/landing/AudienceSection.jsx';
import ContactSection from '../components/landing/ContactSection.jsx';
import FeaturesSection from '../components/landing/FeaturesSection.jsx';
import LandingFooter from '../components/landing/LandingFooter.jsx';
import LandingGallery from '../components/landing/LandingGallery.jsx';
import LandingHeader from '../components/landing/LandingHeader.jsx';
import LandingHero from '../components/landing/LandingHero.jsx';
import SolutionSection from '../components/landing/SolutionSection.jsx';
import TeamSection from '../components/landing/TeamSection.jsx';
import WorkflowSection from '../components/landing/WorkflowSection.jsx';

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeMenu();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0d0f12] bg-[linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[length:48px_48px] text-[#f0f0ec] [scroll-behavior:smooth]">
      <LandingHeader
        isMenuOpen={isMenuOpen}
        onCloseMenu={closeMenu}
        onToggleMenu={() => setIsMenuOpen((current) => !current)}
      />
      <main id="topo">
        <LandingHero />
        <SolutionSection />
        <WorkflowSection />
        <FeaturesSection />
        <AudienceSection />
        <LandingGallery />
        <TeamSection />
        <ContactSection />
      </main>
      <LandingFooter />
    </div>
  );
}
