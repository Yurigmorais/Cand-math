import { loadState, saveState } from './storage/persistence.js';
import { showScreen, goHub } from './ui/screenManager.js';
import { startMode, openTracks, escolherTrilha, MODOS } from './games/gameManager.js';
import { updateHubUI, startIdleMessages } from './ui/hubUI.js';
import { openShop, filterShop, buyItem, toggleEquip } from './ui/shopUI.js';
import { openModal, closeModal, closeAllModals } from './ui/modalManager.js';
import { setupParticleCanvas } from './effects/particles.js';
import { speakText, toggleSound } from './audio/soundManager.js';
import { handleTFAnswer } from './games/trueFalseGame.js';
import { checkPuzzle, giveHint, nextPuzzle } from './games/puzzleGame.js';
import { conferirBolo } from './games/fractionGame.js';
import { conferirBalanca } from './games/balanceGame.js';
import { fecharCompra } from './games/marketGame.js';
import { openParents, sairDosPais, conferirPin, recuperarPin, montarRelatorio,
         mudarAnoEscolar, salvarAjustesPais, exportarRelatorioPais,
         imprimirRelatorio, sairDaConta } from './ui/parentsUI.js';
import { G } from './state/gameState.js';
import { GRADES } from './data/curriculum.js';
import { showToast } from './ui/toastManager.js';
import { resetGameState } from './state/gameState.js';
import { $ } from './utils/dom.js';

// salva sozinho de tempos em tempos, sem a criança precisar pedir
setInterval(saveState, 15000);
window.triggerSave = saveState;

document.addEventListener('DOMContentLoaded', async () => {
  await loadState();

  const isGuest = sessionStorage.getItem('guest') === 'true';
  const hasProfile = G.profile && G.profile.childName;

  // Guardião de rota: sem perfil e sem visita, volta para a entrada
  if (!hasProfile && !isGuest) {
    window.location.href = '/login.html';
    return;
  }

  const saudacao = hasProfile ? `Olá, ${G.profile.childName}! Sou Juju Candy!` : 'Olá, Visitante! Sou Juju Candy!';
  const splashBubble = document.querySelector('.splash-jaguar-bubble');
  if (splashBubble) splashBubble.textContent = saudacao;

  showScreen('screenSplash');

  const btnPlay = $('btnPlay');
  if (btnPlay) {
    btnPlay.addEventListener('click', () => {
      showScreen('screenHub');
      updateHubUI();
      startIdleMessages();
    });
  }

  montarSeletorDeAno();
  setupParticleCanvas();
});

/** o seletor de ano das Configurações (o resto vem do cadastro) */
function montarSeletorDeAno() {
  const sel = $('settingGrade');
  if (!sel) return;
  sel.innerHTML = GRADES.map(g =>
    `<option value="${g.id}" ${g.id === Number(G.grade) ? 'selected' : ''}>${g.label}</option>`
  ).join('');
  sel.addEventListener('change', () => {
    G.grade = Number(sel.value);
    if (G.profile) G.profile.grade = G.grade;
    saveState();
    updateHubUI();
    showToast(`Prontinho: agora o jogo treina o ${G.grade}º ano.`);
  });
}

/** botão "jogar outra vez" da tela de rodada concluída */
window.jogarDeNovo = function() {
  closeModal('modalLevelUp');
  const modo = G.currentMode;
  if (modo && MODOS[modo]) startMode(modo);
};

/* ---------------------- exposto para os onclick do HTML ---------------------- */
window.goHub = goHub;
window.openTracks = openTracks;
window.escolherTrilha = escolherTrilha;
window.startMode = startMode;
window.openShop = openShop;
window.filterShop = filterShop;
window.buyItem = buyItem;
window.toggleEquip = toggleEquip;
window.openModal = openModal;
window.closeModal = closeModal;
window.closeAllModals = closeAllModals;
window.speakText = speakText;
window.toggleSound = toggleSound;
window.handleTFAnswer = handleTFAnswer;
window.checkPuzzle = checkPuzzle;
window.giveHint = giveHint;
window.nextPuzzle = nextPuzzle;
window.conferirBolo = conferirBolo;
window.conferirBalanca = conferirBalanca;
window.fecharCompra = fecharCompra;

window.openParents = openParents;
window.sairDosPais = sairDosPais;
window.conferirPin = conferirPin;
window.recuperarPin = recuperarPin;
window.montarRelatorio = montarRelatorio;
window.mudarAnoEscolar = mudarAnoEscolar;
window.salvarAjustesPais = salvarAjustesPais;
window.exportarRelatorioPais = exportarRelatorioPais;
window.imprimirRelatorio = imprimirRelatorio;
window.sairDaConta = sairDaConta;

// Enter no campo do PIN
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.activeElement === $('parentPinInput')) conferirPin();
});

window.toggleAutoTTS = function() {
  G.autoTTS = !G.autoTTS;
  saveState();
  pintarToggle('toggleTTSBtn', G.autoTTS);
};

window.toggleHighContrast = function() {
  G.highContrast = !G.highContrast;
  saveState();
  pintarToggle('toggleContrastBtn', G.highContrast);
  document.body.classList.toggle('high-contrast', G.highContrast);
};

window.toggleDyslexiaFont = function() {
  G.dyslexiaFont = !G.dyslexiaFont;
  saveState();
  pintarToggle('toggleFontBtn', G.dyslexiaFont);
  document.body.classList.toggle('dyslexia-font', G.dyslexiaFont);
};

/** animações ligadas/desligadas (criança que se distrai, ou tela que engasga) */
window.toggleMotion = function() {
  G.reduceMotion = !G.reduceMotion;
  saveState();
  pintarToggle('toggleMotionBtn', !G.reduceMotion);
  document.body.classList.toggle('reduce-motion', G.reduceMotion);
};

function pintarToggle(id, ligado) {
  const btn = $(id);
  if (!btn) return;
  btn.textContent = ligado ? 'Ativado' : 'Desativado';
  btn.className = ligado ? 'btn-toggle active' : 'btn-toggle';
}

// recomeçar tudo (pede confirmação e apaga o save local)
window.resetGame = function() {
  if (!confirm('Tem certeza? Todo o progresso será apagado!')) return;
  const perfil = G.profile;
  resetGameState();
  G.profile = perfil;                   // mantém o cadastro, zera o aprendizado
  closeAllModals();
  saveState();
  updateHubUI();
  showToast('Jogo reiniciado! Boa sorte!');
};
