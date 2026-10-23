/**
 * Matriz curricular de Matemática — Ensino Fundamental (1º ao 9º ano).
 *
 * Montada a partir da BNCC homologada (resolução 3/2018), seção Matemática,
 * páginas 268 a 330. Cada habilidade carrega os códigos oficiais para que o
 * relatório da área dos pais possa ser conferido na escola.
 *
 * Estrutura: unidade temática -> trilha (o que a criança escolhe no hub)
 *            -> habilidade (o que o motor de perguntas treina).
 *
 * grades: [anoMínimo, anoMáximo] — o motor escala a dificuldade dentro da faixa.
 */

export const UNITS = {
  numeros: {
    label: 'Números',
    icon: 'fa-cubes',
    color: '#FF6B9D',
    desc: 'Contar, ler, comparar e operar com números',
  },
  algebra: {
    label: 'Álgebra',
    icon: 'fa-scale-balanced',
    color: '#9B5DE5',
    desc: 'Padrões, sequências, igualdades e equações',
  },
  geometria: {
    label: 'Geometria',
    icon: 'fa-shapes',
    color: '#3DBBFF',
    desc: 'Formas planas, sólidos, ângulos e posições',
  },
  medidas: {
    label: 'Grandezas e Medidas',
    icon: 'fa-ruler-combined',
    color: '#FF9A3C',
    desc: 'Comprimento, tempo, dinheiro, massa e volume',
  },
  dados: {
    label: 'Probabilidade e Estatística',
    icon: 'fa-chart-column',
    color: '#4ECDC4',
    desc: 'Gráficos, tabelas, chance e média',
  },
};

export const UNIT_ORDER = ['numeros', 'algebra', 'geometria', 'medidas', 'dados'];

export const GRADES = [
  { id: 1, label: '1º ano', short: '1º', band: 'Anos Iniciais' },
  { id: 2, label: '2º ano', short: '2º', band: 'Anos Iniciais' },
  { id: 3, label: '3º ano', short: '3º', band: 'Anos Iniciais' },
  { id: 4, label: '4º ano', short: '4º', band: 'Anos Iniciais' },
  { id: 5, label: '5º ano', short: '5º', band: 'Anos Iniciais' },
  { id: 6, label: '6º ano', short: '6º', band: 'Anos Finais' },
  { id: 7, label: '7º ano', short: '7º', band: 'Anos Finais' },
  { id: 8, label: '8º ano', short: '8º', band: 'Anos Finais' },
  { id: 9, label: '9º ano', short: '9º', band: 'Anos Finais' },
];

export const BANDS = {
  iniciais: { label: 'Anos Iniciais (1º ao 5º)', grades: [1, 2, 3, 4, 5] },
  finais: { label: 'Anos Finais (6º ao 9º)', grades: [6, 7, 8, 9] },
};

/** atalho para declarar habilidade */
function h(id, nome, gen, cfg, grades, codes, unidade) {
  return { id, nome, gen, cfg: cfg || {}, grades, codes, unidade };
}

