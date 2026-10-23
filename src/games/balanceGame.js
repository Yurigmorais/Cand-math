import { G } from '../state/gameState.js';
import { registrarTentativa } from '../state/gameState.js';
import { $ } from '../utils/dom.js';
import { rnd, pick, shuffle } from '../engine/questionUtils.js';
import { playSound } from '../audio/soundManager.js';
import { showConfetti } from '../effects/particles.js';
import { saveState } from '../storage/persistence.js';
import { showStudyOverlay } from '../ui/studyOverlay.js';
import { finishRound, startTimer, elapsed, marcarProgresso, pontosPorAcerto } from './gameUtils.js';
import { depoisDaRodada } from './roundCycle.js';
import { MSGS } from '../data/messages.js';

const TOTAL = 5;
let indice = 0;
let rodada = null;   // { esquerda, incognita, total, op }
let escolha = null;
let travado = false;   // evita conferir duas vezes a mesma rodada

export function startBalanceMode() {
  indice = 0;
  G.roundCorrect = 0;
  loadBalanceRound();
}

function loadBalanceRound() {
  const grade = Number(G.grade || 3);
  const limite = grade <= 2 ? 10 : grade <= 4 ? 20 : grade <= 6 ? 40 : 60;
  const conhecido = rnd(2, limite);
  const incognita = rnd(2, limite);
  rodada = { esquerda: conhecido, incognita, total: conhecido + incognita };
  escolha = null;
  travado = false;

  marcarProgresso('bal', indice + 1, TOTAL);
  $('balStarsBar').textContent = G.stars;
  $('balFeedback').classList.remove('show');

  const direita = $('balDireita');
  direita.innerHTML = candyRow(rodada.total);

  const esquerda = $('balEsquerda');
  esquerda.innerHTML = `<div class="bal-saco" id="balSaco">?</div>` + candyRow(rodada.esquerda);

  const opcoes = shuffle(opcoesPara(rodada));
  const faixa = $('balOpcoes');
  faixa.innerHTML = '';
  opcoes.forEach(v => {
    const b = document.createElement('button');
    b.className = 'bal-chip';
    b.textContent = v;
    b.addEventListener('click', () => {
      faixa.querySelectorAll('.bal-chip').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      escolha = v;
      const saco = $('balSaco');
      saco.textContent = v;
      saco.classList.add('cheio');
      playSound('buy');
    });
    faixa.appendChild(b);
  });

  startTimer();
}

function candyRow(n) {
  const ic = ['fa-candy-cane', 'fa-cookie-bite', 'fa-cookie', 'fa-ice-cream'];
  const mostrar = Math.min(n, 12);
  let html = '<div class="bal-doces">';
  for (let i = 0; i < mostrar; i++) {
    html += `<i class="fa-solid ${pick(ic)}" style="color:${['#FF6B9D', '#FFD93D', '#4ECDC4', '#9B5DE5'][i % 4]}"></i>`;
  }
  html += `</div><div class="bal-contagem">${n}</div>`;
  return html;
}

function opcoesPara(r) {
  const base = [r.incognita];
  const vizinhos = new Set();
  while (vizinhos.size < 3) {
    const delta = rnd(1, 8) * (Math.random() < 0.5 ? 1 : -1);
    const c = r.incognita + delta;
    if (c > 0 && c !== r.incognita) vizinhos.add(c);
  }
  return base.concat(Array.from(vizinhos).slice(0, 3));
}

export function conferirBalanca() {
  if (escolha == null) {
    const msg = $('balFeedbackMsg');
    if (msg) { msg.textContent = 'Escolhe um número para a sacola primeiro!'; $('balFeedback').classList.add('show'); }
    return;
  }
  if (travado) return;
  travado = true;
  document.querySelectorAll('#screenBalance .bal-chip').forEach(b => b.disabled = true);

  const certo = escolha === rodada.incognita;
  const questao = {
    prompt: `A balança está em equilíbrio: de um lado ${rodada.esquerda} doces e uma sacola escondida; do outro ${rodada.total} doces. Quantos doces têm na sacola?`,
    answerText: String(rodada.incognita),
    explain: `${rodada.esquerda} + ⬜ = ${rodada.total}. Então ⬜ = ${rodada.total} − ${rodada.esquerda} = ${rodada.incognita}. Os dois lados de uma balança em equilíbrio têm sempre o mesmo valor.`,
    skillId: 'balanca',
    trilhaId: 'padroes',
    trilhaNome: 'Balança da Juju',
    unidadeTematica: 'algebra',
    codes: ['EF05MA10', 'EF06MA14'],
    grade: G.grade,
  };
  registrarTentativa(questao, certo, elapsed(), 'balance');

  const saco = $('balSaco');
  if (certo) {
    saco.classList.add('ok');
    document.querySelector('.bal-corpo')?.classList.add('equilibrou');
    G.stars += pontosPorAcerto('balance');
    G.roundCorrect++;
    G.streak++;
    if (G.streak > G.bestStreak) G.bestStreak = G.streak;
    playSound('correct');
    showConfetti();
    mostrarFeedback(pick(MSGS.correct));
  } else {
    saco.classList.add('erro');
    document.querySelector('.bal-corpo')?.classList.add('pendendo');
    G.streak = 0;
    playSound('wrong');
    mostrarFeedback(`Pendeu para o lado errado. A sacola tinha ${rodada.incognita}.`);
    showStudyOverlay(questao);
  }

  $('balStarsBar').textContent = G.stars;
  saveState();

  depoisDaRodada(certo ? 1500 : 4200, () => {
    indice++;
    if (indice >= TOTAL) finishRound('balance');
    else loadBalanceRound();
  });
}

function mostrarFeedback(msg) {
  $('balFeedbackMsg').textContent = msg;
  $('balFeedback').classList.add('show');
}
