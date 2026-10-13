// Vercel Function: capturas acadêmicas de demonstração (somente leitura).
// Em desenvolvimento, o vite.config.js executa este mesmo handler em /api/captures.

const captures = [
  {
    id: 'capture-board-thermo',
    title: 'Quadro de Termodinâmica',
    type: 'quadro de aula',
    summary: 'Registro demonstrativo de um quadro com conceitos de conservação de energia e ciclos térmicos.',
    capturedAt: '2026-09-16T14:20:00.000Z',
    tags: ['física', 'quadro', 'resumo'],
    text: 'A termodinâmica estuda as relações entre calor, trabalho e energia. A primeira lei da termodinâmica afirma que a energia de um sistema isolado se conserva: ela não é criada nem destruída, apenas transformada. Em uma máquina térmica, parte do calor recebido da fonte quente é convertida em trabalho e o restante é rejeitado para a fonte fria. Por isso o rendimento de uma máquina térmica real nunca chega a cem por cento. A segunda lei da termodinâmica explica por que o calor flui espontaneamente do corpo mais quente para o mais frio. O ciclo de Carnot é o ciclo teórico de maior rendimento entre duas temperaturas. Geladeiras e motores de carro são exemplos cotidianos de ciclos térmicos. Para a prova, revise a conservação de energia, o cálculo de rendimento e o ciclo de Carnot.'
  },
  {
    id: 'capture-document-notes',
    title: 'Apostila de Biologia Celular',
    type: 'documento',
    summary: 'Exemplo de página impressa digitalizada pelo modo Documento para consulta posterior.',
    capturedAt: '2026-09-18T09:45:00.000Z',
    tags: ['biologia', 'documento', 'digitalização'],
    text: 'A célula é a unidade básica estrutural e funcional dos seres vivos. As células procariontes não possuem núcleo organizado, e o material genético fica disperso no citoplasma. As células eucariontes possuem núcleo delimitado por membrana e diversas organelas. A membrana plasmática controla a entrada e a saída de substâncias da célula. As mitocôndrias são responsáveis pela respiração celular e pela produção de energia na forma de ATP. Os cloroplastos, presentes em células vegetais, realizam a fotossíntese. O retículo endoplasmático e o complexo de Golgi participam da síntese e do transporte de proteínas. Os ribossomos são as estruturas onde as proteínas são produzidas.'
  },
  {
    id: 'capture-summary-history',
    title: 'Slide: Revolução Industrial',
    type: 'slide',
    summary: 'Slide de aula fotografado no Modo Estudante e transformado em resumo curto para revisão.',
    capturedAt: '2026-09-20T18:10:00.000Z',
    tags: ['história', 'slide', 'modo estudante'],
    text: 'A Revolução Industrial começou na Inglaterra na segunda metade do século XVIII. A substituição do trabalho artesanal pela produção mecanizada transformou a economia e a sociedade. A máquina a vapor foi uma das principais inovações do período e impulsionou fábricas, ferrovias e navios. O crescimento das cidades atraiu trabalhadores do campo, que enfrentavam jornadas longas e condições precárias. Surgiram os primeiros movimentos operários e sindicatos em defesa de melhores condições de trabalho. A Segunda Revolução Industrial, no século XIX, trouxe a eletricidade, o petróleo e a produção em massa.'
  },
  {
    id: 'capture-study-annotation',
    title: 'Lista de exercícios de Cálculo',
    type: 'anotação',
    summary: 'Folha de exercícios com anotações complementares do estudante sobre derivadas.',
    capturedAt: '2026-09-22T11:30:00.000Z',
    tags: ['cálculo', 'exercícios', 'anotação'],
    text: 'A derivada de uma função mede a taxa de variação instantânea da função em um ponto. Geometricamente, a derivada representa a inclinação da reta tangente ao gráfico. A regra da potência afirma que a derivada de x elevado a n é n vezes x elevado a n menos um. A regra do produto e a regra da cadeia permitem derivar funções compostas. Pontos em que a derivada é zero podem indicar máximos ou mínimos locais. Na lista, os exercícios de um a cinco usam a regra da potência e os exercícios de seis a dez usam a regra da cadeia.'
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