export const TRACKS = [
  {
    id: 'contagem',
    nome: 'Caixa de Bombons',
    sub: 'Contar, comparar e ordenar quantidades',
    unidade: 'numeros',
    icon: 'fa-candy-cane',
    cor: '#FF6B9D',
    grades: [1, 4],
    habilidades: [
      h('contar', 'Contar doces', 'count', {}, [1, 2], ['EF01MA01', 'EF01MA04']),
      h('comparar-quant', 'Maior ou menor?', 'numberSense', { modo: 'comparar' }, [1, 3], ['EF01MA05', 'EF02MA03']),
      h('ordenar', 'Colocar em ordem', 'numberSense', { modo: 'ordenar' }, [2, 4], ['EF02MA04', 'EF03MA04']),
      h('reta', 'Reta numérica', 'numberSense', { modo: 'reta' }, [1, 4], ['EF01MA05', 'EF03MA01']),
      h('vizinhos', 'Antes e depois', 'numberSense', { modo: 'vizinhos' }, [2, 4], ['EF03MA01']),
      h('estimar', 'Estimativa rápida', 'estimate', {}, [2, 4], ['EF02MA02']),
    ],
  },
  {
    id: 'valor-posicional',
    nome: 'Fábrica de Números',
    sub: 'Unidade, dezena, centena e milhar',
    unidade: 'numeros',
    icon: 'fa-layer-group',
    cor: '#FF4D8F',
    grades: [2, 6],
    habilidades: [
      h('compor', 'Compor e decompôr', 'numberSense', { modo: 'compor' }, [2, 5], ['EF02MA01', 'EF03MA01']),
      h('valor-algarismo', 'Valor do algarismo', 'numberSense', { modo: 'valor' }, [3, 5], ['EF04MA02']),
      h('arredondar', 'Arredondar', 'numberSense', { modo: 'arredondar' }, [4, 6], ['EF04MA01', 'EF06MA03']),
      h('grandeza-numerica', 'Números grandes', 'numberSense', { modo: 'lerGrande' }, [4, 6], ['EF05MA01']),
    ],
  },
  {
    id: 'adição',
    nome: 'Bomba de Adição',
    sub: 'Somas, duplas e problemas de juntar',
    unidade: 'numeros',
    icon: 'fa-plus',
    cor: '#6BCB77',
    grades: [1, 5],
    habilidades: [
      h('soma-ate-10', 'Soma até 10', 'arithmetic', { ops: ['add'], forca: 1 }, [1, 2], ['EF01MA06']),
      h('soma-ate-20', 'Soma até 20', 'arithmetic', { ops: ['add'], forca: 2 }, [1, 3], ['EF01MA06', 'EF01MA07']),
      h('soma-grande', 'Soma com reserva', 'arithmetic', { ops: ['add'], forca: 3 }, [2, 5], ['EF02MA06', 'EF03MA03']),
      h('dobro-metade', 'Dobro e metade', 'doubleHalf', {}, [2, 4], ['EF02MA08']),
      h('problema-juntar', 'Problema de juntar', 'wordProblem', { tipo: 'juntar' }, [1, 4], ['EF01MA08', 'EF03MA06']),
      h('problema-comparar', 'Problema de comparar', 'wordProblem', { tipo: 'comparar' }, [2, 5], ['EF03MA06']),
    ],
  },
  {
    id: 'subtracao',
    nome: 'Subtração Docinha',
    sub: 'Tirar, retirar e descobrir a diferença',
    unidade: 'numeros',
    icon: 'fa-minus',
    cor: '#4ECDC4',
    grades: [1, 5],
    habilidades: [
      h('subt-ate-10', 'Subtração até 10', 'arithmetic', { ops: ['sub'], forca: 1 }, [1, 2], ['EF01MA08']),
      h('subt-ate-30', 'Subtração até 30', 'arithmetic', { ops: ['sub'], forca: 2 }, [1, 3], ['EF01MA08']),
      h('subt-grande', 'Subtração com troca', 'arithmetic', { ops: ['sub'], forca: 3 }, [2, 5], ['EF02MA06', 'EF04MA05']),
      h('completa-ate', 'Quanto falta?', 'missingNumber', { modo: 'complemento' }, [1, 3], ['EF01MA07', 'EF02MA05']),
      h('problema-tirar', 'Problema de tirar', 'wordProblem', { tipo: 'tirar' }, [2, 5], ['EF02MA09', 'EF03MA06']),
    ],
  },
  {
    id: 'multiplicacao',
    nome: 'Fileiras de Brigadeiros',
    sub: 'Tabuada, arranjos e contagem por pares',
    unidade: 'numeros',
    icon: 'fa-xmark',
    cor: '#FFD93D',
    grades: [2, 6],
    habilidades: [
      h('tabuada-curta', 'Tabuada do 2 ao 5', 'arithmetic', { ops: ['mul'], forca: 1 }, [2, 4], ['EF02MA07', 'EF03MA07']),
      h('tabuada', 'Tabuada completa', 'arithmetic', { ops: ['mul'], forca: 2 }, [3, 6], ['EF03MA07', 'EF04MA06']),
      h('arranjo', 'Arranjo retangular', 'array', {}, [3, 5], ['EF04MA06']),
      h('mul-digito', 'Multiplicar com 2 algarismos', 'arithmetic', { ops: ['mul'], forca: 3 }, [4, 6], ['EF04MA06']),
      h('combinar', 'Quantas combinações?', 'combination', {}, [5, 8], ['EF05MA09', 'EF08MA03']),
    ],
  },
  {
    id: 'divisao',
    nome: 'Dividir a Bala',
    sub: 'Repartir igual e entender o resto',
    unidade: 'numeros',
    icon: 'fa-divide',
    cor: '#9B5DE5',
    grades: [3, 7],
    habilidades: [
      h('div-exata', 'Divisão exata', 'arithmetic', { ops: ['div'], forca: 1 }, [3, 6], ['EF03MA08']),
      h('div-resto', 'Divisão com resto', 'divRemainder', {}, [4, 6], ['EF04MA07', 'EF06MA07']),
      h('repartir', 'Repartir igualmente', 'wordProblem', { tipo: 'repartir' }, [3, 6], ['EF03MA08']),
      h('multiplos', 'Múltiplos e divisores', 'multiplesDivisors', {}, [5, 7], ['EF06MA05', 'EF06MA06']),
      h('divisibilidade', 'Dá para dividir?', 'divisibility', {}, [4, 7], ['EF04MA12', 'EF06MA06']),
    ],
  },
  {
    id: 'fracoes',
    nome: 'Fatia de Bolo',
    sub: 'Frações: partes, equivalência e comparação',
    unidade: 'numeros',
    icon: 'fa-chart-pie',
    cor: '#FF9A3C',
    grades: [3, 8],
    habilidades: [
      h('fracao-visual', 'Que parte está colorida?', 'fraction', { modo: 'visual' }, [3, 6], ['EF04MA09', 'EF05MA03']),
      h('fracao-quantidade', 'Fração de uma quantidade', 'fraction', { modo: 'quantidade' }, [3, 7], ['EF03MA09', 'EF06MA09']),
      h('fracao-equivalente', 'Frações equivalentes', 'fraction', { modo: 'equivalente' }, [5, 8], ['EF05MA04', 'EF06MA09']),
      h('fracao-comparar', 'Comparar frações', 'fraction', { modo: 'comparar' }, [5, 7], ['EF05MA05', 'EF06MA10']),
      h('fracao-somar', 'Somar frações', 'fraction', { modo: 'somar' }, [6, 8], ['EF06MA11', 'EF07MA11']),
    ],
  },
  {
    id: 'decimais',
    nome: 'Moedas e Centavos',
    sub: 'Números decimais e o dinheiro do Brasil',
    unidade: 'medidas',
    icon: 'fa-coins',
    cor: '#3DBBFF',
    grades: [1, 7],
    habilidades: [
      h('dinheiro-total', 'Quanto tem na carteira?', 'money', { modo: 'total' }, [1, 4], ['EF01MA19', 'EF02MA20']),
      h('dinheiro-troco', 'Troco da loja', 'money', { modo: 'troco' }, [3, 6], ['EF04MA25']),
      h('ler-decimal', 'Ler decimais', 'decimal', { modo: 'ler' }, [4, 6], ['EF04MA10', 'EF05MA02']),
      h('comparar-decimal', 'Comparar decimais', 'decimal', { modo: 'comparar' }, [4, 6], ['EF05MA05', 'EF06MA03']),
      h('operar-decimal', 'Contas com vírgula', 'decimal', { modo: 'operar' }, [5, 7], ['EF05MA07', 'EF06MA12']),
    ],
  },
  {
    id: 'porcentagem',
    nome: 'Saldão de Doces',
    sub: 'Porcentagem, desconto e proporção',
    unidade: 'numeros',
    icon: 'fa-percent',
    cor: '#FF6B9D',
    grades: [5, 9],
    habilidades: [
      h('pct-usual', 'Metade, quarta parte...', 'percent', { modo: 'usual' }, [5, 7], ['EF05MA06']),
      h('pct-calculo', 'Calcular porcentagem', 'percent', { modo: 'calculo' }, [6, 9], ['EF06MA13', 'EF08MA04']),
      h('pct-mudanca', 'Aumento e desconto', 'percent', { modo: 'mudanca' }, [7, 9], ['EF07MA02', 'EF09MA05']),
      h('razao-proporcao', 'Razão e proporção', 'ratio', {}, [6, 9], ['EF06MA15', 'EF09MA08']),
    ],
  },
  {
    id: 'padroes',
    nome: 'Detetive de Padrões',
    sub: 'Sequências, regularidades e igualdade',
    unidade: 'algebra',
    icon: 'fa-shuffle',
    cor: '#9B5DE5',
    grades: [1, 6],
    habilidades: [
      h('sequencia', 'Complete a sequência', 'sequence', {}, [1, 5], ['EF01MA10', 'EF02MA10', 'EF02MA11']),
      h('balanca', 'Balança em equilíbrio', 'balance', {}, [3, 7], ['EF03MA11', 'EF05MA10', 'EF06MA14']),
      h('numero-oculto', 'Número escondido', 'missingNumber', { modo: 'oculto' }, [3, 6], ['EF04MA15', 'EF05MA11']),
      h('igualdade', 'Mantém a igualdade?', 'balance', { modo: 'igualdade' }, [4, 7], ['EF05MA10', 'EF06MA14']),
    ],
  },
  {
    id: 'equacoes',
    nome: 'Laboratório de Equações',
    sub: 'Letras, potências e raízes',
    unidade: 'algebra',
    icon: 'fa-superscript',
    cor: '#FF4D8F',
    grades: [6, 9],
    habilidades: [
      h('valor-expressao', 'Valor numérico', 'expression', { modo: 'valor' }, [6, 9], ['EF07MA13', 'EF08MA06']),
      h('equacao-1g', 'Equação do 1º grau', 'expression', { modo: 'equacao' }, [7, 9], ['EF07MA18']),
      h('potencia', 'Potências', 'powerRoot', { modo: 'potencia' }, [8, 9], ['EF08MA01']),
      h('raiz', 'Raiz quadrada', 'powerRoot', { modo: 'raiz' }, [8, 9], ['EF08MA02']),
    ],
  },
  {
    id: 'formas',
    nome: 'Museu das Formas',
    sub: 'Figuras planas, sólidos e simetria',
    unidade: 'geometria',
    icon: 'fa-shapes',
    cor: '#3DBBFF',
    grades: [1, 8],
    habilidades: [
      h('forma-plana', 'Qual é a forma?', 'geometry', { modo: 'forma' }, [1, 3], ['EF01MA14', 'EF02MA15']),
      h('solido', 'Sólidos geométricos', 'geometry', { modo: 'solido' }, [1, 4], ['EF01MA13', 'EF03MA13']),
      h('lados-vertices', 'Lados e vértices', 'geometry', { modo: 'elementos' }, [3, 6], ['EF03MA14', 'EF06MA19']),
      h('simetria', 'Eixo de simetria', 'geometry', { modo: 'simetria' }, [4, 8], ['EF04MA19', 'EF07MA21']),
      h('angulos', 'Tipo de ângulo', 'geometry', { modo: 'angulo' }, [4, 8], ['EF04MA18', 'EF06MA25', 'EF07MA27']),
      h('poligonos', 'Polígonos e triângulos', 'geometry', { modo: 'poligono' }, [5, 8], ['EF05MA16', 'EF06MA20', 'EF07MA24']),
    ],
  },
  {
    id: 'espaco',
    nome: 'Mapa do Tesouro',
    sub: 'Posição, deslocamento e coordenadas',
    unidade: 'geometria',
    icon: 'fa-map-location-dot',
    cor: '#4ECDC4',
    grades: [1, 9],
    habilidades: [
      h('posicao', 'Direita, esquerda, acima', 'position', { modo: 'relativa' }, [1, 3], ['EF01MA11', 'EF02MA12']),
      h('roteiro', 'Seguir o roteiro', 'position', { modo: 'roteiro' }, [2, 5], ['EF02MA13', 'EF05MA14']),
      h('coordenadas', 'Plano cartesiano', 'position', { modo: 'coordenada' }, [5, 9], ['EF05MA15', 'EF06MA16', 'EF09MA16']),
    ],
  },
  {
    id: 'medidas',
    nome: 'Armazém das Medidas',
    sub: 'Comprimento, massa, capacidade e tempo',
    unidade: 'medidas',
    icon: 'fa-ruler-combined',
    cor: '#FF9A3C',
    grades: [1, 9],
    habilidades: [
      h('medida-comparar', 'Mais longo, mais pesado', 'measure', { modo: 'comparar' }, [1, 3], ['EF01MA15', 'EF01MA16', 'EF01MA17']),
      h('unidade-certa', 'Qual unidade usar?', 'measure', { modo: 'unidade' }, [2, 6], ['EF02MA16', 'EF03MA19', 'EF03MA20']),
      h('conversao', 'Converter unidades', 'measure', { modo: 'converter' }, [3, 9], ['EF05MA19', 'EF06MA24', 'EF08MA20']),
      h('relogio', 'Que horas são?', 'measure', { modo: 'relogio' }, [2, 5], ['EF02MA18', 'EF02MA19', 'EF03MA23']),
      h('calendario', 'Calendário e idades', 'measure', { modo: 'calendario' }, [1, 4], ['EF01MA18', 'EF02MA18']),
      h('temperatura', 'Temperatura', 'measure', { modo: 'temperatura' }, [4, 6], ['EF04MA23', 'EF06MA24']),
    ],
  },
  {
    id: 'perimetro-area',
    nome: 'Contorno e Preenchimento',
    sub: 'Perímetro, área e volume na malha',
    unidade: 'medidas',
    icon: 'fa-table-cells',
    cor: '#6BCB77',
    grades: [4, 9],
    habilidades: [
      h('perimetro-malha', 'Perímetro na malha', 'gridMeasure', { modo: 'perimetro' }, [4, 6], ['EF04MA21', 'EF06MA24']),
      h('area-malha', 'Área na malha', 'gridMeasure', { modo: 'area' }, [3, 6], ['EF03MA21', 'EF05MA20']),
      h('area-retangulo', 'Área do retângulo', 'gridMeasure', { modo: 'formula' }, [5, 8], ['EF05MA20', 'EF06MA24', 'EF07MA31']),
      h('volume', 'Volume por empilhamento', 'gridMeasure', { modo: 'volume' }, [5, 9], ['EF05MA21', 'EF07MA30', 'EF09MA19']),
    ],
  },
  {
    id: 'dados',
    nome: 'Banca de Pesquisas',
    sub: 'Gráficos, tabelas, chance e média',
    unidade: 'dados',
    icon: 'fa-chart-column',
    cor: '#4ECDC4',
    grades: [1, 9],
    habilidades: [
      h('ler-grafico', 'Ler gráfico de colunas', 'data', { modo: 'grafico' }, [1, 6], ['EF01MA21', 'EF03MA26', 'EF06MA33']),
      h('ler-tabela', 'Ler tabela', 'data', { modo: 'tabela' }, [2, 6], ['EF02MA22', 'EF06MA33']),
      h('chance', 'Certos, talvez ou impossível', 'data', { modo: 'chance' }, [1, 4], ['EF01MA20', 'EF03MA25']),
      h('probabilidade', 'Qual a probabilidade?', 'data', { modo: 'probabilidade' }, [5, 9], ['EF05MA22', 'EF06MA30', 'EF09MA20']),
      h('media', 'Média, moda e mediana', 'data', { modo: 'media' }, [7, 9], ['EF07MA35', 'EF08MA25']),
    ],
  },
];

