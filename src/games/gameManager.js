import { G } from '../state/gameState.js';
import { $ } from '../utils/dom.js';
import { showScreen } from '../ui/screenManager.js';
import { openModal, closeModal } from '../ui/modalManager.js';
import { TRACKS, TRACKS_BY_ID, MIX_TRACK } from '../data/curriculum.js';
import { saveState } from '../storage/persistence.js';
import { playSound } from '../audio/soundManager.js';
import { spawnLevelUpConfetti } from '../effects/particles.js';
import { updateHubUI, jaguarSpeak, clearIdleTimer } from '../ui/hubUI.js';
import { novoCiclo } from './roundCycle.js';
import { startQuizRound } from './quizGame.js';
import { startFallingRound } from './fallingGame.js';
import { startRaceRound } from './raceGame.js';
import { startPuzzleMode } from './puzzleGame.js';
import { startMemoryMode } from './memoryGame.js';
import { startTFRound } from './trueFalseGame.js';
import { startFractionMode } from './fractionGame.js';
import { startBalanceMode } from './balanceGame.js';
import { startMarketMode } from './marketGame.js';

let modoAguardandoTrilha = null;

export const MODOS = {
  quiz: { nome: 'Quiz Doce', start: startQuizRound, tela: 'screenQuiz' },
  falling: { nome: 'Chuva de Doces', start: startFallingRound, tela: 'screenFalling' },
  race: { nome: 'Corrida Doce', start: startRaceRound, tela: 'screenRace' },
  memory: { nome: 'Memória Doce', start: startMemoryMode, tela: 'screenMemory' },
  tf: { nome: 'Verdadeiro ou Falso', start: startTFRound, tela: 'screenTrueFalse' },
  puzzle: { nome: 'Cruzadinha de Doces', start: startPuzzleMode, tela: 'screenPuzzle' },
  fraction: { nome: 'Fatia de Bolo', start: startFractionMode, tela: 'screenFraction' },
  balance: { nome: 'Balança da Juju', start: startBalanceMode, tela: 'screenBalance' },
  market: { nome: 'Mercadinho', start: startMarketMode, tela: 'screenMarket' },
};

/**
 * Modal de trilha: a criança escolhe O QUE quer treinar, o ano escolar
 * (vindo do perfil) decide o QUÃO difícil.
 */
export function openTracks(modo) {
  modoAguardandoTrilha = modo;
  renderTracks();
  openModal('modalTracks');
}

export function renderTracks() {
  const box = $('trackList');
  if (!box) return;
  const grade = Number(G.grade || 3);

  const estadoDe = t => {
    if (grade < t.grades[0]) return 'futura';
    if (grade > t.grades[1]) return 'revisao';
    return 'agora';
  };

  const card = (t, estado) => {
    const bloqueada = estado === 'futura';
    const selecionada = G.selectedTrack === t.id;
    return `
      <button class="track-card ${estado} ${selecionada ? 'sel' : ''}" ${bloqueada ? 'disabled' : ''}
              style="--cor:${t.cor}" onclick="escolherTrilha('${t.id}')">
        <span class="tc-icon"><i class="fa-solid ${t.icon}"></i></span>
        <span class="tc-txt">
          <strong>${t.nome}</strong>
          <small>${t.sub}</small>
          <em>${t.grades[0]}º ao ${t.grades[1]}º ano</em>
        </span>
        <span class="tc-tag">${
          estado === 'agora' ? 'Sua série' : estado === 'revisao' ? 'Para revisar' : 'Vem ano que vem'
        }</span>
      </button>`;
  };

  const agora = [];
  const revisao = [];
  const futuras = [];
  TRACKS.forEach(t => {
    const e = estadoDe(t);
    (e === 'agora' ? agora : e === 'revisao' ? revisao : futuras).push(card(t, e));
  });

  box.innerHTML = [
    `<p class="track-group-label"><i class="fa-solid fa-star"></i> Recomendada</p>`,
    card({ ...MIX_TRACK }, 'agora'),
    agora.length ? `<p class="track-group-label"><i class="fa-solid fa-bolt"></i> Do seu ano</p>${agora.join('')}` : '',
    revisao.length ? `<p class="track-group-label"><i class="fa-solid fa-rotate-left"></i> Para rever o que ficou para trás</p>${revisao.join('')}` : '',
    futuras.length ? `<p class="track-group-label"><i class="fa-solid fa-lock"></i> Você ainda vai chegar aqui</p>${futuras.join('')}` : '',
  ].filter(Boolean).join('');
}

export function escolherTrilha(trackId) {
  G.selectedTrack = trackId;
  saveState();
  closeModal('modalTracks');
  updateHubUI();
  const t = trackId === 'mix' ? MIX_TRACK : TRACKS_BY_ID[trackId];
  if (t) jaguarSpeak(`Boa! Vamos treinar ${t.nome}.`);
  if (modoAguardandoTrilha) {
    const modo = modoAguardandoTrilha;
    modoAguardandoTrilha = null;
    startMode(modo);
  }
}

export function startMode(mode) {
  const mod = MODOS[mode];
  if (!mod) return;
  G.currentMode = mode;
  G.roundCorrect = 0;
  G.roundHints = 0;
  clearIdleTimer();
  novoCiclo();          // invalida agendamentos da rodada anterior
  if (mode === 'quiz') G.quizIndex = 0;
  if (mode === 'race') G.raceIndex = 0;
  mod.start();
  showScreen(mod.tela);
}

export function trilhaAtual() {
  return G.selectedTrack || 'mix';
}

export function progressQuest(type, amount = 1) {
  if (!G.dailyQuests) return;
  let atualizado = false;
  G.dailyQuests.forEach(q => {
    if (q.type === type || q.type === 'play_any') {
      if (q.progress < q.target) {
        q.progress = Math.min(q.target, q.progress + amount);
        atualizado = true;
      }
    }
  });
  if (atualizado) saveState();
}

export function addXP(amount) {
  G.xp += amount;
  const necessário = G.level * 100;

  if (G.xp >= necessário) {
    G.xp -= necessário;
    G.level += 1;
    G.stars += 100;
    const txt = $('xpLevelText');
    if (txt) txt.textContent = `Nível ${G.level - 1} → ${G.level}`;
    openModal('modalXPLevelUp');
    setTimeout(() => {
      playSound('levelup');
      spawnLevelUpConfetti();
    }, 100);
  }

  updateHubUI();
  saveState();
}
