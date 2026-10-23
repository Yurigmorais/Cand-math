import { G } from '../state/gameState.js';
import { saveState } from '../storage/persistence.js';
import { $ } from '../utils/dom.js';
import { openModal } from '../ui/modalManager.js';
import { spawnLevelUpConfetti } from '../effects/particles.js';
import { playSound } from '../audio/soundManager.js';
import { addXP, progressQuest } from './gameManager.js';

const PONTOS_POR_MODO = {
  quiz: 10, falling: 15, race: 15, tf: 10, memory: 20,
  puzzle: 30, fraction: 20, balance: 20, market: 25,
};

export function pontosPorAcerto(modo) {
  return PONTOS_POR_MODO[modo] || 10;
}

/**
 * Contador de tempo da pergunta atual. Os minigames chamam startTimer()
 * ao mostrar a pergunta e elapsed() ao receber a resposta — o resultado
 * alimenta a Área dos Pais (criança rápida x criança que trava).
 */
let marcaInicio = 0;
export function startTimer() { marcaInicio = Date.now(); }
export function elapsed() { return marcaInicio ? Date.now() - marcaInicio : 0; }

/** marca o placar vivo na barra de cima de cada minigame */
export function marcarProgresso(idPrefixo, atual, total) {
  const prog = $(idPrefixo + 'Prog');
  if (prog) prog.textContent = total ? `${atual}/${total}` : `${atual}`;
  const bar = $(idPrefixo + 'StarsBar');
  if (bar) bar.textContent = G.stars;
}

/**
 * Conta uma partida concluída: placar por modo + missões diárias.
 * A cruzadinha usa só isso (ela tem premiação própria), os demais modos
 * passam por finishRound().
 */
export function registrarPartida(modo) {
  const m = G.modeStats[modo] || { plays: 0, correct: 0, attempts: 0 };
  m.plays++;
  G.modeStats[modo] = m;
  progressQuest('play_any', 1);
  progressQuest(`play_${modo}`, 1);
}

export function finishRound(modo) {
  const corretas = G.roundCorrect;
  const bônus = corretas === 5 ? 25 : corretas >= 3 ? 10 : 0;
  if (bônus) G.stars += bônus;

  const faseAnterior = G.phase;
  if (corretas >= 3) G.phase = Math.min(G.phase + 1, 8);

  registrarPartida(modo);
  saveState();

  const mudouFase = G.phase > faseAnterior;
  const ganhou = (PONTOS_POR_MODO[modo] || 10) * corretas + bônus;

  const titulo = document.querySelector('#modalLevelUp .lu-title');
  if (titulo) titulo.textContent = mudouFase ? 'Fase concluída!' : 'Rodada completa!';
  const txtFase = $('luPhaseText');
  if (txtFase) txtFase.textContent = mudouFase ? `Fase ${faseAnterior} → Fase ${G.phase}` : `Você acertou ${corretas} de 5`;
  const txtStars = $('luStarsText');
  if (txtStars) txtStars.innerHTML = `+${ganhou} <i class="fa-solid fa-star"></i> (bônus: ${bônus})`;

  if (corretas === 5 && !G.roundHints) progressQuest('no_hint', 1);
  addXP(corretas * 20 + bônus);

  openModal('modalLevelUp');
  if (mudouFase) spawnLevelUpConfetti();
  playSound('levelup');
}