// ---------------------------------------------------------------------------
// Índices auxiliares
// ---------------------------------------------------------------------------

export const TRACKS_BY_ID = {};
TRACKS.forEach(t => { TRACKS_BY_ID[t.id] = t; });

export const SKILLS_BY_ID = {};
TRACKS.forEach(t => {
  t.habilidades.forEach(sk => {
    sk.trilhaId = t.id;
    sk.trilhaNome = t.nome;
    sk.unidade = sk.unidade || t.unidade;
    SKILLS_BY_ID[sk.id] = sk;
  });
});

/**
 * Habilidades treinadas por um modo próprio (a cruzadinha tem grade pronta,
 * não passa pelo gerador). Elas não entram na rotação de perguntas, mas
 * aparecem no relatório da Área dos Pais.
 */
export const MODO_SKILLS = [
  {
    id: 'grade-logica',
    nome: 'Lógica em grade',
    trilhaId: 'padroes',
    trilhaNome: 'Detetive de Padrões',
    unidade: 'algebra',
    grades: [2, 6],
    codes: ['EF02MA10', 'EF03MA11'],
  },
];
MODO_SKILLS.forEach(sk => { SKILLS_BY_ID[sk.id] = sk; });

/** Trilha virtual: sorteia de todas as trilhas da idade, priorizando os erros */
export const MIX_TRACK = {
  id: 'mix',
  nome: 'Mix da Juju',
  sub: 'Um pouco de tudo, com foco no que você precisa treinar',
  unidade: 'mix',
  icon: 'fa-wand-magic-sparkles',
  cor: '#FFD93D',
  grades: [1, 9],
  habilidades: [],
};

export function tracksForGrade(grade) {
  return TRACKS.filter(t => grade >= t.grades[0] && grade <= t.grades[1]);
}

export function skillsOfTrack(trackId, grade) {
  if (trackId === 'mix') {
    return tracksForGrade(grade).reduce((acc, t) => acc.concat(t.habilidades), []);
  }
  const t = TRACKS_BY_ID[trackId];
  if (!t) return [];
  return t.habilidades.filter(sk => grade >= sk.grades[0] && grade <= sk.grades[1]);
}

export function unitsSummary() {
  return UNIT_ORDER.map(id => ({ id, ...UNITS[id] }));
}

/** Nome curto do nível dentro da trilha, para exibir na pergunta */
export function levelName(d) {
  return ['Suave', 'Docinho', 'Reforçado', 'Mestre Doce'][Math.min(3, Math.max(0, d))];
}
