import { useState } from 'react';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';

const STEPS = [
  {
    icon: 'sparkles',
    title: 'Uma câmera que entende a cena',
    text: 'Com pouca luz ou um documento na frente, a câmera sugere o modo certo. Você decide se aceita — nada muda sozinho.'
  },
  {
    icon: 'text',
    title: 'Da foto da aula ao texto editável',
    text: 'Nos modos Documento e Estudante o texto da imagem é extraído (OCR) e você pode gerar um resumo, anotar e exportar.'
  },
  {
    icon: 'folder',
    title: 'Tudo organizado por matéria',
    text: 'Suas capturas ficam na Galeria, separadas em álbuns e com busca pelo texto. Tudo salvo só neste aparelho.'
  }
];

export default function Onboarding({ onFinish, open }) {
  const [step, setStep] = useState(0);
  if (!open) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div aria-labelledby="onboarding-title" aria-modal="true" className="absolute inset-0 z-50 flex animate-fade-in flex-col justify-end bg-black/75 p-4 backdrop-blur-sm" role="dialog">
      <div className="animate-sheet-in rounded-3xl border border-white/10 bg-ink-850 p-6" key={step}>
        <span className="grid size-12 place-items-center rounded-2xl bg-jovi-500/20 text-jovi-300">
          <Icon name={current.icon} size={24} />
        </span>
        <h2 className="mt-4 text-xl font-bold" id="onboarding-title">{current.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">{current.text}</p>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div aria-label={`Passo ${step + 1} de ${STEPS.length}`} className="flex gap-1.5" role="img">
            {STEPS.map((item, index) => (
              <span className={`h-1.5 rounded-full transition-all ${index === step ? 'w-6 bg-white' : 'w-1.5 bg-white/30'}`} key={item.title} />
            ))}
          </div>
          <div className="flex gap-2">
            {!isLast && <Button onClick={onFinish} size="sm" variant="ghost">Pular</Button>}
            <Button
              onClick={() => (isLast ? onFinish() : setStep((value) => value + 1))}
              size="sm"
              variant={isLast ? 'primary' : 'light'}
            >
              {isLast ? 'Abrir câmera' : 'Próximo'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
