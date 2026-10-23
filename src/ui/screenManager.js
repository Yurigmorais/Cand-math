import { $ } from '../utils/dom.js';
import { updateHubUI, startIdleMessages } from './hubUI.js';
import { novoCiclo } from '../games/roundCycle.js';

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

export function goHub() {
  // derruba qualquer passo agendado de um minigame que ficou para trás
  novoCiclo();
  showScreen('screenHub');
  updateHubUI();
  startIdleMessages();
}
