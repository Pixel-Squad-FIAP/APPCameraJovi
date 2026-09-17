import prototypeCamera from '../../assets/landing/prototype-camera.png';
import prototypeDocumentExport from '../../assets/landing/prototype-document-export.png';
import prototypeDocumentMode from '../../assets/landing/prototype-document-mode.png';
import prototypeExport from '../../assets/landing/prototype-export.png';
import prototypeNotes from '../../assets/landing/prototype-notes.png';
import prototypeStudentMode from '../../assets/landing/prototype-student-mode.png';
import prototypeSummary from '../../assets/landing/prototype-summary.png';

export const navItems = [
  { href: '#solucao', label: 'A Solução' },
  { href: '#publico', label: 'Público-Alvo' },
  { href: '#galeria', label: 'Galeria' },
  { href: '#equipe', label: 'Nossa Equipe' },
  { href: '#contato', label: 'Contato' }
];

export const heroFacts = [
  { label: 'Entrega', value: 'Landing Page Sprint 3' },
  { label: 'Base visual', value: 'Protótipo Sprint 2' },
  { label: 'Status', value: 'Proposta acadêmica' }
];

export const workflowSteps = [
  {
    number: '1',
    title: 'Capture',
    description: 'Fotografe slides, quadros ou documentos durante a aula ou rotina de estudos.'
  },
  {
    number: '2',
    title: 'Transforme',
    description: 'Acesse recursos propostos para digitalização, extração de conteúdo, resumo e anotação.'
  },
  {
    number: '3',
    title: 'Organize',
    description: 'Mantenha o conteúdo mais fácil de utilizar, organizar ou exportar.'
  }
];

export const features = [
  {
    category: 'Contexto',
    title: 'Reconhecimento de contexto',
    description: 'Identificação proposta de cenários como documento, pessoa ou baixa iluminação.'
  },
  {
    category: 'Captura',
    title: 'Assistência de captura',
    description: 'Sugestões visuais para luz, enquadramento e uso do modo adequado.'
  },
  {
    category: 'Captura',
    title: 'Captura simplificada',
    description: 'Fluxo pensado para registrar imagens com menos ajustes manuais.'
  },
  {
    category: 'Documento',
    title: 'Digitalização de documentos',
    description: 'Modo documento com enquadramento para materiais impressos ou folhas.'
  },
  {
    category: 'Texto',
    title: 'Extração de texto/OCR',
    description: 'Proposta de transformar imagens com texto em conteúdo editável.'
  },
  {
    category: 'Estudo',
    title: 'Resumo acadêmico',
    description: 'Interface de resumo apresentada como parte do Modo Estudante.'
  },
  {
    category: 'Estudo',
    title: 'Anotações',
    description: 'Área para complementar o texto reconhecido com observações do estudante.'
  },
  {
    category: 'Arquivo',
    title: 'Organização de conteúdo',
    description: 'Separação e uso mais prático dos registros acadêmicos capturados.'
  },
  {
    category: 'Arquivo',
    title: 'Exportação',
    description: 'Fluxo visual proposto para formatos como PDF, DOCX e TXT, sem integração real nesta entrega.'
  }
];

export const audiencePains = [
  {
    title: 'Muitas capturas',
    description: 'Slides, quadros e documentos ficam espalhados na galeria.'
  },
  {
    title: 'Trabalho manual',
    description: 'O estudante precisa transcrever, resumir e renomear conteúdos.'
  },
  {
    title: 'Busca lenta',
    description: 'Encontrar uma foto específica depois da aula pode consumir tempo.'
  },
  {
    title: 'Rotina intensa',
    description: 'A solução prioriza ações simples para apoiar a produtividade acadêmica.'
  }
];

export const galleryImages = [
  {
    src: prototypeCamera,
    alt: 'Tela inicial do protótipo JOVI Camera em modo Foto.',
    caption: 'Câmera principal'
  },
  {
    src: prototypeStudentMode,
    alt: 'Tela do protótipo no Modo Estudante com botões Resumir, Anotar e Exportar.',
    caption: 'Modo Estudante'
  },
  {
    src: prototypeSummary,
    alt: 'Tela do protótipo exibindo resumo gerado dentro do Modo Estudante.',
    caption: 'Resumo acadêmico'
  },
  {
    src: prototypeNotes,
    alt: 'Tela do protótipo com texto reconhecido e campo de anotação.',
    caption: 'Anotação'
  },
  {
    src: prototypeExport,
    alt: 'Tela do protótipo com texto extraído e opções de exportação em PDF, DOCX ou TXT.',
    caption: 'Exportação de texto'
  },
  {
    src: prototypeDocumentMode,
    alt: 'Tela do protótipo em Modo Documento com moldura de digitalização.',
    caption: 'Modo Documento'
  },
  {
    src: prototypeDocumentExport,
    alt: 'Tela do protótipo com opções de exportação de documento.',
    caption: 'Exportação de documento'
  }
];

export const teamMembers = [
  { name: 'Pedro Henrique Marques', rm: 'RM 569307' },
  { name: 'Evandro Marcondes', rm: 'RM 572473' },
  { name: 'Enzo Alves', rm: 'RM 569665' },
  { name: 'Raphael de Oliveira', rm: 'RM 571065' },
  { name: 'Renan Queiroz', rm: 'RM 569077' }
];

export { prototypeStudentMode };
