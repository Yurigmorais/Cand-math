/**
 * Geradores de contas e problemas de aritmética.
 * Cada função recebe (skill, grade) e devolve uma "peça bruta" de pergunta,
 * que o index.js transforma em pergunta final com alternativas embaralhadas.
 */
import { rnd, pick, chance, fmt, options, opcoesTexto, ramp, shuffle, CANDY_ICONS } from '../questionUtils.js';

const NOMES = ['Ana', 'Beto', 'Cauã', 'Duda', 'Elis', 'Fred', 'Gabi', 'Hugo', 'Iara', 'Jota', 'Kaique', 'Lia', 'Migael', 'Nina', 'Olívia', 'Pedro', 'Rui', 'Sofia', 'Téo', 'Vini'];
const DOCES = ['bombons', 'pirulitos', 'balas de goma', 'chocolates', 'brigadeiros', 'caramelos', 'gomas', 'cones de sorvete', 'cupcakes', 'biscoitos'];

/* ------------------------------------------------------------------ */
/* Contas de+, −, ×, ÷                                                 */
/* ------------------------------------------------------------------ */
export function arithmetic(skill, grade) {
  const nivel = ramp(skill, grade);
  const forcaExtra = (skill.cfg && skill.cfg.forca) ? skill.cfg.forca - 1 : 0;
  const forca = Math.max(0, Math.min(3, nivel + forcaExtra));
  const op = pick(skill.cfg.ops);

  let a, b, value, symbol, explain;

  if (op === 'add') {
    const limite = [10, 20, 100, 1000][forca];
    a = rnd(2, limite);
    b = rnd(2, limite);
    value = a + b;
    symbol = '+';
    explain = `${a} + ${b} = ${value}. Quando a gente junta ${a} com ${b}, sobra um total de ${value}.`;
  } else if (op === 'sub') {
    const limite = [10, 20, 100, 1000][forca];
    a = rnd(6, limite);
    b = rnd(1, a - 1);
    value = a - b;
    symbol = '−';
    explain = `${a} − ${b} = ${value}. Dos ${a}, tirando ${b}, ficam ${value}.`;
  } else if (op === 'mul') {
    if (forca === 0) { a = rnd(2, 5); b = rnd(2, 5); }
    else if (forca === 1) { a = rnd(2, 10); b = rnd(2, 10); }
    else if (forca === 2) { a = rnd(4, 12); b = rnd(6, 12); }
    else { a = rnd(12, 45); b = rnd(3, 9); }
    value = a * b;
    symbol = '×';
    explain = `${a} × ${b} = ${value}. É a soma de ${b} grupos com ${a} em cada grupo.`;
  } else {
    let baseA, baseB;
    if (forca === 0) { baseB = rnd(2, 5); baseA = rnd(2, 5); }
    else if (forca === 1) { baseB = rnd(2, 9); baseA = rnd(3, 9); }
    else if (forca === 2) { baseB = rnd(2, 12); baseA = rnd(4, 12); }
    else { baseB = rnd(3, 12); baseA = rnd(6, 15); }
    a = baseA * baseB;
    b = baseB;
    value = baseA;
    symbol = '÷';
    explain = `${a} ÷ ${b} = ${value}. Porque ${b} × ${value} = ${a}.`;
  }

  const eq = `${a} ${symbol} ${b}`;
  let distr;
  if (op === 'add') distr = [value + 1, value - 1, value + 10, value + (a % 10)];
  else if (op === 'sub') distr = [value + 1, value + 10, a - 1, value - 10 > 0 ? value - 10 : value + 2];
  else if (op === 'mul') distr = [a * (b + 1), a * (b - 1), value + a, value - b, value + 10];
  else distr = [value + 1, value - 1, b, a];

  return {
    eq,
    prompt: `Quanto é ${eq}?`,
    value,
    opts: options(value, distr),
    explain,
    op,
    icon: pick(CANDY_ICONS),
  };
}

