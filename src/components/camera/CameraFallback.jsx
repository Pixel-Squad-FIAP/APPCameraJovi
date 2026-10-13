import Button from '../ui/Button.jsx';
import { Spinner } from '../ui/Feedback.jsx';
import Icon from '../ui/Icon.jsx';

const CONTENT = {
  denied: {
    icon: 'lock',
    title: 'Permita o acesso à câmera',
    description: 'O navegador bloqueou a câmera. Toque no ícone de cadeado ao lado do endereço, libere a câmera e tente novamente.'
  },
  unavailable: {
    icon: 'camera',
    title: 'Nenhuma câmera encontrada',
    description: 'Este aparelho não tem uma câmera disponível. Você ainda pode importar uma foto para usar o OCR e o Modo Estudante.'
  },
  busy: {
    icon: 'alert',
    title: 'Câmera em uso',
    description: 'Outro aplicativo ou aba está usando a câmera. Feche-o e tente novamente.'
  },
  insecure: {
    icon: 'lock',
    title: 'Conexão não segura',
    description: 'O navegador só libera a câmera em HTTPS ou em localhost. Abra pelo link da Vercel ou importe uma imagem.'
  },
  error: {
    icon: 'alert',
    title: 'Não foi possível abrir a câmera',
    description: 'Algo deu errado ao iniciar a câmera. Tente novamente ou importe uma imagem.'
  }
};

export default function CameraFallback({ onImport, onRetry, status }) {
  if (status === 'ready') return null;

  if (status === 'idle' || status === 'starting') {
    return (
      <div className="absolute inset-0 grid place-items-center text-sm text-white/70">
        <span className="flex items-center gap-3"><Spinner /> Abrindo câmera…</span>
      </div>
    );
  }

  const content = CONTENT[status] ?? CONTENT.error;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center" role="alert">
      <span className="grid size-14 place-items-center rounded-2xl bg-white/8 text-white/80">
        <Icon name={content.icon} size={26} />
      </span>
      <div>
        <h2 className="text-lg font-bold">{content.title}</h2>
        <p className="mt-1.5 text-sm text-white/65">{content.description}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {status !== 'unavailable' && status !== 'insecure' && (
          <Button icon="refresh" onClick={onRetry} variant="light">Tentar novamente</Button>
        )}
        <Button icon="upload" onClick={onImport} variant="secondary">Importar imagem</Button>
      </div>
    </div>
  );
}
