/**
 * Registro dos geradores e montagem da pergunta final.
 *
 * Toda pergunta que sai daqui tem o mesmo formato, independente da trilha:
 * { prompt, options[4], answer, answerText, explain, visual, eq, skillId, ... }
 * Assim cada minigame só precisa saber desenhar esse formato.
 */
import { SKILLS_BY_ID } from '../../data/curriculum.js';
import { rnd, pick, shuffle } from '../questionUtils.js';
import {
  arithmetic, count, numberSense, estimate, doubleHalf, array, combination,
  divRemainder, multiplesDivisors, divisibility, wordProblem, missingNumber,
} from './arithmetic.js';
import { fraction, decimal, moneyMaker, percent, ratio } from './fractions.js';
import { sequence, balance, expression, powerRoot } from './algebra.js';
import { geometry, position, gridMeasure } from './geometry.js';
import { measure } from './measures.js';
import { data } from './data.js';

const REGISTRO = {
  arithmetic, count, numberSense, estimate, doubleHalf, array, combination,
  divRemainder, multiplesDivisors, divisibility, wordProblem, missingNumber,
  fraction, decimal, money: moneyMaker, percent, ratio,
  sequence, balance, expression, powerRoot,
  geometry, position, gridMeasure, measure, data,
};

/**
 * Gera uma pergunta para a habilidade informada.
 * Se o gerador devolver algo quebrado (opção duplicada, menos de 4 alternativas,
 * texto vazio), tenta de novo até 4 vezes e por último cai numa conta simples —
 * o jogo nunca mostra uma pergunta inválida.
 */
export function buildQuestion(skill, grade) {
  const fn = REGISTRO[skill.gen];
  if (!fn) return fallback(skill, grade);

  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const raw = fn(skill, grade);
    const q = montar(raw, skill, grade);
    if (q) return q;
  }
  return fallback(skill, grade);
}

function montar(raw, skill, grade) {
  if (!raw || !raw.prompt || !raw.opts || !Array.isArray(raw.opts.options)) return null;
  const opts = raw.opts.options.map(o => String(o));
  // exatamente 4 alternativas únicas: se o gerador não conseguiu, tenta de novo
  if (opts.length !== 4 || raw.opts.answer == null || raw.opts.answer < 0) return null;
  if (new Set(opts).size !== opts.length) return null;
  if (opts.some(o => o.trim() === '')) return null;

  const answerIdx = Number(raw.opts.answer);
  if (!isFinite(answerIdx) || answerIdx >= opts.length) return null;

  return {
    prompt: raw.prompt,
    options: opts,
    answer: answerIdx,
    answerText: opts[answerIdx],
    explain: raw.explain || '',
    visual: raw.visual || null,
    eq: raw.eq || null,
    icon: raw.icon || null,
    unidade: raw.unidade || '',
    value: raw.value,
    skillId: skill.id,
    skillNome: skill.nome,
    trilhaId: skill.trilhaId,
    trilhaNome: skill.trilhaNome,
    unidadeTematica: skill.unidade,
    codes: skill.codes,
    grade,
    op: raw.op || null,
    tfCapable: !!raw.eq || typeof raw.value === 'number',
  };
}

function fallback(skill, grade) {
  const a = rnd(2, 12);
  const b = rnd(2, 12);
  const res = a + b;
  const opts = shuffle([res, res + 1, res - 1, res + 2]);
  return montar({
    prompt: `Quanto é ${a} + ${b}?`,
    value: res,
    eq: `${a} + ${b}`,
    opts: { options: opts, answer: opts.indexOf(res) },
    explain: `${a} + ${b} = ${res}.`,
    op: 'add',
  }, skill, grade);
}

/**
 * Transforma uma pergunta de múltipla escolha em afirmação de V ou F.
 * Devolve null para perguntas que não funcionam bem nesse formato.
 */
export function paraTrueFalse(q) {
  if (!q) return null;
  const verdadeiro = Math.random() < 0.5;
  let afirma;
  if (verdadeiro) {
    afirma = q.answerText;
  } else {
    const erradas = q.options.filter((_, i) => i !== q.answer);
    afirma = pick(erradas);
  }
  const base = q.eq || q.prompt.replace(/^Quanto é |\?$/g, '');
  const statement = q.eq
    ? `${q.eq} = ${afirma}`
    : `${q.prompt.replace('?', '')} A resposta é ${afirma}.`;
  return {
    statement,
    answer: verdadeiro,
    explain: q.explain,
    visual: q.visual,
    answerText: q.answerText,
    skillId: q.skillId,
    trilhaId: q.trilhaId,
    trilhaNome: q.trilhaNome,
    unidadeTematica: q.unidadeTematica,
    codes: q.codes,
    grade: q.grade,
    op: q.op,
  };
}

export { SKILLS_BY_ID };