/* ------------------------------------------------------------------ */
/* Contagem de doces na tela                                           */
/* ------------------------------------------------------------------ */
export function count(skill, grade) {
  const nivel = ramp(skill, grade);
  const grupos = nivel >= 2 ? rnd(3, 4) : rnd(1, 3);
  const porGrupo = [5, 10, 20, 30][nivel];
  const tamanho = [];
  let total = 0;
  for (let i = 0; i < grupos; i++) {
    const t = rnd(Math.max(2, porGrupo - 3), porGrupo + 3);
    tamanho.push(t);
    total += t;
  }
  const icon = pick(CANDY_ICONS);
  return {
    prompt: 'Conte todos os doces das bandejas e descubra o total.',
    value: total,
    opts: options(total, [total + 1, total - 1, total + 2, total + 5]),
    explain: `Tem ${tamanho.join(' + ')} = ${total} doces. Contar de um em um (ou agrupando) evita perder algum.`,
    visual: { kind: 'trays', icon, groups: tamanho },
    icon,
  };
}

/* ------------------------------------------------------------------ */
/* Sentido numérico: comparar, ordenar, reta, vizinhos, valor, etc.   */
/* ------------------------------------------------------------------ */
export function numberSense(skill, grade) {
  const nivel = ramp(skill, grade);
  const limite = [20, 100, 1000, 10000][nivel];
  const modo = skill.cfg.modo;

  if (modo === 'comparar') {
    let a = rnd(1, limite);
    let b = rnd(1, limite);
    if (a === b) b = Math.max(1, b - 1);
    const maior = Math.max(a, b);
    const qual = chance(0.5) ? 'maior' : 'menor';
    const value = qual === 'maior' ? maior : Math.min(a, b);
    const outro = a === value ? b : a;
    const distr = [outro, value + 1, value - 1, value + 2, value - 2, outro + 1, outro - 1]
      .filter(v => v > 0 && v !== value);
    return {
      prompt: `Qual número é o ${qual} entre ${fmt(a)} e ${fmt(b)}?`,
      value,
      opts: options(value, distr),
      explain: `${fmt(Math.max(a, b))} ${qual === 'maior' ? '>' : '<'} ${fmt(Math.min(a, b))}. Compare primeiro quantos algarismos cada um tem, depois da esquerda para a direita.`,
      visual: { kind: 'pairs', a, b },
    };
  }

  if (modo === 'ordenar') {
    const nums = [];
    while (nums.length < 4) {
      const n = rnd(1, limite);
      if (!nums.includes(n)) nums.push(n);
    }
    const crescente = chance(0.5);
    const ord = nums.slice().sort((x, y) => (crescente ? x - y : y - x));
    const linha = (arr) => arr.map(fmt).join(' — ');
    const resposta = linha(ord);

    // distratores: inversa, trocas vizinhas, rotações e embaralhadas
    const erradas = [];
    const push = (arr) => {
      const s = linha(arr);
      if (s && s !== resposta && !erradas.includes(s)) erradas.push(s);
    };
    push(ord.slice().reverse());
    push([ord[1], ord[0], ord[2], ord[3]]);
    push([ord[0], ord[2], ord[1], ord[3]]);
    push([ord[0], ord[1], ord[3], ord[2]]);
    push(ord.slice(1).concat(ord[0]));
    push(ord.slice(3).concat(ord.slice(0, 3)));
    let g = 0;
    while (erradas.length < 3 && g++ < 30) push(shuffle(ord));

    return {
      prompt: `Coloque estes números em ordem ${crescente ? 'crescente' : 'decrescente'}: ${nums.map(fmt).join(', ')}.`,
      value: resposta,
      opts: opcoesTexto(resposta, erradas),
      explain: `Na ordem ${crescente ? 'crescente' : 'decrescente'}: ${resposta}.`,
    };
  }

  if (modo === 'reta') {
    const passo = [1, 2, 5, 10][nivel];
    const inicio = rnd(0, Math.max(1, limite - passo * 6));
    const pos = rnd(0, 3);
    const value = inicio + passo * (pos + 1);
    const serie = [];
    for (let i = 0; i < 5; i++) serie.push(inicio + passo * i);
    return {
      prompt: 'A seta está apontando para qual número da reta?',
      value,
      opts: options(value, [value + passo, value - passo, value + 1, inicio]),
      explain: `A reta cresce de ${passo} em ${passo}: ${serie.join(', ')}. A seta cai em ${value}.`,
      visual: { kind: 'line', serie, marca: pos + 1 },
    };
  }

  if (modo === 'vizinhos') {
    const n = rnd(10, limite);
    const pede = pick(['antes', 'depois']);
    const value = pede === 'antes' ? n - 1 : n + 1;
    return {
      prompt: `Qual número vem logo ${pede} do ${fmt(n)}?`,
      value,
      opts: options(value, [n, pede === 'antes' ? n + 1 : n - 1, value + 10, value - 10]),
      explain: `${value} ${pede === 'antes' ? 'vem antes' : 'vem depois'} de ${fmt(n)}: é ${pede === 'antes' ? fmt(n) + ' − 1' : fmt(n) + ' + 1'}.`,
      visual: { kind: 'line', serie: [n - 1, n, n + 1], marca: 1 },
    };
  }

  if (modo === 'compor') {
    const casas = [2, 3, 4, 5][nivel];
    const digitos = [];
    for (let i = 0; i < casas; i++) digitos.push(i === 0 ? rnd(1, 9) : rnd(0, 9));
    // pelo menos duas casas diferentes de zero, senão a decomposição fica trivial
    if (digitos.slice(1).every(d => d === 0)) digitos[casas - 1] = rnd(1, 9);
    const valor = Number(digitos.join(''));
    const partes = digitos.map((d, i) => {
      const peso = Math.pow(10, casas - 1 - i);
      return d * peso;
    }).filter(p => p > 0);
    const resposta = partes.join(' + ');

    const erradas = [];
    const push = (arr) => {
      const s = arr.join(' + ');
      if (s && s !== resposta && !erradas.includes(s)) erradas.push(s);
    };
    push(partes.slice().reverse());            // ordem das casas trocada
    push(partes.slice(0, -1));                 // esqueceu a última casa
    push(partes.map(p => p + 1));              // somou 1 em cada parcela
    push(digitos.map(d => String(d)));         // usou o algarismo sozinho
    push(partes.map(p => p * 10));             // casas deslocadas
    push([partes[0] + partes[1], ...partes.slice(2)]); // juntou as duas primeiras
    let g = 0;
    while (erradas.length < 3 && g++ < 30) {
      const copia = partes.slice();
      copia[rnd(0, copia.length - 1)] += rnd(1, 9) * 10;
      push(copia);
    }

    return {
      prompt: `Qual é a forma decomposta do número ${fmt(valor)}?`,
      value: resposta,
      opts: opcoesTexto(resposta, erradas),
      explain: `${fmt(valor)} = ${resposta}. Cada algarismo vale o próprio valor multiplicado pela sua casa (unidade, dezena, centena...).`,
    };
  }

  if (modo === 'valor') {
    const casas = Math.max(3, 2 + nivel);
    const digitos = [];
    for (let i = 0; i < casas; i++) digitos.push(i === 0 ? rnd(1, 9) : rnd(0, 9));
    const valor = Number(digitos.join(''));
    const idx = rnd(0, casas - 1);
    const d = digitos[idx];
    const peso = Math.pow(10, casas - 1 - idx);
    const value = d * peso;
    const nomeCasa = ['unidade', 'dezena', 'centena', 'unidade de milhar', 'dezena de milhar'][casas - 1 - idx];
    if (d === 0) return numberSense(skill, grade);
    return {
      prompt: `No número ${fmt(valor)}, quanto vale o algarismo ${d}?`,
      value,
      opts: options(value, [d, d * 10, valor, d * (peso * 10)]),
      explain: `O ${d} está na ${nomeCasa}, então ele vale ${d} × ${fmt(peso)} = ${fmt(value)}.`,
    };
  }

  if (modo === 'arredondar') {
    const base = [10, 10, 100, 1000][nivel];
    const n = rnd(base * 2, base * 12);
    const value = Math.round(n / base) * base;
    return {
      prompt: `Arredonde ${fmt(n)} para a dezena${base === 1000 ? ' (na verdade a centena)' : ''} mais próxima.`,
      value,
      opts: options(value, [value + base, value - base, Math.floor(n / base) * base, n]),
      explain: `${fmt(n)} está mais perto de ${fmt(value)}: arredondando para a ${base === 1000 ? 'centena' : 'dezena'} mais próxima dá ${fmt(value)}.`,
    };
  }

  // lerGrande
  const casas = Math.max(4, 3 + nivel);
  const digitos = [];
  for (let i = 0; i < casas; i++) digitos.push(i === 0 ? rnd(1, 9) : rnd(0, 9));
  const valor = Number(digitos.join(''));
  const nome = porExtenso(valor);

  const erradas = [];
  const push = (s) => {
    const t = (s || '').trim();
    if (t && t !== nome && !erradas.includes(t)) erradas.push(t);
  };
  for (const v of shuffle([valor + rnd(100, 900), Math.floor(valor / 10) * 10, valor + rnd(1000, 9000),
                          valor - rnd(1, 9), valor + rnd(10, 90), Number(String(valor).split('').reverse().join(''))])) {
    if (v > 0 && v < 1e9) push(porExtenso(v));
  }
  push(nome.replace(' e ', ' '));
  let g = 0;
  while (erradas.length < 3 && g++ < 30) {
    const v = rnd(1, Math.max(20, valor * 3));
    if (v !== valor) push(porExtenso(v));
  }

  return {
    prompt: `Como se lê o número ${fmt(valor)}?`,
    value: nome,
    opts: opcoesTexto(nome, erradas),
    explain: `${fmt(valor)} lê-se "${nome}".`,
  };
}

