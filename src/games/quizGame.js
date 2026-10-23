import { G } from '../state/gameState.js';
import { showStudyOverlay } from '../ui/studyOverlay.js';
import { renderVisual } from '../ui/visuals.js';
import { novaPergunta } from '../engine/questionGenerator.js';
import { $ } from '../utils/dom.js';
import { MSGS } from '../data/messages.js';
import { pick } from '../engine/questionUtils.js';
import { playSound, speakText } from '../audio/soundManager.js';
import { showConfetti, burstStars } from '../effects/particles.js';
import { saveState } from '../storage/persistence.js';
import { finishRound, startTimer, elapsed, marcarProgresso, pontosPorAcerto } from './gameUtils.js';
import { depoisDaRodada } from './roundCycle.js';
import { registrarTentativa } from '../state/gameState.js';

const TOTAL = 5;
let resultados = [];

export function startQuizRound() {
  G.quizIndex = 0;
  G.roundCorrect = 0;
  resultados = [];
  updateDots();
  loadQuizQuestion();
}

export function loadQuizQuestion() {
  G.currentQ = novaPergunta({ trackId: G.selectedTrack, grade: G.grade });
  const q = G.currentQ;

  marcarProgresso('quiz', G.quizIndex + 1, TOTAL);
  $('quizDiff').textContent = `${q.trilhaNome} · ${q.codes ? q.codes[0] : ''}`;
  $('quizText').textContent = q.prompt;
  const vis = $('quizVisual');
  if (vis) vis.innerHTML = renderVisual(q.visual);
  $('quizFeedback').classList.remove('show');

  embaralharERenderizar(q);
  updateDots('current', G.quizIndex);

  const card = $('quizCard');
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = 'slideUp 0.4s ease';

  startTimer();
  if (G.autoTTS) speakText(q.prompt);
}

function embaralharERenderizar(q) {
  const idx = q.options.map((_, i) => i);
  const ordem = idx.sort(() => Math.random() - 0.5);
  renderQuizAnswers(ordem.map(i => q.options[i]), ordem.indexOf(q.answer));
}

export function renderQuizAnswers(opts, correta) {
  const grid = $('quizAnswers');
  grid.innerHTML = '';
  opts.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'ans-btn';
    btn.textContent = opt;
    btn.addEventListener('click', () => handleQuizAnswer(i, correta, btn));
    grid.appendChild(btn);
  });
}

export function handleQuizAnswer(escolha, correta, btn) {
  const botoes = document.querySelectorAll('#screenQuiz .ans-btn');
  botoes.forEach(b => b.disabled = true);

  const q = G.currentQ;
  const acertou = escolha === correta;
  const ms = elapsed();

  registrarTentativa(q, acertou, ms, 'quiz');

  if (acertou) {
    btn.classList.add('correct');
    G.stars += pontosPorAcerto('quiz');
    G.streak++;
    G.roundCorrect++;
    if (G.streak > G.bestStreak) G.bestStreak = G.streak;
    playSound('correct');
    showConfetti();
    if (btn.getBoundingClientRect) burstStars(btn.getBoundingClientRect());
    showQuizFeedback(G.streak >= 3 ? pick(MSGS.streak) : pick(MSGS.correct));
    updateDots('done', G.quizIndex);
    if (G.streak % 3 === 0) G.stars += 5;
    // a missão "acertos" sobe em registrarTentativa(), para valer em todos os modos
  } else {
    btn.classList.add('wrong');
    if (botoes[correta]) botoes[correta].classList.add('correct-reveal');
    showQuizFeedback(`A resposta certa é ${q.answerText}!`);
    showStudyOverlay(q);
    G.streak = 0;
    playSound('wrong');
    updateDots('wrong', G.quizIndex);
  }

  $('quizStarsBar').textContent = G.stars;
  saveState();

  depoisDaRodada(acertou ? 1500 : 4200, () => {
    G.quizIndex++;
    if (G.quizIndex >= TOTAL) finishRound('quiz');
    else loadQuizQuestion();
  });
}

export function showQuizFeedback(msg) {
  $('quizFeedbackMsg').textContent = msg;
  $('quizFeedback').classList.add('show');
}

export function updateDots(estado, indice) {
  if (estado === 'done' || estado === 'wrong') resultados[indice] = estado;
  document.querySelectorAll('#qDots .qdot').forEach((dot, i) => {
    dot.classList.remove('done', 'wrong', 'current');
    if (resultados[i]) dot.classList.add(resultados[i]);
    if (estado === 'current' && i === indice) dot.classList.add('current');
  });
}
