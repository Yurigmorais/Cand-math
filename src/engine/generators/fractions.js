/**
 * Geradores de frações, decimais, dinheiro, porcentagem e proporção.
 */
import { rnd, pick, chance, fmt, money, frac, options, ramp, CANDY_ICONS } from '../questionUtils.js';

const PRODUTOS = [
  ['bombom', 3.5], ['pirulito', 2], ['barra de chocolate', 6.5], ['copo de sorvete', 8],
  ['caixa de balas', 12.5], ['cupcake', 7], ['biscoito recheado', 4.5], ['caramelo', 1.5],
];

/* ------------------------------------------------------------------ */
/* Frações                                                             */
/* ------------------------------------------------------------------ */
export function fraction(skill, grade) {
  const nivel = ramp(skill, grade);
  const modo = skill.cfg.modo;

  if (modo === 'visual') {
    const partes = pick(nivel < 2 ? [2, 4, 6, 8] : [3, 4, 5, 6, 8, 10, 12]);
    const pintadas = rnd(1, partes - 1);
    const resposta = frac(pintadas, partes);
    const distr = [
      frac(partes - pintadas, partes),
      frac(pintadas, partes + 1),
      frac(pintadas + 1 > partes ? pintadas - 1 : pintadas + 1, partes),
      frac(pintadas, partes * 2),
    ];
    return {
      prompt: 'O bolo da Juju foi cortado em partes iguais. Que fração do bolo está coberta de morango?',
      value: resposta,
      opts: options(resposta, distr, v => v),
      explain: `${pintadas} de ${partes} partes estão pintadas, então a fração é ${resposta}: o número de baixo diz em quantas partes dividimos, o de cima quantas pegamos.`,
      visual: { kind: 'fraction', parts: partes, shaded: pintadas },
    };
  }

  if (modo === 'quantidade') {
    const base = pick([2, 4, 5, 10]);
    const num = rnd(1, base - 1);
    const total = base * rnd(2, [5, 6, 8, 10][nivel]);
    const value = (total / base) * num;
    const icon = pick(CANDY_ICONS);
    return {
      prompt: `Quanto é ${frac(num, base)} de ${total} ${icon === 'fa-ice-cream' ? 'sorvetes' : 'doces'}?`,
      value,
      opts: options(value, [total / base, total - value, value + base, Math.round(value / 2)]),
      explain: `Divida ${total} por ${base} para achar ${frac(1, base)} (dá ${total / base}) e multiplique por ${num}: ${total / base} × ${num} = ${value}.`,
      visual: { kind: 'sharing', total, grupos: base, icon },
    };
  }

  if (modo === 'equivalente') {
    const pares = [[1, 2], [2, 3], [3, 4], [1, 3], [1, 5], [3, 5], [2, 5], [5, 6]];
    const [n, d] = pick(pares);
    const k = rnd(2, nivel < 2 ? 4 : 6);
    const value = n * k;
    return {
      prompt: `Para a fração ${frac(n, d)} ser equivalente a ${frac('?', d * k)}, qual número falta no lugar do ponto de interrogação?`,
      value,
      opts: options(value, [d * k, n + k, value + 1, value - k > 0 ? value - k : value + k]),
      explain: `Multiplicamos em cima e em baixo pelo mesmo número: ${n} × ${k} = ${value} e ${d} × ${k} = ${d * k}. Então ${frac(n, d)} = ${frac(value, d * k)}.`,
      visual: { kind: 'pairFrac', a: [n, d], b: [null, d * k] },
    };
  }

  if (modo === 'comparar') {
    const [d1, d2] = pick([[2, 4], [2, 3], [3, 4], [1, 2], [2, 5], [3, 5], [4, 6], [1, 3]]);
    let n1 = rnd(1, d1 - 1);
    let n2 = rnd(1, d2 - 1);
    if (n1 / d1 === n2 / d2) n2 = n2 === 1 ? 2 : n2 - 1;
    if (n2 <= 0) return fraction(skill, grade);
    const maior = n1 / d1 > n2 / d2 ? frac(n1, d1) : frac(n2, d2);
    return {
      prompt: `Qual fatia é maior: ${frac(n1, d1)} do bolo ou ${frac(n2, d2)} do bolo?`,
      value: maior,
      opts: options(maior, [maior === frac(n1, d1) ? frac(n2, d2) : frac(n1, d1), 'São iguais', frac(n1 + n2, d1 + d2)], v => v),
      explain: `${frac(n1, d1)} vale ${(n1 / d1).toFixed(2).replace('.', ',')} e ${frac(n2, d2)} vale ${(n2 / d2).toFixed(2).replace('.', ',')}. Convertendo para a mesma base dá para comparar de verdade.`,
      visual: { kind: 'compareFrac', a: [n1, d1], b: [n2, d2] },
    };
  }

  // somar (mesmo denominador ou simples)
  const mesmoDenom = chance(0.6);
  if (mesmoDenom) {
    const d = pick([2, 4, 5, 6, 8, 10]);
    const a = rnd(1, d - 2);
    const b = rnd(1, d - 1 - a);
    const value = a + b;
    return {
      prompt: `Quanto é ${frac(a, d)} + ${frac(b, d)}? (deixe o denominador igual)`,
      value: frac(value, d),
      opts: options(frac(value, d), [frac(value, d * 2), frac(a * b, d), frac(value + 1, d), frac(value, d + 1)], v => v),
      explain: `Com o mesmo denominador, somamos só os de cima: ${a} + ${b} = ${value}, então ${frac(a, d)} + ${frac(b, d)} = ${frac(value, d)}.`,
      visual: { kind: 'addFrac', a, b, d },
    };
  }
  const d1 = 2, d2 = pick([4, 6, 8]);
  const n1 = rnd(1, d1 - 1);
  const n2 = rnd(1, d2 - 1);
  const num = n1 * d2 + n2 * d1;
  const g = (a, b) => b === 0 ? a : g(b, a % b);
  const mdc = g(num, d1 * d2) || 1;
  const rn = num / mdc, rd = (d1 * d2) / mdc;
  const resposta = rd === 1 ? String(rn) : frac(rn, rd);
  return {
    prompt: `Quanto é ${frac(n1, d1)} + ${frac(n2, d2)}?`,
    value: resposta,
    opts: options(resposta, [frac(n1 + n2, d1 + d2), frac(num, d1 * d2), frac(n1 + n2, d2), '1'], v => v),
    explain: `Tire um denominador comum: ${frac(n1, d1)} = ${frac(n1 * d2, d1 * d2)} e ${frac(n2, d2)} = ${frac(n2 * d1, d1 * d2)}. Somando dá ${frac(num, d1 * d2)}${mdc > 1 ? `, que simplificada vira ${resposta}` : ''}.`,
    visual: { kind: 'addFrac', a: n1, b: n2, d: d1, d2 },
  };
}