/* lê um número inteiro até 9 dígitos em português (suficiente para o jogo) */
function porExtenso(n) {
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  function tres(nnn) {
    const c = Math.floor(nnn / 100);
    const r = nnn % 100;
    const partes = [];
    if (nnn === 100) partes.push('cem');
    else if (c > 0) partes.push(centenas[c]);
    if (r > 0) {
      if (r < 10) partes.push(unidades[r]);
      else if (r < 20) partes.push(especiais[r - 10]);
      else {
        const d = Math.floor(r / 10);
        const u = r % 10;
        partes.push(u === 0 ? dezenas[d] : `${dezenas[d]} e ${unidades[u]}`);
      }
    }
    return partes.join(' e ');
  }

  if (n === 0) return 'zero';
  const blocos = [];
  let restante = n;
  while (restante > 0) {
    blocos.push(restante % 1000);
    restante = Math.floor(restante / 1000);
  }
  const nomes = ['', 'mil', 'milhão', 'milhões', 'bilhão'];
  const saida = [];
  for (let i = blocos.length - 1; i >= 0; i--) {
    if (blocos[i] === 0) continue;
    if (i === 0) saida.push(tres(blocos[i]));
    else if (i === 1) saida.push(`${blocos[1] === 1 ? 'mil' : tres(blocos[1]) + ' mil'}`);
    else saida.push(`${tres(blocos[i])} ${nomes[i]}`);
  }
  return saida.join(' e ');
}

