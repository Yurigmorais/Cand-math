import { G } from '../state/gameState.js';
import { registrarTentativa } from '../state/gameState.js';
import { novaPergunta } from '../engine/questionGenerator.js';
import { getFallingSpeed } from '../engine/mathDifficulty.js';
import { $ } from '../utils/dom.js';
import { MSGS } from '../data/messages.js';
import { pick } from '../engine/questionUtils.js';
import { playSound, speakText } from '../audio/soundManager.js';
import { showConfetti } from '../effects/particles.js';
import { showStudyOverlay } from '../ui/studyOverlay.js';
import { saveState } from '../storage/persistence.js';
import { finishRound, startTimer, elapsed, marcarProgresso, pontosPorAcerto } from './gameUtils.js';
import { depoisDaRodada } from './roundCycle.js';

const TOTAL = 5;
let indice = 0;
let caíram = 0;
let timer = null;

export function startFallingRound() {
  indice = 0;
  G.roundCorrect = 0;
  loadFallingQuestion();
}

export function loadFallingQuestion() {
  G.currentQ = novaPergunta({ trackId: G.selectedTrack, grade: G.grade });
  const q = G.currentQ;

  marcarProgresso('falling', indice + 1, TOTAL);
  $('fallingDiff').textContent = q.trilhaNome;
  $('fallingText').textContent = q.prompt;
  $('fallingFeedback').classList.remove('show');

  startTimer();
  if (G.autoTTS) speakText(q.prompt);

  const stage = $('fallingStage');
  stage.innerHTML = '';

  // até 4 doces caindo, um para cada alternativa
  const ordem = q.options.map((_, i) => i).sort(() => Math.random() - 0.5);
  caíram = 0;

  ordem.forEach((optIdx, pos) => {
    const c = document.createElement('button');
    c.className = 'falling-candy';
    c.style.left = `${8 + pos * (84 / Math.max(1, ordem.length - 1))}%`;
    c.innerHTML = `<span class="fc-val">${q.options[optIdx]}</span><i class="fa-solid fa-candy-cane fc-shadow"></i>`;
    c.dataset.isCorrect = String(optIdx === q.answer);
    c.dataset.speed = String(getFallingSpeed(G.grade));
    c.dataset.pos = '-70';
    c.addEventListener('click', () => handleCandyClick(c, c.dataset.isCorrect === 'true'));
    stage.appendChild(c);
  });

  animarCandies(stage, ordem.length);
}

function animarCandies(stage, total) {
  clearInterval(timer);
  let travado = false;
  const doces = Array.from(stage.querySelectorAll('.falling-candy'));
  const limite = stage.offsetHeight || 320;

  timer = setInterval(() => {
    if (travado) return;
    // a criança saiu da Chuva de Doces: congela a queda. Sem isso, os doces
    // continuariam "caindo" escondidos, virariam tentativa errada na Área dos
    // Pais e a rodada antiga terminaria por cima do jogo novo.
    const tela = $('screenFalling');
    if (tela && !tela.classList.contains('active')) {
      clearInterval(timer);
      timer = null;
      return;
    }
    doces.forEach(c => {
      if (c.dataset.dead) return;
      let pos = Number(c.dataset.pos);
      pos += Number(c.dataset.speed);
      c.dataset.pos = String(pos);
      c.style.top = pos + 'px';
      if (pos > limite - 40) {
        c.dataset.dead = '1';
        c.classList.add('caiu');
        caíram++;
        if (caíram >= total) {
          travado = true;
          handleCandyMiss();
        }
      }
    });
  }, 16);
}

function parar() {
  clearInterval(timer);
  timer = null;
  document.querySelectorAll('.falling-candy').forEach(c => { c.dataset.dead = '1'; c.disabled = true; });
}

export function handleCandyClick(c, certa) {
  parar();
  const q = G.currentQ;
  const ms = elapsed();
  registrarTentativa(q, certa, ms, 'falling');

  if (certa) {
    c.classList.add('correct');
    G.stars += pontosPorAcerto('falling');
    G.streak++;
    G.roundCorrect++;
    if (G.streak > G.bestStreak) G.bestStreak = G.streak;
    playSound('correct');
    showConfetti();
    showFallingFeedback(pick(MSGS.correct));
    // missão de acertos sobe em registrarTentativa()
  } else {
    c.classList.add('wrong');
    const certaEl = Array.from(document.querySelectorAll('.falling-candy')).find(el => el.dataset.isCorrect === 'true');
    if (certaEl) certaEl.classList.add('correct-reveal');
    G.streak = 0;
    playSound('wrong');
    showFallingFeedback(`Era ${q.answerText}!`);
    showStudyOverlay(q);
  }

  $('fallingStarsBar').textContent = G.stars;
  saveState();
  depoisDaRodada(certa ? 1400 : 4200, nextFallingRound);
}

export function handleCandyMiss() {
  parar();
  const q = G.currentQ;
  registrarTentativa(q, false, elapsed(), 'falling');
  G.streak = 0;
  playSound('wrong');
  showFallingFeedback('Escapou! Ficou olhando a resposta certa:');
  showStudyOverlay(q);
  saveState();
  depoisDaRodada(4200, nextFallingRound);
}

export function showFallingFeedback(msg) {
  $('fallingFeedbackMsg').textContent = msg;
  $('fallingFeedback').classList.add('show');
}

export function nextFallingRound() {
  indice++;
  if (indice >= TOTAL) finishRound('falling');
  else loadFallingQuestion();
}