/* ------------------------------------------------------------------ */
/* Decimais                                                            */
/* ------------------------------------------------------------------ */
export function decimal(skill, grade) {
  const nivel = ramp(skill, grade);
  const modo = skill.cfg.modo;

  if (modo === 'ler') {
    const inteiro = rnd(1, nivel < 2 ? 9 : 99);
    const cent = rnd(1, 99);
    const valor = Number(`${inteiro}.${String(cent).padStart(2, '0')}`);
    const certo = `${fmt(inteiro)},${String(cent).padStart(2, '0')}`;
    const errado1 = `${fmt(inteiro)},${String(cent).padStart(2, '0').split('').reverse().join('')}`;
    const errado2 = `${fmt(inteiro * 10)},${cent < 10 ? '0' + cent : cent}`;
    return {
      prompt: `A etiqueta do pote diz: ${inteiro} inteiros e ${cent} centésimos. Como se escreve isso em número decimal?`,
      value: certo,
      opts: options(certo, [errado1, errado2, `${fmt(inteiro)}.${cent}`].map(t => t.replace('.', ',')), v => v),
      explain: `${inteiro} inteiros e ${cent} centésimos se escreve ${certo}. A vírgula separa a parte inteira da parte fracionária.`,
      visual: { kind: 'decimalBar', inteiros: inteiro, dec: cent / 100 },
    };
  }

  if (modo === 'comparar') {
    const a = rnd(1, 9) + rnd(1, 99) / 100;
    let b = rnd(1, 9) + rnd(1, 99) / 100;
    if (a === b) b += 0.1;
    const qual = chance(0.5) ? 'maior' : 'menor';
    const value = qual === 'maior' ? Math.max(a, b) : Math.min(a, b);
    const txt = v => v.toFixed(2).replace('.', ',');
    return {
      prompt: `Compare os preços dos dois doces. Qual valor é o ${qual}: ${txt(a)} ou ${txt(b)}?`,
      value: txt(value),
      opts: options(txt(value), [txt(qual === 'maior' ? b : a), txt(value + 0.1), txt(Math.max(0, value - 0.1))], v => v),
      explain: `Compare a parte inteira primeiro; se empata, olhe os décimos e depois os centésimos. Assim ${txt(a)} e ${txt(b)} deixam de parecer parecidos.`,
    };
  }

  const limite = [10, 20, 50, 100][nivel];
  const op = pick(['+', '−']);
  let a = rnd(1, limite) + rnd(1, 99) / 100;
  let b = rnd(1, Math.max(2, limite / 2)) + rnd(1, 99) / 100;
  if (op === '−' && b > a) [a, b] = [b, a];
  const value = op === '+' ? a + b : a - b;
  const txt = v => (Math.round(v * 100) / 100).toFixed(2).replace('.', ',');
  return {
    prompt: `Quanto é ${txt(a)} ${op} ${txt(b)}?`,
    value: txt(value),
    opts: options(txt(value), [txt(value + 0.1), txt(Math.max(0, value - 0.1)), txt(value + 1), txt(value * 2)], v => v),
    explain: `Alinhe as vírgulas e calcule como se fossem números inteiros: ${txt(a)} ${op} ${txt(b)} = ${txt(value)}.`,
    eq: `${txt(a)} ${op} ${txt(b)}`,
  };
}