/* ------------------------------------------------------------------ */
/* Estimativa                                                          */
/* ------------------------------------------------------------------ */
export function estimate(skill, grade) {
  const nivel = ramp(skill, grade);
  const base = [10, 20, 50, 100][nivel];
  const exato = rnd(base, base * 6);
  const arred = Math.round(exato / base) * base;
  return {
    prompt: 'Um pote de doces caiu na mesa e ficou espalhado. Sem contar um por um: qual destes valores é a melhor estimativa?',
    value: arred,
    opts: options(arred, [arred + base, Math.max(base, arred - base), exato, arred * 2]),
    explain: `Aproximando para o múltiplo de ${base} mais perto, ${exato} fica em ${arred}. Estimativa é um cálculo rápido, não o valor exato.`,
    visual: { kind: 'scatter', total: exato },
  };
}

/* ------------------------------------------------------------------ */
/* Dobro, metade, triplo                                               */
/* ------------------------------------------------------------------ */
export function doubleHalf(skill, grade) {
  const nivel = ramp(skill, grade);
  const n = rnd(2, [10, 20, 40, 80][nivel]);
  const modo = pick(['dobro', 'metade', 'triplo']);
  if (modo === 'metade' && n % 2 !== 0) return doubleHalf(skill, grade);
  const value = modo === 'dobro' ? n * 2 : modo === 'triplo' ? n * 3 : n / 2;
  const icon = pick(CANDY_ICONS);
  return {
    prompt: `A Juju tem ${n} ${icon === 'fa-candy-cane' ? 'balas' : 'doces'} e quer calcular o ${modo}. Quanto dá?`,
    value,
    opts: options(value, [modo === 'metade' ? n * 2 : Math.floor(n / 2), n + value, value + 2, value + n]),
    explain: `O ${modo} de ${n} é ${value}. ${modo === 'dobro' ? 'Dobrar é somar o número com ele mesmo.' : modo === 'triplo' ? 'Triplicar é somar três vezes o mesmo número.' : 'A metade é dividir exatamente em duas partes iguais.'}`,
    visual: { kind: 'trays', icon, groups: modo === 'metade' ? [n / 2, n / 2] : Array(modo === 'dobro' ? 2 : 3).fill(n) },
  };
}

