/**
 * Geradores de Geometria: figuras planas, sólidos, elementos, ângulos,
 * simetria, posiçao no plano e o planocartesiano.
 */
import { rnd, pick, chance, fmt, options, ramp, CANDY_ICONS } from '../questionUtils.js';

const FORMAS = [
  { nome: 'quadrado', lados: 4, vertices: 4, eixos: 4, pista: 'tem 4 lados todos iguais e 4 ângulos retos' },
  { nome: 'retângulo', lados: 4, vertices: 4, eixos: 2, pista: 'tem 4 ângulos retos, mas os lados de cima e de baixo são diferentes dos lados das laterais' },
  { nome: 'triângulo', lados: 3, vertices: 3, eixos: 0, pista: 'tem três lados e três pontas' },
  { nome: 'círculo', lados: 0, vertices: 0, eixos: 'infinitos', pista: 'é redondo, não tem nenhum lado reto' },
  { nome: 'pentágono', lados: 5, vertices: 5, eixos: 0, pista: 'tem cinco lados' },
  { nome: 'hexágono', lados: 6, vertices: 6, eixos: 0, pista: 'tem seis lados, como uma colmeia de abelha' },
  { nome: 'octógono', lados: 8, vertices: 8, eixos: 0, pista: 'tem oito lados, como a sinalização de PARE' },
];

const SOLIDOS = [
  { nome: 'cubo', faces: 6, arestas: 12, vertices: 8, base: 'quadrada', exemplo: 'dado de brinquedo' },
  { nome: 'esfera', faces: 0, arestas: 0, vertices: 0, base: 'nenhuma, é toda redonda', exemplo: 'bala de goma redonda' },
  { nome: 'cilindro', faces: 3, arestas: 2, vertices: 0, base: 'duas circunferências', exemplo: 'rolo de bala redondo' },
  { nome: 'cone', faces: 2, arestas: 1, vertices: 1, base: 'uma circunferência', exemplo: 'casquinha de sorvete' },
  { nome: 'pirâmide quadrada', faces: 5, arestas: 8, vertices: 5, base: 'quadrada', exemplo: 'chocolates especiais' },
  { nome: 'prisma triangular', faces: 5, arestas: 9, vertices: 6, base: 'triangular', exemplo: 'caixinha de bombom em forma de triângulo' },
];

const ANGULOS = [
  { nome: 'agudo', faixa: [1, 89], desc: 'menor que uma esquina de caderno' },
  { nome: 'reto', faixa: [90, 90], desc: 'exatamente 90 graus, como a esquina de uma folha' },
  { nome: 'obtuso', faixa: [91, 179], desc: 'maior que o reto, mas menor que a meia-volta' },
  { nome: 'raso', faixa: [180, 180], desc: 'uma meia-volta, 180 graus' },
];

