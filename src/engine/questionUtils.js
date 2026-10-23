/**
 * Utilitários usados pelos geradores de pergunta.
 * Nada aqui conhece o DOM — é lógica pura, fácil de testar.
 */

export function rnd(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function chance(p) {
  return Math.random() < p;
}

/** 1.234.567 no padrão brasileiro */
export function fmt(n) {
  if (typeof n !== 'number' || !isFinite(n)) return String(n);
  return n.toLocaleString('pt-BR');
}

/** 1,50 vira "R$ 1,50" */
export function money(n) {
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** fração escrita como a criança vê no caderno */
export function frac(n, d) {
  return `${n}/${d}`;
}

/**
 * Monta as 4 alternativas a partir da resposta correta e de distratores
 * pensados para os erros mais comuns (adianta 1, esquece o reserva, etc).
 * Distratores repetidos ou iguais à resposta são descartados e completados
 * com valores próximos, para a pergunta nunca quebrar.
 */
export function options(correct, distractors, format) {
  const fmtv = format || (v => String(v));
  const answerText = fmtv(correct);
  const seen = new Set([answerText]);
  const list = [answerText];

  for (const d of distractors) {
    if (list.length === 4) break;
    const t = fmtv(d);
    if (!seen.has(t)) { seen.add(t); list.push(t); }
  }

  // completa com vizinhos da resposta se ainda faltarem alternativas
  let step = 1;
  let guard = 0;
  while (list.length < 4 && guard++ < 60) {
    const base = typeof correct === 'number' ? correct : Number(String(correct).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.'));
    if (!isFinite(base)) break;
    const candidate = step % 2 === 1 ? base + step : base - step;
    step++;
    if (candidate < 0) continue;
    const t = fmtv(Math.round(candidate * 100) / 100);
    if (!seen.has(t)) { seen.add(t); list.push(t); }
  }

  const shuffled = shuffle(list);
  return {
    options: shuffled.map(fmtv),
    answer: shuffled.indexOf(answerText),
    answerText,
  };
}

/**
 * Versão para respostas em TEXTO (ordem de números, forma decomposta,
 * número por extenso). Tira as duplicadas e completa até 4 alternativas;
 * se não der, devolve o que tem e o motor tenta de novo outra pergunta.
 */
export function opcoesTexto(correta, candidatas) {
  const visto = new Set();
  const lista = [];
  const push = (v) => {
    const t = String(v == null ? '' : v).trim();
    if (!t || visto.has(t)) return false;
    visto.add(t); lista.push(t);
    return true;
  };
  push(correta);
  for (const c of shuffle(candidatas || [])) {
    if (lista.length >= 4) break;
    push(c);
  }
  const misturadas = shuffle(lista);
  return {
    options: misturadas,
    answer: misturadas.indexOf(String(correta).trim()),
    answerText: String(correta).trim(),
  };
}

/** nível 0..3 dentro da faixa de anos da habilidade */
export function ramp(skill, grade) {
  const [min, max] = skill.grades;
  if (max <= min) return 0;
  return Math.max(0, Math.min(3, Math.round(((grade - min) / (max - min)) * 3)));
}

export const CANDY_ICONS = [
  'fa-candy-cane', 'fa-cookie-bite', 'fa-cookie', 'fa-ice-cream',
  'fa-cake-candles', 'fa-gift', 'fa-star', 'fa-heart',
];