/* ------------------------------------------------------------------ */
/* Dinheiro (sistema monetário brasileiro)                             */
/* ------------------------------------------------------------------ */
export function moneyMaker(skill, grade) {
  const nivel = ramp(skill, grade);
  const notas = [100, 50, 20, 10, 5, 2, 1];
  const moedas = [1, 0.5, 0.25, 0.1];
  const modo = skill.cfg.modo;

  if (modo === 'total') {
    const qtdNotas = rnd(2, nivel < 2 ? 3 : 5);
    const cart = [];
    for (let i = 0; i < qtdNotas; i++) cart.push(pick(notas.filter(n => n <= (nivel < 2 ? 20 : 100))));
    if (nivel >= 1) cart.push(pick(moedas));
    const value = cart.reduce((s, n) => s + n, 0);
    return {
      prompt: 'A Juju esvaziou o cofre na mesa. Quanto tem no total?',
      value: money(value),
      opts: options(money(value), [money(value + 5), money(Math.max(0.1, value - 10)), money(value * 2)], money),
      explain: `Somando de cima para baixo: ${cart.map(money).join(' + ')} = ${money(value)}.`,
      visual: { kind: 'money', itens: cart },
    };
  }

  const [produto, base] = pick(PRODUTOS);
  const preco = Math.round((base + rnd(0, nivel < 2 ? 3 : 12)) * 100) / 100;
  const pagoPick = notas.concat([200]).filter(n => n > preco);
  const pago = pagoPick.length ? pick(pagoPick) : 100;
  const troco = Math.round((pago - preco) * 100) / 100;
  return {
    prompt: `${produto.charAt(0).toUpperCase() + produto.slice(1)} custa ${money(preco)}. Se a criança pagar com uma nota de ${money(pago)}, quanto recebe de troco?`,
    value: money(troco),
    opts: options(money(troco), [money(pago + preco), money(Math.max(0, troco - 1)), money(troco + 10)], money),
    explain: `Troco é o que sobra: ${money(pago)} − ${money(preco)} = ${money(troco)}.`,
    visual: { kind: 'receipt', preco, pago, troco },
  };
}

/* ------------------------------------------------------------------ */
/* Porcentagem                                                         */
/* ------------------------------------------------------------------ */
export function percent(skill, grade) {
  const nivel = ramp(skill, grade);
  const modo = skill.cfg.modo;

  if (modo === 'usual') {
    const pct = pick([10, 25, 50, 75, 100]);
    const total = pct === 25 || pct === 75 ? rnd(1, 8) * 4 * (nivel < 2 ? 5 : 10) : rnd(2, 10) * 10;
    const value = total * pct / 100;
    return {
      prompt: `A vitrine tem ${total} doces e ${pct}% deles são de chocolate. Quantos são de chocolate?`,
      value,
      opts: options(value, [total - value, total / pct, value * 2, pct]),
      explain: `${pct}% significa ${pct} de cada 100. Aqui: ${total} × ${pct} ÷ 100 = ${value}.`,
      visual: { kind: 'percentGrid', pct },
    };
  }

  if (modo === 'calculo') {
    const pct = pick([5, 10, 15, 20, 25, 30, 40, 60]);
    const total = rnd(2, 20) * 10;
    const value = Math.round(total * pct / 100 * 100) / 100;
    return {
      prompt: `Quanto é ${pct}% de ${fmt(total)}?`,
      value,
      opts: options(value, [total - value, value + pct, total / pct, value / 2]),
      explain: `Calcule 1% (${total} ÷ 100 = ${total / 100}) e multiplique por ${pct}: ${total / 100} × ${pct} = ${value}.`,
    };
  }

  // mudança (aumento / desconto)
  const precoBase = rnd(2, nivel < 2 ? 8 : 20) * 5;
  const pct = pick([10, 20, 25, 30, 40, 50]);
  const alta = chance(0.4);
  const delta = precoBase * pct / 100;
  const value = Math.round((alta ? precoBase + delta : precoBase - delta) * 100) / 100;
  return {
    prompt: `O carrinho de doces custava ${money(precoBase)} e mudou de preço: ${alta ? 'aumento' : 'desconto'} de ${pct}%. Por quanto fica?`,
    value: money(value),
    opts: options(money(value), [money(precoBase + delta), money(Math.abs(precoBase - delta)), money(delta), money(precoBase)], money),
    explain: `${pct}% de ${money(precoBase)} é ${money(delta)}. ${alta ? `Aumentando: ${money(precoBase)} + ${money(delta)} = ` : `Descontando: ${money(precoBase)} − ${money(delta)} = `}${money(value)}.`,
    visual: { kind: 'tag', preco: precoBase, pct, alta },
  };
}