/* ------------------------------------------------------------------ */
/* Arranjo retangular (linhas × colunas)                               */
/* ------------------------------------------------------------------ */
export function array(skill, grade) {
  const nivel = ramp(skill, grade);
  const linhas = rnd(2, [4, 5, 6, 8][nivel]);
  const colunas = rnd(2, [4, 5, 6, 8][nivel]);
  const value = linhas * colunas;
  const icon = pick(CANDY_ICONS);
  return {
    prompt: `A bandeja de chocolates está montada em ${linhas} linhas com ${colunas} doces em cada linha. Quantos doces cabem na bandeja?`,
    value,
    opts: options(value, [linhas + colunas, value + colunas, value - linhas, (linhas + 1) * colunas]),
    explain: `${linhas} × ${colunas} = ${value}. Um arranjo retangular é multiplicação: linhas vezes colunas.`,
    visual: { kind: 'array', icon, rows: linhas, cols: colunas },
    icon,
  };
}

/* ------------------------------------------------------------------ */
/* Princípio multiplicativo de contagem                                */
/* ------------------------------------------------------------------ */
export function combination(skill, grade) {
  const nivel = ramp(skill, grade);
  const a = rnd(2, [3, 4, 5, 6][nivel]);
  const b = rnd(2, [3, 4, 5, 6][nivel]);
  const value = a * b;
  const itemA = pick(['casquinhas', 'caixinhas', 'saquinhos', 'velinhas']);
  const itemB = pick(['sabores', 'recheios', 'coberturas', 'enfeites']);
  return {
    prompt: `Na sorveteria da Juju há ${a} tipos de ${itemA} e ${b} ${itemB} diferentes. Quantas combinações de ${itemA} + ${itemB} são possíveis?`,
    value,
    opts: options(value, [a + b, value + a, Math.abs(a - b), value - b]),
    explain: `Para cada ${itemA} existem ${b} escolhas, então ${a} × ${b} = ${value} combinações. Isso é o princípio multiplicativo de contagem.`,
    visual: { kind: 'combo', a, b },
  };
}

