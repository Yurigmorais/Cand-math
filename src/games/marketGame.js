import { G } from '../state/gameState.js';
import { registrarTentativa } from '../state/gameState.js';
import { $ } from '../utils/dom.js';
import { rnd, pick } from '../engine/questionUtils.js';
import { playSound } from '../audio/soundManager.js';
import { showConfetti } from '../effects/particles.js';
import { saveState } from '../storage/persistence.js';
import { showStudyOverlay } from '../ui/studyOverlay.js';
import { finishRound, startTimer, elapsed, marcarProgresso, pontosPorAcerto } from './gameUtils.js';
import { depoisDaRodada } from './roundCycle.js';
import { MSGS } from '../data/messages.js';

const TOTAL = 4;
const NOTAS = [100, 50, 20, 10, 5, 2, 1];
const MOEDAS = [1, 0.5, 0.25, 0.1];
const ITENS = [
  ['Bombom', 1.5], ['Pirulito', 2], ['Chocolate', 5.5], ['Cupcake', 7],
  ['Sorvete', 8], ['Caixa de balas', 12], ['Bolo de pote', 15], ['Saquinho de goma', 3.5],
];

let indice = 0;
let compra = null;   // { itens, total, modo, pago, alvo }
let escolhidas = [];
let travado = false;   // evita conferir duas vezes a mesma compra

export function startMarketMode() {
  indice = 0;
  G.roundCorrect = 0;
  loadMarketRound();
}

function loadMarketRound() {
  const grade = Number(G.grade || 3);
  const quantidade = grade <= 3 ? 2 : 3;
  const itens = [];
  for (let i = 0; i < quantidade; i++) {
    const [nome, base] = pick(ITENS);
    if (itens.some(x => x.nome === nome)) { i--; continue; }
    const preco = Math.round((base + rnd(0, grade <= 3 ? 3 : 8)) * 100) / 100;
    itens.push({ nome, preco });
  }
  const total = Math.round(itens.reduce((s, i) => s + i.preco, 0) * 100) / 100;

  // anos iniciais: pagar o valor exato. anos finais: dar o troco certo.
  const modo = grade >= 5 ? 'troco' : 'exato';
  const notas = modo === 'exato' ? NOTAS.filter(n => n <= Math.max(20, total)) : NOTAS.filter(n => n <= 100);
  const pago = modo === 'troco' ? arrredondarParaCima(total) : total;
  const alvo = modo === 'troco' ? Math.round((pago - total) * 100) / 100 : total;

  compra = { itens, total, modo, pago, alvo, notas, itensMoeda: MOEDAS };
  escolhidas = [];
  travado = false;

  marcarProgresso('mer', indice + 1, TOTAL);
  $('merStarsBar').textContent = G.stars;
  $('merFeedback').classList.remove('show');

  $('merLista').innerHTML = compra.itens.map(i =>
    `<li><span>${i.nome}</span><b>${br(i.preco)}</b></li>`).join('');

  $('merEnunciado').textContent = modo === 'troco'
    ? `A conta deu ${br(total)}. O cliente pagou com ${br(pago)}. Separe o troco exato.`
    : `Monte ${br(total)} usando as notas e moedas da gaveta.`;

  desenharGaveta();
  atualizarBandeja();
  startTimer();
}

function arrredondarParaCima(v) {
  const casas = [10, 20, 50, 100];
  return casas.find(c => c > v) || Math.ceil(v / 50) * 50;
}

function br(v) {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function desenharGaveta() {
  const gaveta = $('merGaveta');
  gaveta.innerHTML = '';
  // os preços são sempre múltiplos de 0,50 — uma moeda de 50 centavos
  // fecha qualquer conta, então a gaveta nunca fica sem solução
  const precisaMeio = Math.round(compra.alvo * 100) % 100 !== 0;
  const valores = compra.notas.concat(precisaMeio ? [0.5] : []);
  valores.forEach(v => {
    const b = document.createElement('button');
    b.className = 'mer-dinheiro ' + (v < 1 || v % 1 !== 0 ? 'moeda' : 'nota');
    b.innerHTML = `<small>${v < 1 ? 'moeda' : 'nota'}</small><strong>${br(v).replace('R$ ', 'R$')}</strong>`;
    b.addEventListener('click', () => {
      escolhidas.push(v);
      playSound('buy');
      atualizarBandeja();
    });
    gaveta.appendChild(b);
  });

  const limpar = document.createElement('button');
  limpar.className = 'mer-limpar';
  limpar.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Tirar tudo';
  limpar.addEventListener('click', () => { escolhidas = []; atualizarBandeja(); playSound('wrong'); });
  gaveta.appendChild(limpar);
}

function atualizarBandeja() {
  const soma = Math.round(escolhidas.reduce((a, b) => a + b, 0) * 100) / 100;
  $('merBandeja').innerHTML = escolhidas.length
    ? escolhidas.map(v => `<span class="mer-ficha">${v < 1 ? br(v).replace('R$ ', '') : v}</span>`).join('')
    : '<em class="mer-vazio">a bandeja está vazia</em>';
  $('merSoma').textContent = br(soma);
}

export function fecharCompra() {
  if (travado) return;
  travado = true;
  const soma = Math.round(escolhidas.reduce((a, b) => a + b, 0) * 100) / 100;
  const certo = Math.abs(soma - compra.alvo) < 0.005;
  document.querySelectorAll('#screenMarket .mer-dinheiro, #screenMarket .mer-limpar').forEach(b => b.disabled = true);

  const questao = {
    prompt: compra.modo === 'troco'
      ? `Conta de ${br(compra.total)} paga com ${br(compra.pago)}: quanto é o troco?`
      : `Juntar ${br(compra.total)} em notas e moedas.`,
    answerText: br(compra.alvo),
    explain: compra.modo === 'troco'
      ? `Troco é a diferença: ${br(compra.pago)} − ${br(compra.total)} = ${br(compra.alvo)}.`
      : `A soma das suas notas precisa dar exatamente ${br(compra.total)}. Uma forma: ${compra.itens.map(i => i.nome + ' ' + br(i.preco)).join(' + ')}.`,
    skillId: compra.modo === 'troco' ? 'dinheiro-troco' : 'dinheiro-total',
    trilhaId: 'decimais',
    trilhaNome: 'Mercadinho da Juju',
    unidadeTematica: 'medidas',
    codes: ['EF01MA19', 'EF04MA25'],
    grade: G.grade,
  };
  registrarTentativa(questao, certo, elapsed(), 'market');

  if (certo) {
    G.stars += pontosPorAcerto('market');
    G.roundCorrect++;
    G.streak++;
    if (G.streak > G.bestStreak) G.bestStreak = G.streak;
    playSound('correct');
    showConfetti();
    mostrarFeedback(pick(MSGS.correct));
  } else {
    G.streak = 0;
    playSound('wrong');
    mostrarFeedback(soma > compra.alvo ? 'Sobrou dinheiro na bandeja!' : 'Faltou dinheiro na bandeja!');
    showStudyOverlay(questao);
  }

  $('merStarsBar').textContent = G.stars;
  saveState();

  depoisDaRodada(certo ? 1600 : 4200, () => {
    indice++;
    if (indice >= TOTAL) finishRound('market');
    else loadMarketRound();
  });
}

function mostrarFeedback(msg) {
  $('merFeedbackMsg').textContent = msg;
  $('merFeedback').classList.add('show');
}
