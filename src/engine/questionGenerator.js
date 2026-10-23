/**
 * Seleção de quem a criança vai enfrentar na próxima pergunta.
 *
 * Ideia pedagógica: dentro da trilha escolhida, o sorteio não é uniforme.
 * Habilidades com mais erros (ou não treinadas há mais tempo) pesam mais,
 * então o jogo "volta" no ponto fraco sem a criança perceber que está
 * sendo corrigida — ela só sente que o jogo está variando.
 */
import { G } from '../state/gameState.js';
import { TRACKS, TRACKS_BY_ID, MIX_TRACK, SKILLS_BY_ID, skillsOfTrack, tracksForGrade } from '../data/curriculum.js';
import { buildQuestion, paraTrueFalse } from './generators/index.js';
import { rnd, pick } from './questionUtils.js';

export { pick, rnd, buildQuestion, paraTrueFalse };

function skillStat(skillId) {
  if (!G.skillStats) return null;
  return G.skillStats[skillId] || null;
}

/**
 * Peso de treino de uma habilidade.
 * base 10, +3 por erro líquido, teto 45, e um empurrãozinho para
 * habilidades nunca vistas (curiosidade > repetição chata).
 */
function peso(sk) {
  const st = skillStat(sk.id);
  if (!st) return 22;
  const liquido = st.w - st.c;
  let p = 10 + Math.max(0, liquido) * 3;
  // se está mandando muito bem, reduz um pouco mas nunca some da rotação
  if (liquido < 0) p = 6;
  return Math.min(45, p);
}

function sortear(habilidades) {
  const pesos = habilidades.map(peso);
  const total = pesos.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < habilidades.length; i++) {
    if (r < pesos[i]) return habilidades[i];
    r -= pesos[i];
  }
  return pick(habilidades);
}

/**
 * @param {object} opts { trackId, grade }
 * @returns pergunta pronta para qualquer minigame
 */
export function novaPergunta(opts = {}) {
  const grade = Number(opts.grade || (G.profile && G.profile.grade) || G.grade || 3);
  const trackId = opts.trackId || G.selectedTrack || 'mix';

  const trilha = trackId === 'mix' ? MIX_TRACK : (TRACKS_BY_ID[trackId] || MIX_TRACK);
  let pool = trackId === 'mix'
    ? tracksForGrade(grade).reduce((acc, t) => acc.concat(t.habilidades), [])
    : skillsOfTrack(trilha.id, grade);

  // trilha escolhida não cobre esse ano: usa a trilha mix completa do ano
  if (!pool.length) pool = tracksForGrade(grade).reduce((acc, t) => acc.concat(t.habilidades), []);
  if (!pool.length) pool = TRACKS.reduce((acc, t) => acc.concat(t.habilidades), []);

  const sk = sortear(pool);
  return buildQuestion(sk, grade);
}

/**
 * Versão antiga, mantida como atalho para os minigames já escritos.
 * level ainda funciona como "nível de operação" (1 soma, 4 divisão).
 */
export function pickQuestion(levelOrOpts) {
  if (levelOrOpts && typeof levelOrOpts === 'object') return novaPergunta(levelOrOpts);
  const level = levelOrOpts || 1;
  const trilhaPorLevel = { 1: 'adição', 2: 'subtracao', 3: 'multiplicacao', 4: 'divisao' };
  return novaPergunta({ trackId: trilhaPorLevel[level] || 'mix' });
}

export function skillDe(q) {
  return q && q.skillId ? SKILLS_BY_ID[q.skillId] : null;
}
