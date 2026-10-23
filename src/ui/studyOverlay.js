import { G } from '../state/gameState.js';
import { getStudyMs } from '../engine/mathDifficulty.js';
import { renderVisual } from './visuals.js';

/**
 * Tela de foco depois do erro: mostra a conta, a resposta certa e o porquê,
 * e fica aberta o tempo suficiente para a criança reler (maior para os anos
 * iniciais). Só fecha quando a criança toca nela — assim ela lê de verdade.
 */
export function showStudyOverlay(questao) {
  const q = typeof questao === 'string' ? { prompt: questao, answerText: arguments[1] } : questao;
  if (!q || !q.prompt) return;

  const duracao = getStudyMs(G.grade || 3);
  const overlay = document.createElement('div');
  overlay.className = 'study-overlay';
  overlay.innerHTML = `
    <div class="study-card">
      <div class="study-mascote"><img src="/assets/images/jaguar_thinking.jpg" alt="Juju" /></div>
      <p class="study-label"><i class="fa-solid fa-lightbulb"></i> Olha só</p>
      <p class="study-question">${escapeHtml(q.prompt)}</p>
      ${q.visual ? renderVisual(q.visual) : ''}
      <p class="study-answer">= <strong>${escapeHtml(q.answerText || '')}</strong></p>
      ${q.explain ? `<p class="study-why">${escapeHtml(q.explain)}</p>` : ''}
      <div class="study-timer-bar"></div>
      <p class="study-hint">Toque aqui quando já souber a resposta</p>
      <button class="btn-study-close"><i class="fa-solid fa-check"></i> Entendi!</button>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('in'));

  const bar = overlay.querySelector('.study-timer-bar');
  bar.style.transition = `width ${duracao}ms linear`;
  requestAnimationFrame(() => { bar.style.width = '100%'; });

  let fechada = false;
  const fechar = () => {
    if (fechada) return;
    fechada = true;
    overlay.classList.remove('in');
    overlay.classList.add('out');
    setTimeout(() => overlay.remove(), 260);
  };
  overlay.addEventListener('click', fechar);
  overlay.querySelector('.btn-study-close').addEventListener('click', fechar);
  setTimeout(fechar, duracao + 1200);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
