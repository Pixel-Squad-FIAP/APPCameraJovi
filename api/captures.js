const captures = [
  {
    id: 'capture-board-thermo',
    title: 'Quadro de Termodinâmica',
    type: 'quadro de aula',
    summary: 'Registro demonstrativo de um quadro com conceitos de conservação de energia e ciclos térmicos.',
    capturedAt: '2026-04-16T14:20:00.000Z',
    tags: ['aula', 'quadro', 'resumo']
  },
  {
    id: 'capture-document-notes',
    title: 'Documento de estudo digitalizado',
    type: 'documento',
    summary: 'Exemplo acadêmico de material impresso enquadrado pelo modo documento para consulta posterior.',
    capturedAt: '2026-04-18T09:45:00.000Z',
    tags: ['documento', 'digitalização']
  },
  {
    id: 'capture-summary-history',
    title: 'Resumo de capítulo',
    type: 'resumo',
    summary: 'Demonstração de captura transformada em resumo curto para apoiar revisão antes da prova.',
    capturedAt: '2026-04-20T18:10:00.000Z',
    tags: ['modo estudante', 'resumo']
  },
  {
    id: 'capture-study-annotation',
    title: 'Anotação de estudo',
    type: 'anotação',
    summary: 'Exemplo de anotação complementar criada a partir de uma captura acadêmica no Modo Estudante.',
    capturedAt: '2026-04-22T11:30:00.000Z',
    tags: ['anotação', 'organização']
  }
];

export default function handler(request, response) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({
      error: 'Método não permitido'
    });
  }

  response.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return response.status(200).json({
    items: captures
  });
}
