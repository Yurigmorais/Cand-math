import { G } from '../state/gameState.js';
import { registrarTentativa } from '../state/gameState.js';
import { novaPergunta } from '../engine/questionGenerator.js';
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
const ICONES = ['fa-candy-cane', 'fa-cookie-bite', 'fa-ice-cream', 'fa-cake-candles'];
let laneAtual = -1;

export function startRaceRound() {
  G.raceIndex = 0;
  G.roundCorrect = 0;
  loadRaceQuestion();
}

export function loadRaceQuestion() {
  G.currentQ = novaPergunta({ trackId: G.selectedTrack, grade: G.grade });
  const q = G.currentQ;

  marcarProgresso('race', G.raceIndex + 1, TOTAL);
  $('raceDiff').textContent = q.trilhaNome;
  $('raceText').textContent = q.prompt;
  $('raceFeedback').classList.remove('show');

  const car = $('raceCar');
  car.classList.remove('crash', 'win');
  car.style.transition = 'none';
  car.style.left = '50%';
  car.style.transform = 'translateX(-50%)';
  $('finishLine').classList.remove('show');

  laneAtual = -1;

  // 3 faixas: a resposta certa e duas erradas bem perto dela
  const erradas = q.options.filter((_, i) => i !== q.answer);
  const três = [q.options[q.answer], erradas[0], erradas[1]].sort(() => Math.random() - 0.5);
  renderRaceGates(três, três.indexOf(q.options[q.answer]));

  startTimer();
  if (G.autoTTS) speakText(q.prompt);
}

function renderRaceGates(opts, correta) {
  const gates = $('raceGates');
  gates.innerHTML = '';
  opts.forEach((opt, i) => {
    const g = document.createElement('div');
    g.className = 'race-gate';
    g.dataset.lane = i;
    g.innerHTML = `<i class="fa-solid ${ICONES[i % ICONES.length]} gate-icon"></i><span class="gate-text">${opt}</span>`;
    gates.appendChild(g);
  });

  const btns = $('raceLaneBtns');
  btns.innerHTML = '';
  opts.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'lane-btn';
    btn.innerHTML = `<i class="fa-solid fa-arrow-up"></i><b>${opt}</b>`;
    btn.addEventListener('click', () => handleRaceChoice(i, correta, opts.length));
    btns.appendChild(btn);
  });
}

export function handleRaceChoice(escolha, correta, total) {
  if (laneAtual >= 0) return;
  laneAtual = escolha;
  document.querySelectorAll('#screenRace .lane-btn').forEach(b => b.disabled = true);

  const car = $('raceCar');
  const stage = $('raceStage');
  const laneW = (stage.offsetWidth || 320) / total;
  car.style.transition = 'left 0.45s cubic-bezier(0.34,1.56,0.64,1)';
  car.style.left = `${escolha * laneW + laneW / 2}px`;

  const gates = $('raceGates').querySelectorAll('.race-gate');
  const q = G.currentQ;

  setTimeout(() => {
    const acertou = escolha === correta;
    registrarTentativa(q, acertou, elapsed(), 'race');

    if (acertou) {
      gates[escolha].classList.add('correct-gate');
      car.classList.add('win');
      $('finishLine').classList.add('show');
      G.stars += pontosPorAcerto('race');
      G.streak++;
      G.roundCorrect++;
      if (G.streak > G.bestStreak) G.bestStreak = G.streak;
      playSound('correct');
      showConfetti();
      showRaceFeedback(pick(MSGS.correct));
      // missão de acertos sobe em registrarTentativa()
    } else {
      gates[escolha].classList.add('wrong-gate');
      gates[correta].classList.add('correct-gate');
      car.classList.add('crash');
      G.streak = 0;
      playSound('wrong');
      showRaceFeedback(`A pista certa era ${q.answerText}`);
      showStudyOverlay(q);
    }

    $('raceStarsBar').textContent = G.stars;
    saveState();

    depoisDaRodada(acertou ? 1600 : 4200, () => {
      G.raceIndex++;
      if (G.raceIndex >= TOTAL) finishRound('race');
      else loadRaceQuestion();
    });
  }, 460);
}

export function showRaceFeedback(msg) {
  $('raceFeedbackMsg').textContent = msg;
  $('raceFeedback').classList.add('show');
}
