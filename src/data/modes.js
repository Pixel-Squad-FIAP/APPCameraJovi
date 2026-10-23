// Configuração de cada modo da câmera. Toda regra específica de modo vive aqui,
// para que a interface só precise ler estes dados.

export const MODES = [
  {
    id: 'documento',
    label: 'Documento',
    description: 'Digitaliza folhas e apostilas: recorta pela moldura, deixa o papel branco e extrai o texto.',
    hint: 'Encaixe a folha inteira na moldura',
    guide: { aspect: 1 / 1.414, fill: 0.86, label: 'Folha' },
    processing: 'document',
    extractsText: true,
    // abre a captura logo em seguida para revisar a digitalização
    afterCapture: 'open'
  },
  {
    id: 'estudante',
    label: 'Estudante',
    description: 'Para slides e quadros de aula: fotografe vários seguidos, já no álbum da matéria. O texto é extraído em segundo plano para resumir e anotar depois.',
    hint: 'Enquadre o slide ou o quadro na moldura',
    guide: { aspect: 16 / 9, fill: 0.94, label: 'Slide / quadro' },
    processing: 'none',
    extractsText: true,
    // permanece na câmera para fotografar vários slides seguidos; o OCR roda em segundo plano
    afterCapture: 'stay'
  },
  {
    id: 'foto',
    label: 'Foto',
    description: 'Modo automático padrão. A câmera sugere outro modo quando reconhece a cena.',
    hint: '',
    processing: 'none'
  },
  {
    id: 'retrato',
    label: 'Retrato',
    description: 'Mantém o centro nítido e desfoca as bordas (efeito simulado por software).',
    hint: 'Centralize a pessoa — o fundo será desfocado',
    processing: 'portrait'
  },
  {
    id: 'noite',
    label: 'Noite',
    description: 'Combina vários quadros para reduzir o ruído e clareia a imagem em pouca luz.',
    hint: 'Mantenha o aparelho parado durante a captura',
    processing: 'night'
  },
  {
    id: 'video',
    label: 'Vídeo',
    description: 'Grava vídeo com áudio (se o microfone for permitido).',
    hint: 'Toque no botão vermelho para gravar',
    processing: 'video',
    isVideo: true
  }
];

export const DEFAULT_MODE = 'foto';
export const TIMER_OPTIONS = [0, 3, 10];
export const RATIO_OPTIONS = ['3:4', '9:16', '1:1'];
export const DEFAULT_ALBUM = 'Geral';
export const DEFAULT_ALBUMS = [DEFAULT_ALBUM, 'Aulas', 'Trabalhos', 'Provas'];

export function getMode(id) {
  return MODES.find((mode) => mode.id === id) ?? MODES.find((mode) => mode.id === DEFAULT_MODE);
}