/* ------------------------------------------------------------------ */
export function geometry(skill, grade) {
  const nivel = ramp(skill, grade);
  const modo = skill.cfg.modo;

  if (modo === 'forma') {
    const alvo = pick(FORMAS);
    const distr = FORMAS.filter(f => f.nome !== alvo.nome).map(f => f.nome);
    return {
      prompt: `Que forma é essa: ${alvo.pista}?`,
      value: alvo.nome,
      opts: options(alvo.nome, distr.slice(0, 3), v => v),
      explain: `${alvo.nome.charAt(0).toUpperCase() + alvo.nome.slice(1)} ${alvo.pista}.`,
      visual: { kind: 'shape', forma: alvo.nome },
    };
  }

  if (modo === 'solido') {
    const alvo = pick(SOLIDOS);
    const distr = SOLIDOS.filter(s => s.nome !== alvo.nome).map(s => s.nome);
    return {
      prompt: `Qual sólido geométrico parece ${alvo.exemplo} e tem ${alvo.faces} ${alvo.faces === 1 ? 'face' : 'faces'}?`,
      value: alvo.nome,
      opts: options(alvo.nome, distr, v => v),
      explain: `${alvo.nome.charAt(0).toUpperCase() + alvo.nome.slice(1)} tem ${alvo.faces} faces, ${alvo.arestas} arestas e ${alvo.vertices} vértices.`,
      visual: { kind: 'solid', nome: alvo.nome },
    };
  }

  if (modo === 'elementos') {
    const alvo = pick(FORMAS.filter(f => f.lados > 0));
    const pede = chance(0.5) ? 'lados' : 'vertices';
    const value = pede === 'lados' ? alvo.lados : alvo.vertices;
    return {
      prompt: `Quantos ${pede} tem um ${alvo.nome}?`,
      value,
      opts: options(value, [value + 1, value - 1, value + 2, alvo.nome === 'triângulo' ? 4 : 3]),
      explain: `Um ${alvo.nome} tem ${alvo.lados} lados e ${alvo.vertices} vértices (as pontinhas).`,
      visual: { kind: 'shape', forma: alvo.nome },
    };
  }

  if (modo === 'simetria') {
    const alvo = pick(FORMAS.filter(f => typeof f.eixos === 'number'));
    const value = alvo.eixos;
    return {
      prompt: `Quantos eixos de simetria um ${alvo.nome} tem? (linhas que o dividem em duas metades iguais)`,
      value,
      opts: options(value, [value + 1, value + 2, 1, 0]),
      explain: `O ${alvo.nome} tem ${value} ${value === 1 ? 'eixe' : 'eixos'} de simetria.`,
      visual: { kind: 'shape', forma: alvo.nome, simetria: true },
    };
  }

  if (modo === 'angulo') {
    if (chance(0.5)) {
      const tipo = pick(ANGULOS.filter(a => a.nome !== 'raso' || nivel >= 2));
      const graus = tipo.faixa[0] === tipo.faixa[1] ? tipo.faixa[0] : rnd(tipo.faixa[0], tipo.faixa[1]);
      const value = graus;
      return {
        prompt: `Um ângulo de ${graus}° é classificado como?`,
        value: nomeAngulo(graus),
        opts: options(nomeAngulo(graus), ANGULOS.map(a => a.nome), v => v),
        explain: `${graus}° é ${nomeAngulo(graus).toLowerCase()}: ${tipo.desc}.`,
        visual: { kind: 'angle', graus },
      };
    }
    const tipo = pick(ANGULOS);
    const graus = tipo.faixa[0] === tipo.faixa[1] ? tipo.faixa[0] : rnd(tipo.faixa[0], tipo.faixa[1]);
    return {
      prompt: `O desenho mostra um ângulo ${tipo.nome}. Qual pode ser a medida dele?`,
      value: graus,
      opts: options(graus, ANGULOS.filter(a => a.nome !== tipo.nome).map(a => rnd(a.faixa[0], a.faixa[1])), v => String(v)),
      explain: `Ângulo ${tipo.nome} fica entre ${tipo.faixa[0]}° e ${tipo.faixa[1]}°.`,
      visual: { kind: 'angle', graus },
    };
  }

  // polígono
  const fatos = [
    { t: 'Todo triângulo tem a soma dos ângulos internos igual a...', v: 180, d: [360, 90, 270], e: 'A soma dos três ângulos de qualquer triângulo é sempre 180°.' },
    { t: 'Um quadrilátero tem quantos lados?', v: 4, d: [3, 5, 6], e: 'Quadrilátero é a figura de quatro lados.' },
    { t: 'Quantos lados tem um pentágono?', v: 5, d: [4, 6, 7], e: 'Penta vem do grego e significa cinco.' },
    { t: 'Um polígono de 6 lados chama-se...', v: 'hexágono', d: ['pentágono', 'octógono', 'decágono'], e: 'Hexa = 6 lados.' },
    { t: 'Qual polígono tem todos os lados e ângulos iguais?', v: 'polígono regular', d: ['polígono irregular', 'triângulo escaleno', 'retângulo'], e: 'Regular é a palavra para "todos iguais".' },
    { t: 'Um triângulo com dois lados iguais é chamado de...', v: 'isósceles', d: ['equilátero', 'escaleno', 'retângulo'], e: 'Isósceles tem dois lados iguais; equilátero tem três.' },
  ];
  const f = pick(fatos);
  return {
    prompt: f.t,
    value: f.v,
    opts: options(f.v, f.d, v => String(v)),
    explain: f.e,
    visual: { kind: 'shape', forma: 'hexágono' },
  };
}

function nomeAngulo(g) {
  if (g < 90) return 'agudo';
  if (g === 90) return 'reto';
  if (g < 180) return 'obtuso';
  return 'raso';
}