/* ------------------------------------------------------------------ */
/* Divisão com resto                                                   */
/* ------------------------------------------------------------------ */
export function divRemainder(skill, grade) {
  const nivel = ramp(skill, grade);
  const divisor = rnd(2, [5, 6, 8, 9][nivel]);
  const quoc = rnd(3, [8, 9, 12, 15][nivel]);
  const resto = rnd(1, divisor - 1);
  const dividend = divisor * quoc + resto;
  const pede = chance(0.6) ? 'resto' : 'quoc';
  const value = pede === 'resto' ? resto : quoc;
  const icon = pick(CANDY_ICONS);
  return {
    prompt: `Dividindo ${dividend} ${icon.includes('ice') ? 'cones de sorvete' : 'doces'} igualmente entre ${divisor} crianças, sobram ${icon.includes('ice') ? 'cones' : 'doces'} na caixa. Qual é o ${pede}?`,
    value,
    opts: options(value, [pede === 'resto' ? quoc : resto, quoc + resto, dividend - divisor * quoc + 1, quoc - 1]),
    explain: `${dividend} ÷ ${divisor} = ${quoc} e sobra ${resto}, porque ${divisor} × ${quoc} = ${divisor * quoc} e ${dividend} − ${divisor * quoc} = ${resto}.`,
    visual: { kind: 'sharing', total: dividend, grupos: divisor, icon },
  };
}

/* ------------------------------------------------------------------ */
/* Múltiplos e divisores                                               */
/* ------------------------------------------------------------------ */
export function multiplesDivisors(skill) {
  const n = rnd(3, 18);
  const modo = pick(['multiplo', 'divisor']);
  if (modo === 'multiplo') {
    const value = n * rnd(3, 8);
    const distr = [];
    let k = 1;
    while (distr.length < 3 && k < 40) {
      const c = value + k;
      if (c % n !== 0 && c !== value) distr.push(c);
      k++;
    }
    return {
      prompt: `Qual destes números é múltiplo de ${n}?`,
      value,
      opts: options(value, distr),
      explain: `${value} ÷ ${n} = ${value / n}, deu exato — então ${value} é múltiplo de ${n}. Os outros deixam resto.`,
    };
  }
  const value = pick(divisores(n));
  const distr = [];
  let k = 2;
  while (distr.length < 3 && k < n + 8) {
    if (n % k !== 0) distr.push(k);
    k++;
  }
  return {
    prompt: `Qual destes números é divisor de ${n}?`,
    value,
    opts: options(value, distr),
    explain: `${n} ÷ ${value} = ${n / value}, divisão exata — então ${value} é divisor de ${n}.`,
  };
}

function divisores(n) {
  const d = [];
  for (let i = 2; i <= n; i++) if (n % i === 0) d.push(i);
  return d.length ? d : [n];
}

/* ------------------------------------------------------------------ */
/* Critérios de divisibilidade                                         */
/* ------------------------------------------------------------------ */
export function divisibility(skill) {
  const por = pick([2, 3, 5, 9, 10]);
  let value;
  if (por === 2) value = rnd(2, 90) * 2;
  else if (por === 5) value = rnd(2, 40) * 5;
  else if (por === 10) value = rnd(2, 20) * 10;
  else if (por === 3) value = rnd(2, 30) * 3;
  else value = rnd(2, 12) * 9;

  const distr = [];
  let guard = 0;
  while (distr.length < 3 && guard++ < 100) {
    const c = rnd(2, 120);
    if (c % por !== 0 && c !== value && !distr.includes(c)) distr.push(c);
  }
  const regra = {
    2: 'terminar em 0, 2, 4, 6 ou 8 (ser par)',
    3: 'a soma dos algarismos ser múltiplo de 3',
    5: 'terminar em 0 ou 5',
    9: 'a soma dos algarismos ser múltiplo de 9',
    10: 'terminar em 0',
  }[por];
  const soma = String(value).split('').reduce((s, d) => s + Number(d), 0);
  return {
    prompt: `Qual destes números é divisível por ${por}?`,
    value,
    opts: options(value, distr),
    explain: `${value} é divisível por ${por} porque ${regra}${(por === 3 || por === 9) ? ` (e ${value} soma ${soma})` : ''}.`,
  };
}

