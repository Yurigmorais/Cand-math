import { G } from '../state/gameState.js';
import { registrarTentativa } from '../state/gameState.js';
import { $ } from '../utils/dom.js';
import { rnd, pick } from '../engine/questionUtils.js';
import { playSound } from '../audio/soundManager.js';
import { showConfetti } from '../effects/particles.js';
import { saveState } from '../storage/persistence.js';
import { finishRound, startTimer, elapsed, marcarProgresso, pontosPorAcerto } from './gameUtils.js';
import { depoisDaRodada } from './roundCycle.js';
import { showStudyOverlay } from '../ui/studyOverlay.js';
import { MSGS } from '../data/messages.js';

const TOTAL = 5;
let indice = 0;
let alvo = null;      // { partes, pintadas }
let pintadas = 0;
let travado = false;   // evita conferir duas vezes a mesma rodada

const DENOMINADORES = {
  1: [2, 4], 2: [2, 4], 3: [4, 6, 8], 4: [4, 6, 8],
  5: [6, 8, 10], 6: [8, 10, 12], 7: [8, 12], 8: [10, 12], 9: [12],
};

export function startFractionMode() {
  indice = 0;
  G.roundCorrect = 0;
  loadFractionRound();
}

function loadFractionRound() {
  const grade = Number(G.grade || 3);
  const opcoes = DENOMINADORES[grade] || DENOMINADORES[4];
  const partes = pick(opcoes);
  const n = rnd(1, partes - 1);
  alvo = { partes, pintadas: n };
  pintadas = 0;
  travado = false;

  marcarProgresso('frac', indice + 1, TOTAL);
  $('fracStarsBar').textContent = G.stars;
  $('fracAlvo').innerHTML = `<span class="ff"><em>${n}</em><hr><b>${partes}</b></span> do bolo`;
  $('fracFeedback').classList.remove('show');
  desenharBolo(partes);
  atualizarPlacar();

  startTimer();
}

function desenharBolo(partes) {
  const tab = $('fracBolo');
  tab.innerHTML = '';
  for (let i = 0; i < partes; i++) {
    const f = document.createElement('button');
    f.className = 'bolo-fatia';
    f.dataset.i = i;
    f.innerHTML = `<span class="bolo-cobertura"></span><span class="bolo-num">${i + 1}</span>`;
    f.addEventListener('click', () => toggleFatia(f, i));
    tab.appendChild(f);
  }
  tab.style.setProperty('--partes', partes);
}

function toggleFatia(el, i) {
  const estava = el.classList.toggle('on');
  if (estava) pintadas++; else pintadas--;
  playSound('buy');
  atualizarPlacar();
}

function atualizarPlacar() {
  $('fracPlacar').textContent = `${pintadas} de ${alvo ? alvo.partes : 0} pedaços pintados`;
}

export function conferirBolo() {
  if (travado) return;
  travado = true;
  const botoes = document.querySelectorAll('#screenFraction .bolo-fatia');
  botoes.forEach(b => b.disabled = true);

  const certo = pintadas === alvo.pintadas;
  const questao = {
    prompt: `Pinte ${alvo.pintadas} de ${alvo.partes} partes iguais do bolo.`,
    answerText: `${alvo.pintadas}/${alvo.partes}`,
    explain: `${alvo.pintadas} de ${alvo.partes} partes é a fração ${alvo.pintadas}/${alvo.partes}. O número de baixo (denominador) diz em quantas partes o bolo foi cortado; o de cima (numerador) diz quantas partes você pegou.`,
    skillId: 'fracao-visual',
    trilhaId: 'fracoes',
    trilhaNome: 'Fatia de Bolo',
    unidadeTematica: 'numeros',
    codes: ['EF04MA09', 'EF05MA03'],
    grade: G.grade,
  };
  registrarTentativa(questao, certo, elapsed(), 'fraction');

  if (certo) {
    G.stars += pontosPorAcerto('fraction');
    G.roundCorrect++;
    G.streak++;
    if (G.streak > G.bestStreak) G.bestStreak = G.streak;
    playSound('correct');
    showConfetti();
    mostrarFeedback(pick(MSGS.correct));
  } else {
    botoes.forEach((b, i) => b.classList.toggle('mostra-certo', i < alvo.pintadas));
    G.streak = 0;
    playSound('wrong');
    const diff = alvo.pintadas - pintadas;
    const palavra = (n) => `${Math.abs(n)} pedacinho${Math.abs(n) > 1 ? 's' : ''}`;
    mostrarFeedback(`${diff > 0 ? 'Faltaram' : 'Sobraram'} ${palavra(diff)}: era ${alvo.pintadas} de ${alvo.partes}.`);
    showStudyOverlay(questao);
  }

  $('fracStarsBar').textContent = G.stars;
  saveState();

  depoisDaRodada(certo ? 1500 : 4200, () => {
    indice++;
    if (indice >= TOTAL) finishRound('fraction');
    else loadFractionRound();
  });
}

function mostrarFeedback(msg) {
  $('fracFeedbackMsg').textContent = msg;
  $('fracFeedback').classList.add('show');
}
