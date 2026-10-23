import { G } from '../state/gameState.js';
import { registrarTentativa } from '../state/gameState.js';
import { novaPergunta } from '../engine/questionGenerator.js';
import { $ } from '../utils/dom.js';
import { playSound } from '../audio/soundManager.js';
import { showConfetti } from '../effects/particles.js';
import { saveState } from '../storage/persistence.js';
import { finishRound, marcarProgresso } from './gameUtils.js';
import { depoisDaRodada } from './roundCycle.js';

let cartas = [];
let viradas = [];
let encontradas = 0;
let pares = 4;

/**
 * Pares do jogo da memória: a conta de um lado, o resultado do outro.
 * Só entram perguntas que cabem nesse formato (as que devolvem "eq"),
 * senão o tabuleiro fica ilegível.
 */
function coletarPares(trilha, grade, quantos) {
  const achados = [];
  const vistos = new Set();
  for (let tentativa = 0; tentativa < 60 && achados.length < quantos; tentativa++) {
    const q = novaPergunta({ trackId: trilha, grade });
    const rotulo = q.eq || (q.prompt.length <= 26 ? q.prompt : null);
    if (!rotulo || vistos.has(q.answerText) || vistos.has(rotulo)) continue;
    vistos.add(rotulo);
    vistos.add(q.answerText);
    achados.push({ rotulo, resposta: q.answerText, q });
  }
  return achados;
}

export function startMemoryMode() {
  encontradas = 0;
  viradas = [];
  pares = (G.grade || 3) <= 2 ? 3 : 4;
  $('memoryProg').textContent = `Pares: 0/${pares}`;
  $('memoryStarsBar').textContent = G.stars;
  $('memoryFeedback').classList.remove('show');

  const lista = coletarPares(G.selectedTrack, G.grade, pares);
  cartas = [];
  lista.forEach((p, i) => {
    cartas.push({ parId: i, face: p.rotulo, tipo: 'pergunta', origem: p });
    cartas.push({ parId: i, face: p.resposta, tipo: 'resposta', origem: p });
  });

  if (!cartas.length) {
    // nunca deve acontecer, mas o tabuleiro precisa abrir com algo
    for (let i = 0; i < 3; i++) {
      const a = 3 + i * 4;
      const b = 2 + i;
      cartas.push({ parId: i, face: `${a} + ${b}`, tipo: 'pergunta' });
      cartas.push({ parId: i, face: String(a + b), tipo: 'resposta' });
    }
  }

  cartas.sort(() => Math.random() - 0.5);
  renderMemoryGrid();
}

export function renderMemoryGrid() {
  const grid = $('memoryGrid');
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(${cartas.length <= 6 ? 3 : 4}, 1fr)`;
  cartas.forEach((c, idx) => {
    const card = document.createElement('div');
    card.className = 'mcard';
    card.dataset.idx = idx;
    card.innerHTML = `
      <div class="mcard-inner">
        <div class="mcard-front"><i class="fa-solid fa-candy-cane"></i></div>
        <div class="mcard-back ${c.tipo}">${c.face}</div>
      </div>`;
    card.addEventListener('click', () => handleMemoryClick(card, c, idx));
    grid.appendChild(card);
  });
}

export function handleMemoryClick(cardEl, cardData) {
  if (cardEl.classList.contains('flipped') || cardEl.classList.contains('matched')) return;
  if (viradas.length >= 2) return;
  cardEl.classList.add('flipped');
  playSound('buy');
  viradas.push({ el: cardEl, data: cardData });
  if (viradas.length === 2) depoisDaRodada(750, checkMemoryMatch);
}

export function checkMemoryMatch() {
  const [a, b] = viradas;
  const deuCerto = a.data.parId === b.data.parId;

  if (deuCerto) {
    a.el.classList.add('matched');
    b.el.classList.add('matched');
    playSound('correct');
    encontradas++;
    G.stars += 8;
    G.roundCorrect++;
    $('memoryProg').textContent = `Pares: ${encontradas}/${pares}`;
    registrarTentativa(a.data.origem || null, true, 0, 'memory');

    if (encontradas === pares) {
      showConfetti();
      $('memoryFeedbackMsg').textContent = 'Acheu todos os pares! Que memória.';
      $('memoryFeedback').classList.add('show');
      G.stars += 12;
      $('memoryStarsBar').textContent = G.stars;
      saveState();
      depoisDaRodada(1800, () => finishRound('memory'));
    }
  } else {
    a.el.classList.remove('flipped');
    b.el.classList.remove('flipped');
    playSound('wrong');
    registrarTentativa(a.data.origem || null, false, 0, 'memory');
  }
  viradas = [];
  $('memoryStarsBar').textContent = G.stars;
  saveState();
}
