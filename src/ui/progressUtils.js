import { G } from '../state/gameState.js';

/**
 * Leitura do progresso. Uma conta só, feita de um jeito honesto:
 * quem respondeu 1 vez e acertou não é "expert", é início de conversa.
 * Por isso entra um pseudo-acerto e uma pseudo-derrota antes de dividir —
 * as primeiras respostas puxam a barra para o meio e ela só sobe
 * de verdade com repetição.
 */
export function masteryDe(st) {
  if (!st) return 0;
  const c = st.c || 0;
  const w = st.w || 0;
  if (c + w === 0) return 0;
  return (c + 0.5) / (c + w + 1);
}

/** firme = acertou pelo menos 4 e está acima de 80% */
export function domineiu(x) {
  const st = x.st || x;
  const m = x.m != null ? x.m : masteryDe(st);
  return m >= 0.8 && (st.c || 0) >= 4;
}

export function skillStat(skillId) {
  return (G.skillStats || {})[skillId] || null;
}

/** quantas habilidades do ano a criança já enfrentou */
export function cobertura(totalDoAno) {
  if (!totalDoAno) return 0;
  return Math.min(100, Math.round((Object.keys(G.skillStats || {}).length / totalDoAno) * 100));
}
