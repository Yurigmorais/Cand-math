/**
 * Geradores da unidade Álgebra: padrões, sequências, balança da igualdade,
 * expressões com letra, potências e raízes.
 */
import { rnd, pick, chance, fmt, options, ramp, CANDY_ICONS } from '../questionUtils.js';

/* ------------------------------------------------------------------ */
/* Sequências e padrões                                                */
/* ------------------------------------------------------------------ */
export function sequence(skill, grade) {
  const nivel = ramp(skill, grade);
  const estilo = nivel < 1 ? pick(['soma1', 'soma2']) : nivel === 1 ? pick(['soma1', 'soma2', 'soma5', 'volta']) : pick(['soma', 'multiplica', 'dobroMais', 'cresceMais']);

  let termos = [];
  let regra = '';
  let prox = 0;

  if (estilo === 'soma1' || estilo === 'soma2' || estilo === 'soma5' || estilo === 'soma') {
    const passo = { soma1: 1, soma2: 2, soma5: 5, soma: rnd(3, 10) }[estilo];
    const inicio = rnd(0, 10);
    termos = [0, 1, 2, 3].map(i => inicio + i * passo);
    prox = inicio + 4 * passo;
    regra = `de ${passo} em ${passo}`;
  } else if (estilo === 'volta') {
    const passo = rnd(2, 5);
    const inicio = passo * 5;
    termos = [0, 1, 2, 3].map(i => inicio - i * passo);
    prox = inicio - 4 * passo;
    regra = `diminuindo ${passo}`;
  } else if (estilo === 'multiplica') {
    const base = rnd(2, 3);
    termos = [1, base, base * base, base ** 3];
    prox = base ** 4;
    regra = `multiplicando por ${base}`;
  } else if (estilo === 'dobroMais') {
    const inicio = rnd(1, 5);
    termos = [inicio];
    for (let i = 0; i < 3; i++) termos.push(termos[i] * 2 + 1);
    prox = termos[3] * 2 + 1;
    regra = 'dobrando e somando 1';
  } else {
    let v = rnd(1, 5);
    let add = rnd(1, 4);
    termos = [];
    for (let i = 0; i < 4; i++) { termos.push(v); v += add; add += 1; }
    prox = v;
    regra = 'a cada passo a diferença aumenta 1';
  }

  const icone = pick(CANDY_ICONS);
  return {
    prompt: `Complete a sequência de doces: ${termos.join(', ') }, ⬜`,
    value: prox,
    opts: options(prox, [prox + 1, prox - 1, prox + 2, termos[3] + termos[2]]),
    explain: `O padrão é ${regra}. Depois de ${termos[3]} vem ${prox}.`,
    visual: { kind: 'sequence', termos, icone },
  };
}

/* ------------------------------------------------------------------ */
/* Balança da igualdade                                                */
/* ------------------------------------------------------------------ */
export function balance(skill, grade) {
  const nivel = ramp(skill, grade);
  const modo = skill.cfg && skill.cfg.modo === 'igualdade' ? 'igualdade' : 'balanca';

  if (modo === 'balanca') {
    const limite = [10, 20, 50, 100][nivel];
    const conhecido = rnd(2, limite);
    const value = rnd(2, limite);
    const total = conhecido + value;
    return {
      prompt: `A balança está em equilíbrio. De um lado há ${conhecido} bombons e uma sacola escondida; do outro há ${total} bombons. Quantos bombons têm dentro da sacola?`,
      value,
      opts: options(value, [total, conhecido, value + 2, total - conhecido + 1]),
      explain: `Equilíbrio quer dizer igualdade: ${conhecido} + ⬜ = ${total}, então ⬜ = ${total} − ${conhecido} = ${value}.`,
      visual: { kind: 'balance', esquerda: conhecido, saco: true, direita: total },
    };
  }

  const a = rnd(2, 12);
  const b = rnd(2, 12);
  const c = rnd(2, 10);
  const soma = a + b;
  const value = soma - c;
  return {
    prompt: `Se ${a} + ${b} = ${soma}, então ${soma} − ${c} = ⬜. Qual número completa a frase?`,
    value,
    opts: options(value, [soma + c, c - soma > 0 ? c - soma : value + c, a + b + c, value + 1]),
    explain: `Fazer a operação inversa mantém a igualdade: ${soma} − ${c} = ${value}.`,
    visual: { kind: 'balance', esquerda: soma, direita: null, sub: c },
  };
}

/* ------------------------------------------------------------------ */
/* Expressões algébricas                                               */
/* ------------------------------------------------------------------ */
export function expression(skill, grade) {
  const nivel = ramp(skill, grade);
  const modo = skill.cfg.modo;

  if (modo === 'valor') {
    const x = rnd(2, 12);
    const a = rnd(2, 9);
    const b = rnd(1, 20);
    const op = pick(['+', '−']);
    const value = op === '+' ? a * x + b : a * x - b;
    if (value < 0) return expression(skill, grade);
    const expr = op === '+' ? `${a}x + ${b}` : `${a}x − ${b}`;
    return {
      prompt: `Calcule o valor numérico de ${expr} quando x = ${x}.`,
      value,
      opts: options(value, [a * x, value + b, (a + b) * x, value - a]),
      explain: `Substitua a letra: ${a} × ${x} = ${a * x}, depois ${op === '+' ? 'some' : 'subtraia'} ${b} → ${value}.`,
      visual: { kind: 'formula', expr, x },
    };
  }

  // equação do 1º grau  ax + b = c
  const a = rnd(2, nivel < 2 ? 5 : 9);
  const x = rnd(2, nivel < 2 ? 9 : 15);
  const b = rnd(1, 20);
  const c = a * x + b;
  return {
    prompt: `Resolva a equação: ${a}x + ${b} = ${c}. Qual é o valor de x?`,
    value: x,
    opts: options(x, [c - b, (c + b) / a, x + 1, Math.round(c / a)]),
    explain: `Passe o ${b} para o outro lado subtraindo: ${a}x = ${c} − ${b} = ${c - b}. Depois divida por ${a}: x = ${x}.`,
    visual: { kind: 'formula', expr: `${a}x + ${b} = ${c}`, x: null },
  };
}

/* ------------------------------------------------------------------ */
/* Potências e raízes                                                  */
/* ------------------------------------------------------------------ */
export function powerRoot(skill, grade) {
  const modo = skill.cfg.modo;

  if (modo === 'potencia') {
    const base = pick([2, 3, 4, 5, 6, 10]);
    const expo = base === 10 ? rnd(2, 5) : rnd(2, base <= 3 ? 4 : 3);
    const value = Math.pow(base, expo);
    return {
      prompt: `Quanto é ${base} elevado a ${expo}?`,
      value,
      opts: options(value, [base * expo, Math.pow(base, expo + 1), Math.pow(base, expo - 1), value + base]),
      explain: `${base}^${expo} significa multiplicar ${base} por ele mesmo ${expo} vezes: ${Array(expo).fill(base).join(' × ')} = ${value}.`,
      visual: { kind: 'formula', expr: `${base}^${expo}` },
    };
  }

  const raiz = rnd(3, 15);
  const value = raiz;
  const quadrado = raiz * raiz;
  return {
    prompt: `Qual número multiplicado por ele mesmo dá ${quadrado}? (raiz quadrada de ${quadrado})`,
    value,
    opts: options(value, [quadrado / 2, value + 1, value - 1, Math.floor(quadrado / 4)]),
    explain: `${value} × ${value} = ${quadrado}, então √${quadrado} = ${value}. Raiz é a operação inversa da potência.`,
    visual: { kind: 'formula', expr: `√${quadrado}` },
  };
}
