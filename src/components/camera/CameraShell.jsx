// Mobile: câmera em tela cheia. Tablet/desktop: moldura de smartphone centralizada,
// com um painel lateral de atalhos em telas largas.
export default function CameraShell({ aside, children }) {
  return (
    <main
      aria-label="Câmera JOVI"
      className="min-h-dvh bg-black md:flex md:items-center md:justify-center md:gap-12 md:bg-[radial-gradient(ellipse_at_60%_20%,#1a1a2e_0%,#0a0a0f_60%)] md:p-6"
    >
      {aside && <aside className="hidden w-64 shrink-0 lg:block">{aside}</aside>}
      <div className="relative mx-auto flex h-dvh w-full flex-col overflow-hidden bg-black text-white md:mx-0 md:aspect-[9/19] md:h-[min(860px,calc(100dvh-48px))] md:w-auto md:rounded-[44px] md:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_30px_80px_rgba(0,0,0,0.8)]">
        {children}
      </div>
    </main>
  );
}