/* ------------------------------------------------------------------ */
/* Razão, proporção e escala                                           */
/* ------------------------------------------------------------------ */
export function ratio(skill, grade) {
  const nivel = ramp(skill, grade);
  const tipo = pick(['receita', 'escala', 'velocidade', 'partilha']);

  if (tipo === 'receita') {
    const k = rnd(2, 5);
    const xicaras = rnd(1, 4) * k;
    const bolos = rnd(2, 6) * k;
    const novosBolos = bolos * rnd(2, 4);
    const value = xicaras * (novosBolos / bolos);
    return {
      prompt: `A receita da confeitaria usa ${xicaras} xícaras de açúcar para ${bolos} bolos. Mantendo a mesma proporção, quantas xícaras são necessárias para ${novosBolos} bolos?`,
      value,
      opts: options(value, [value + k, xicaras + novosBolos - bolos, Math.max(1, value - k), novosBolos]),
      explain: `A razão é ${xicaras}:${bolos}. Multiplicando os dois lados por ${novosBolos / bolos}, ${xicaras} × ${(novosBolos / bolos)} = ${value} xícaras.`,
    };
  }

  if (tipo === 'escala') {
    const escala = pick([100, 200, 500, 1000]);
    const noMapa = rnd(2, 12);
    const value = noMapa * escala / 100; // em metros
    return {
      prompt: `O mapa da cidade está na escala 1:${escala}. Se dois pontos ficam a ${noMapa} cm no mapa, qual a distância real em metros?`,
      value,
      opts: options(value, [noMapa * escala, value / 10, value * 10, noMapa + escala / 100]),
      explain: `Escala 1:${escala} quer dizer ${escala} cm reais por 1 cm do mapa: ${noMapa} × ${escala} = ${noMapa * escala} cm, ou ${value} m.`,
    };
  }

  if (tipo === 'velocidade') {
    const km = rnd(2, 12) * 10;
    const h = rnd(2, 5);
    const value = Math.round((km / h) * 10) / 10;
    return {
      prompt: `A van da Juju percorreu ${fmt(km)} km em ${h} horas, sempre na mesma velocidade. Quantos quilômetros por hora ela fez?`,
      value,
      opts: options(value, [km - h, value * h, km / (h + 1), value + 10]),
      explain: `Velocidade é razão entre duas grandezas diferentes: ${km} km ÷ ${h} h = ${value} km/h.`,
    };
  }

  const [r1, r2] = pick([[1, 2], [2, 3], [3, 5], [2, 5], [1, 3]]);
  const unidade = rnd(2, [8, 10, 12, 15][nivel]);
  const total = (r1 + r2) * unidade;
  const value = r2 * unidade;
  return {
    prompt: `${fmt(total)} doces serão divididos entre duas turmas na razão ${r1}:${r2}. Quantos doces ficam com a turma que recebe mais?`,
    value,
    opts: options(value, [r1 * unidade, total - value, total / (r1 + r2), Math.round(total / 2)]),
    explain: `A soma das partes é ${r1} + ${r2} = ${r1 + r2}. Uma parte vale ${total} ÷ ${r1 + r2} = ${unidade}, então a maior fica com ${r2} × ${unidade} = ${value}.`,
    visual: { kind: 'sharing', total, grupos: r1 + r2, icon: 'fa-candy-cane' },
  };
}