/* ------------------------------------------------------------------ */
/* Posição, deslocamento e coordenadas                                 */
/* ------------------------------------------------------------------ */
export function position(skill, grade) {
  const nivel = ramp(skill, grade);
  const modo = skill.cfg.modo;

  if (modo === 'relativa') {
    const fila = ['Ana', 'Beto', 'Cai', 'Duda', 'Elis'];
    const idx = rnd(1, 3);
    const pede = pick(['esquerda', 'direita']);
    const mapa = fila.slice(0, 4);
    const alvo = mapa[idx];
    const value = pede === 'esquerda' ? mapa[idx - 1] : mapa[idx + 1];
    return {
      prompt: `Na fila da cantina estão, da esquerda para a direita: ${mapa.join(' — ')}. Quem está à ${pede} de ${alvo}?`,
      value,
      opts: options(value, mapa.filter(n => n !== value).concat(['Nina']), v => v),
      explain: `Lendo a fila da esquerda para a direita (${mapa.join(', ')}), à ${pede} de ${alvo} está ${value}.`,
      visual: { kind: 'queue', pessoas: mapa, destaque: idx },
    };
  }

  if (modo === 'roteiro') {
    const passos = rnd(2, 5);
    const virar = pick(['direita', 'esquerda']);
    const value = passos;
    return {
      prompt: `A Juju saiu da loja de doces: andou ${passos} quadras para frente, virou à ${virar} e andou 1 quadra, depois virou à ${virar === 'direita' ? 'esquerda' : 'direita'} e andou ${passos} quadras. Quantas quadras ela andou no total?`,
      value: passos + 1 + passos,
      opts: options(passos + 1 + passos, [passos * 2, passos + 1, passos * 3]),
      explain: `Some cada trecho: ${passos} + 1 + ${passos} = ${passos * 2 + 1} quadras. Virar não muda a distância andada.`,
    };
  }

  // coordenadas
  const max = nivel < 1 ? 5 : 10;
  const x = rnd(0, max);
  const y = rnd(0, max);
  const outroX = rnd(0, max);
  const outroY = rnd(0, max);
  const pedeNome = pick(['x', 'y']);
  const value = pedeNome === 'x' ? x : y;
  return {
    prompt: `No plano cartesiano, o doces está no ponto (${x}, ${y}). Qual é a coordenada ${pedeNome.toUpperCase()} desse ponto?`,
    value,
    opts: options(value, [pedeNome === 'x' ? y : x, x + y, outroX, outroY]),
    explain: `O par ordenado é sempre escrito (x, y): o primeiro número é a horizontal e o segundo é a vertical. Então ${pedeNome} = ${value}.`,
    visual: { kind: 'cartesian', x, y },
  };
}

/* ------------------------------------------------------------------ */
/* Perímetro, área e volume                                            */
/* ------------------------------------------------------------------ */
export function gridMeasure(skill, grade) {
  const nivel = ramp(skill, grade);
  const modo = skill.cfg.modo;

  if (modo === 'perimetro') {
    const w = rnd(2, 6 + nivel);
    const h = rnd(2, 5 + nivel);
    const value = 2 * (w + h);
    return {
      prompt: `A cartolina retangular do mural mede ${w} cm de largura por ${h} cm de altura. Qual é o perímetro (a volta toda)?`,
      value,
      opts: options(value, [w * h, w + h, value + 2, value - 2]),
      explain: `Perímetro é a soma de todos os lados: ${w} + ${w} + ${h} + ${h} = ${value} cm.`,
      visual: { kind: 'grid', w, h, modo: 'perimetro' },
      unidade: 'cm',
    };
  }

  if (modo === 'area') {
    const w = rnd(2, 5 + nivel);
    const h = rnd(2, 5 + nivel);
    const value = w * h;
    return {
      prompt: `Quantos quadradinhos de doce cobrem totalmente esta grade de ${w} por ${h}?`,
      value,
      opts: options(value, [2 * (w + h), w + h, value + w, value - h]),
      explain: `São ${h} linhas com ${w} quadradinhos cada uma: ${w} × ${h} = ${value} quadradinhos. Isso é a área.`,
      visual: { kind: 'grid', w, h, modo: 'area' },
      unidade: 'quadradinhos',
    };
  }

  if (modo === 'formula') {
    const w = rnd(3, 12);
    const h = rnd(3, 12);
    const value = w * h;
    return {
      prompt: `A bandeja retangular mede ${w} cm por ${h} cm. Qual é a área?`,
      value,
      opts: options(value, [2 * (w + h), w + h, value + 10, value - h]),
      explain: `Área do retângulo = base × altura = ${w} × ${h} = ${value} cm².`,
      unidade: 'cm²',
    };
  }

  const aresta = rnd(2, nivel < 2 ? 5 : 8);
  const value = aresta * aresta * aresta;
  return {
    prompt: `Uma caixa cúbica é montada com dadinhos de chocolate de 1 cm de aresta. Quantos dadinhos cabem dentro de uma caixa de aresta ${aresta} cm?`,
    value,
    opts: options(value, [aresta * aresta, aresta * 12, value + aresta, aresta * 3]),
    explain: `Volume do cubo = aresta × aresta × aresta = ${aresta}³ = ${value} cm³.`,
    visual: { kind: 'cube', aresta },
    unidade: 'cm³',
  };
}
