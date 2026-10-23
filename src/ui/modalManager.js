import { G } from '../state/gameState.js';
import { $ } from '../utils/dom.js';
import { renderQuests, renderRecordsExtras } from './hubUI.js';

export function openModal(id) {
  if (id === 'modalRecords') {
    $('recStars').textContent = G.stars;
    $('recPhase').textContent = G.phase;
    $('recStreak').textContent = G.bestStreak;
    $('recCorrect').textContent = G.totalCorrect;
    renderRecordsExtras();
  }
  if (id === 'modalQuests') renderQuests();
  $(id).style.display = 'block';
  $('modalOverlay').classList.add('open');
}

export function closeModal(id) {
  $(id).style.display = 'none';
  const anyOpen = document.querySelectorAll('.modal[style*="display: block"], .modal[style*="display:block"]');
  if (!anyOpen.length) $('modalOverlay').classList.remove('open');
}

export function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
  $('modalOverlay').classList.remove('open');
}
