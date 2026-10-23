import appCameraSuggestion from '../../assets/landing/app-camera-suggestion.webp';
import appDocumentMode from '../../assets/landing/app-document-mode.webp';
import appExport from '../../assets/landing/app-export.webp';
import appGallery from '../../assets/landing/app-gallery.webp';
import appNotes from '../../assets/landing/app-notes.webp';
import appOcrText from '../../assets/landing/app-ocr-text.webp';
import appStudentMode from '../../assets/landing/app-student-mode.webp';
import appSummary from '../../assets/landing/app-summary.webp';

export const navItems = [
  { href: '#solucao', label: 'A Solução' },
  { href: '#publico', label: 'Público-Alvo' },
  { href: '#galeria', label: 'Galeria' },
  { href: '#equipe', label: 'Nossa Equipe' },
  { href: '#contato', label: 'Contato' }
];

export const heroFacts = [
  { label: 'Entrega', value: 'Sprint 4 · React + Tailwind' },
  { label: 'Câmera', value: 'Real, no navegador' },
  { label: 'Status', value: 'Protótipo funcional' }
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
    description: 'O texto da imagem é extraído (OCR) no próprio aparelho; gere um resumo e faça anotações.'
  },
  {
    number: '3',
    title: 'Organize',
    description: 'Separe por matéria, busque pelo texto e exporte em PDF, TXT ou para o Google Docs.'
  }
];

export const features = [
  {
    category: 'Contexto',
    title: 'Reconhecimento de contexto',
    description: 'A câmera analisa a cena e sugere o modo Documento ou Noite — você decide se aceita.'
  },
  {
    category: 'Captura',
    title: 'Assistência de captura',
    description: 'Molduras de enquadramento, grade, foco por toque, exposição, timer e flash.'
  },
  {
    category: 'Captura',
    title: 'Captura simplificada',
    description: 'Um toque para capturar; sem análise confiável, a câmera segue no automático.'
  },
  {
    category: 'Documento',
    title: 'Digitalização de documentos',
    description: 'Recorta pela moldura e deixa o papel branco e o texto nítido.'
  },
  {
    category: 'Texto',
    title: 'Extração de texto/OCR',
    description: 'Tesseract.js em português, rodando no navegador, com progresso e revisão do texto.'
  },
  {
    category: 'Estudo',
    title: 'Resumo acadêmico',
    description: 'Resumo extrativo com as frases mais relevantes do próprio texto, curto ou médio.'
  },
  {
    category: 'Estudo',
    title: 'Anotações',
    description: 'Notas por captura, salvas automaticamente junto com a imagem.'
  },
  {
    category: 'Arquivo',
    title: 'Organização de conteúdo',
    description: 'Álbuns por matéria, busca no texto extraído e filtros por tipo.'
  },
  {
    category: 'Arquivo',
    title: 'Exportação',
    description: 'PDF, TXT, imagem original, compartilhamento nativo e envio ao Google Docs.'
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
    src: appCameraSuggestion,
    alt: 'Câmera no modo Foto sugerindo o modo Documento ao reconhecer uma folha impressa.',
    caption: 'Sugestão de modo pela cena'
  },
  {
    src: appDocumentMode,
    alt: 'Modo Documento com a moldura verde indicando que a folha está enquadrada.',
    caption: 'Modo Documento enquadrado'
  },
  {
    src: appOcrText,
    alt: 'Texto da folha extraído por OCR e pronto para edição, com contagem de palavras e confiança.',
    caption: 'Texto extraído (OCR)'
  },
  {
    src: appSummary,
    alt: 'Resumo gerado com as frases principais do texto e os termos mais frequentes.',
    caption: 'Resumo acadêmico'
  },
  {
    src: appNotes,
    alt: 'Anotações do estudante vinculadas à captura, salvas automaticamente.',
    caption: 'Anotações'
  },
  {
    src: appStudentMode,
    alt: 'Modo Estudante com moldura de slide e o álbum de destino das capturas.',
    caption: 'Modo Estudante'
  },
  {
    src: appExport,
    alt: 'Opções de exportação: PDF, texto, imagem, copiar, Google Docs e compartilhar.',
    caption: 'Exportação'
  },
  {
    src: appGallery,
    alt: 'Galeria com busca, filtros por tipo e álbuns por matéria.',
    caption: 'Galeria por matéria'
  }
];

export const teamMembers = [
  {
    name: 'Renan Queiroz',
    rm: 'RM 569077',
    role: 'Câmera e Modo Estudante',
    description: 'Visor em tempo real, modos de captura, zoom por gestos e proporções, além da extração de texto (OCR), resumo e explicação dos termos pela Wikipédia.'
  },
  {
    name: 'Raphael de Oliveira',
    rm: 'RM 571065',
    role: 'Gravação de vídeo',
    description: 'Gravação com áudio na proporção escolhida, zoom durante a gravação e salvamento dos vídeos na galeria.'
  },
  {
    name: 'Evandro Marcondes',
    rm: 'RM 572473',
    role: 'Documento e galeria',
    description: 'Digitalização de documentos, álbuns por matéria, busca e exportação em PDF e TXT.'
  },
  {
    name: 'Pedro Henrique Marques',
    rm: 'RM 569307',
    role: 'Landing Page',
    description: 'Estrutura das seções, responsividade para mobile, tablet e desktop e conteúdo da página.'
  }
];

export { appDocumentMode as heroImage };