/* ------------------------------------------------------------------ */
/* Probleminhas contextualizados                                       */
/* ------------------------------------------------------------------ */
export function wordProblem(skill, grade) {
  const nivel = ramp(skill, grade);
  const limite = [10, 20, 100, 500][nivel];
  const tipo = skill.cfg.tipo || pick(['juntar', 'tirar', 'comparar', 'repartir']);
  const nome = pick(NOMES);
  const doce = pick(DOCES);
  const nome2 = pick(NOMES.filter(n => n !== nome));

  if (tipo === 'juntar') {
    const a = rnd(2, limite);
    const b = rnd(2, limite);
    const value = a + b;
    return {
      prompt: `${nome} tinha ${a} ${doce} e ganhou mais ${b} de aniversário. Com quantos ${doce} ${nome} ficou?`,
      value,
      opts: options(value, [Math.abs(a - b), value + 2, a * b]),
      explain: `É caso de juntar: ${a} + ${b} = ${value} ${doce}.`,
      icon: pick(CANDY_ICONS),
    };
  }
  if (tipo === 'tirar') {
    const a = rnd(6, limite);
    const b = rnd(1, a - 1);
    const value = a - b;
    return {
      prompt: `${nome} tinha ${a} ${doce} e comeu ${b} antes do recreio. Quantos ${doce} sobraram?`,
      value,
      opts: options(value, [a + b, value + 1, b]),
      explain: `Sobra quando tiramos: ${a} − ${b} = ${value} ${doce}.`,
      icon: pick(CANDY_ICONS),
    };
  }
  if (tipo === 'comparar') {
    const a = rnd(5, limite);
    const b = rnd(1, a);
    const value = a - b;
    return {
      prompt: `${nome} tem ${a} ${doce} e ${nome2} tem ${b}. Quantos ${doce} ${nome} tem a mais que ${nome2}?`,
      value,
      opts: options(value, [a + b, value + 2, b]),
      explain: `Comparar é achar a diferença: ${a} − ${b} = ${value} ${doce} a mais.`,
      icon: pick(CANDY_ICONS),
    };
  }
  const grupos = rnd(2, [5, 6, 9, 10][nivel]);
  const por = rnd(2, [5, 8, 10, 12][nivel]);
  const total = grupos * por;
  return {
    prompt: `${nome} dividiu ${total} ${doce} igualmente em ${grupos} saquinhos para a festa. Quantos ${doce} ficaram em cada saquinho?`,
    value: por,
    opts: options(por, [grupos, total - grupos, por + grupos]),
    explain: `Repartir igualmente é divisão: ${total} ÷ ${grupos} = ${por} ${doce} em cada saquinho.`,
    visual: { kind: 'sharing', total, grupos, icon: pick(CANDY_ICONS) },
  };
}

/* ------------------------------------------------------------------ */
/* Número que falta / igualdade simples                                */
/* ------------------------------------------------------------------ */
export function missingNumber(skill, grade) {
  const nivel = ramp(skill, grade);
  const limite = [10, 20, 50, 100][nivel];
  const modo = skill.cfg.modo || 'oculto';

  if (modo === 'complemento') {
    const total = rnd(6, limite);
    const parte = rnd(1, total - 1);
    const value = total - parte;
    return {
      prompt: `${parte} + ⬜ = ${total}. Qual número está escondido no quadrado?`,
      value,
      opts: options(value, [total, parte + 1, value + 2, total - parte + 1]),
      explain: `Para achar o que falta, subtraia: ${total} − ${parte} = ${value}.`,
      eq: `${parte} + ⬜ = ${total}`,
    };
  }

  const op = pick(['+', '−']);
  const b = rnd(2, limite);
  const value = rnd(2, limite);
  const total = op === '+' ? value + b : Math.max(value, value + b);
  const a = op === '+' ? value : total;
  const falta = op === '+' ? `⬜ ${op} ${b} = ${total}` : `${total} ${op} ⬜ = ${a}`;
  const resposta = op === '+' ? value : total - a;
  return {
    prompt: `Descubra o número escondido: ${falta}`,
    value: resposta,
    opts: options(resposta, [resposta + 1, resposta - 1 > 0 ? resposta - 1 : resposta + 2, b, total]),
    explain: `Faça a operação inversa: ${op === '+' ? `${total} − ${b} = ${resposta}` : `${total} − ${a} = ${resposta}`}.`,
    eq: falta,
  };
}
