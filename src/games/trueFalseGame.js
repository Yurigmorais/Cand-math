import { G } from '../state/gameState.js';
import { registrarTentativa } from '../state/gameState.js';
import { showStudyOverlay } from '../ui/studyOverlay.js';
import { renderVisual } from '../ui/visuals.js';
import { novaPergunta, paraTrueFalse } from '../engine/questionGenerator.js';
import { $ } from '../utils/dom.js';
import { MSGS } from '../data/messages.js';
import { pick } from '../engine/questionUtils.js';
import { playSound, speakText } from '../audio/soundManager.js';
import { showConfetti } from '../effects/particles.js';
import { saveState } from '../storage/persistence.js';
import { finishRound, startTimer, elapsed, marcarProgresso, pontosPorAcerto } from './gameUtils.js';
import { depoisDaRodada } from './roundCycle.js';

const TOTAL = 5;
let atual = null;
let indice = 0;
let resultados = [];

export function startTFRound() {
  indice = 0;
  G.roundCorrect = 0;
  resultados = [];
  updateTFDots();
  loadTFQuestion();
}

export function updateTFDots(estado, i) {
  if (estado === 'done' || estado === 'wrong') resultados[i] = estado;
  document.querySelectorAll('#tfDots .qdot').forEach((dot, k) => {
    dot.classList.remove('done', 'wrong', 'current');
    if (resultados[k]) dot.classList.add(resultados[k]);
    if (estado === 'current' && k === i) dot.classList.add('current');
  });
}

export function loadTFQuestion() {
  const bruta = novaPergunta({ trackId: G.selectedTrack, grade: G.grade });
  atual = paraTrueFalse(bruta) || paraTrueFalse(novaPergunta({ trackId: 'adição', grade: G.grade }));
  if (!atual) { loadTFQuestion(); return; }

  marcarProgresso('tf', indice + 1, TOTAL);
  $('tfStarsBar').textContent = G.stars;
  $('tfDiff').textContent = `${atual.trilhaNome || 'Trilha'} · decidir rápido`;
  $('tfFeedback').classList.remove('show');

  $('tfText').innerHTML = `<span class="tf-afirmacao">${atual.statement}</span>`;
  const vis = $('tfVisual');
  if (vis) vis.innerHTML = renderVisual(atual.visual);

  updateTFDots('current', indice);
  document.querySelectorAll('.tf-answers .ans-btn').forEach(b => {
    b.disabled = false;
    b.classList.remove('correct-reveal');
  });

  const card = $('tfCard');
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = 'slideUp 0.4s ease';

  startTimer();
  if (G.autoTTS) speakText(atual.statement);
}

export function handleTFAnswer(marcouVerdade) {
  document.querySelectorAll('.tf-answers .ans-btn').forEach(b => b.disabled = true);

  const acertou = marcouVerdade === atual.answer;
  const questao = {
    prompt: atual.statement,
    answerText: atual.answer ? 'Verdadeiro' : 'Falso',
    explain: atual.explain,
    visual: atual.visual,
    skillId: atual.skillId,
    trilhaId: atual.trilhaId,
    trilhaNome: atual.trilhaNome,
    unidadeTematica: atual.unidadeTematica,
    codes: atual.codes,
    grade: atual.grade,
    op: atual.op,
  };
  registrarTentativa(questao, acertou, elapsed(), 'tf');

  const botoes = document.querySelectorAll('.tf-answers .ans-btn');
  if (acertou) {
    G.stars += pontosPorAcerto('tf');
    G.streak++;
    G.roundCorrect++;
    if (G.streak > G.bestStreak) G.bestStreak = G.streak;
    playSound('correct');
    showConfetti();
    $('tfFeedbackMsg').textContent = pick(MSGS.correct);
    $('tfFeedback').classList.add('show');
    updateTFDots('done', indice);
    // missão de acertos sobe em registrarTentativa()
  } else {
    const indiceCerto = atual.answer ? 0 : 1;
    if (botoes[indiceCerto]) botoes[indiceCerto].classList.add('correct-reveal');
    $('tfFeedbackMsg').textContent = `Na verdade é ${atual.answer ? 'Verdadeiro' : 'Falso'}!`;
    $('tfFeedback').classList.add('show');
    showStudyOverlay(questao);
    G.streak = 0;
    playSound('wrong');
    updateTFDots('wrong', indice);
  }

  $('tfStarsBar').textContent = G.stars;
  saveState();

  depoisDaRodada(acertou ? 1500 : 4200, () => {
    indice++;
    if (indice >= TOTAL) finishRound('tf');
    else loadTFQuestion();
  });
}
