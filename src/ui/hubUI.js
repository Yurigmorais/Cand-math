import { G } from '../state/gameState.js';
import { SHOP_ITEMS } from '../data/shopItems.js';
import { MSGS } from '../data/messages.js';
import { pick } from '../engine/questionGenerator.js';
import { TRACKS_BY_ID, MIX_TRACK, GRADES } from '../data/curriculum.js';
import { $ } from '../utils/dom.js';
import { saveState } from '../storage/persistence.js';
import { playSound } from '../audio/soundManager.js';

let idleTimer = null;

export function updateHubUI() {
  $('hubStars').textContent = G.stars;
  $('hubPhase').textContent = G.phase;

  // faixa da trilha escolhida (troca no modal de trilhas)
  const t = G.selectedTrack === 'mix' ? MIX_TRACK : (TRACKS_BY_ID[G.selectedTrack] || MIX_TRACK);
  const perfil = GRADES.find(g => g.id === Number(G.grade)) || GRADES[2];
  const icone = $('hubTrilhaIcon');
  if (icone) icone.innerHTML = `<i class="fa-solid ${t.icon}"></i>`;
  if ($('hubTrilhaNome')) $('hubTrilhaNome').textContent = t.nome;
  if ($('hubTrilhaSub')) $('hubTrilhaSub').textContent = `${t.sub} · ${perfil.label}`;
  
  // Update XP
  const xpNeeded = G.level * 100;
  const xpPercent = Math.min(100, Math.max(0, (G.xp / xpNeeded) * 100));
  const xpFill = $('hubXpFill');
  const xpText = $('hubXpText');
  if (xpFill && xpText) {
    xpFill.style.width = `${xpPercent}%`;
    xpText.textContent = `Lvl ${G.level}`;
  }

  // Update Streak
  const streakVal = $('hubStreak');
  const streakStat = $('hubStreakStat');
  if (streakVal && streakStat) {
    streakVal.textContent = G.streak;
    if (G.streak > 0) {
      streakStat.classList.add('active');
      streakStat.style.filter = 'none';
      streakStat.style.color = '#ff5722';
    } else {
      streakStat.classList.remove('active');
      streakStat.style.filter = 'grayscale(1)';
      streakStat.style.color = '#666';
    }
  }

  // Jaguar accessories
  applyEquipToEl('kHat',   'hat');
  applyEquipToEl('kGlass', 'glasses');
  applyEquipToEl('kOutfit','outfit');
  applyEquipToEl('kAcc',   'accessory');
}

/** placar por modo de jogo, no modal de recordes */
const NOMES_MODO = {
  quiz: 'Quiz Doce', falling: 'Chuva de Doces', race: 'Corrida Doce',
  tf: 'V ou F', memory: 'Memória Doce', puzzle: 'Cruzadinha',
  fraction: 'Fatia de Bolo', balance: 'Balança', market: 'Mercadinho',
};
export function renderRecordsExtras() {
  const box = $('recTrilhas');
  if (!box) return;
  const chaves = Object.keys(G.modeStats || {});
  if (!chaves.length) {
    box.innerHTML = '<p class="pl-vazio" style="text-align:center">Jogue um pouquinho e seu placar aparece aqui.</p>';
    return;
  }
  box.innerHTML = chaves.map(m => {
    const s = G.modeStats[m] || {};
    const plays = s.plays || 0;
    const tentativas = s.attempts || 0;
    const pct = tentativas ? Math.round((s.correct / tentativas) * 100) : 0;
    return `<div class="rt-chip"><b>${NOMES_MODO[m] || m}</b>`
      + `<span>${plays} partida(s)</span>`
      + `<span>${tentativas} resposta(s)</span>`
      + `<span>${pct}% de acerto</span></div>`;
  }).join('');
}

export function renderQuests() {
  const container = $('questsList');
  if (!container) return;
  
  container.innerHTML = '';
  if (!G.dailyQuests || G.dailyQuests.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#666;">Sem missões hoje!</p>';
    return;
  }

  G.dailyQuests.forEach((q, index) => {
    const isDone = q.progress >= q.target;
    const pct = Math.min(100, (q.progress / q.target) * 100);
    
    let btnHtml = '';
    if (q.claimed) {
      btnHtml = `<div style="color:var(--green); font-weight:bold; font-family:'Luckiest Guy', cursive;"><i class="fa-solid fa-check"></i> Resgatado</div>`;
    } else if (isDone) {
      btnHtml = `<button class="btn-claim" onclick="claimQuest(${index})">Resgatar</button>`;
    } else {
      btnHtml = `<div>${q.progress}/${q.target}</div>`;
    }

    const html = `
      <div class="quest-item ${q.claimed ? 'completed' : ''}">
        <div class="quest-info">
          <span>${q.desc}</span>
          <span class="quest-reward">+${q.reward}<i class="fa-solid fa-star"></i></span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div class="quest-prog-bar" style="flex:1; margin-right:12px;">
            <div class="quest-prog-fill" style="width:${pct}%"></div>
            <div class="quest-prog-text">${pct.toFixed(0)}%</div>
          </div>
          ${btnHtml}
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
  });
}

window.claimQuest = function(index) {
  const q = G.dailyQuests[index];
  if (!q || q.claimed || q.progress < q.target) return;
  
  q.claimed = true;
  G.stars += q.reward;
  saveState();
  playSound('buy');
  updateHubUI();
  renderQuests();
};

export function applyEquipToEl(elId, slot) {
  const item = G.equip[slot] ? SHOP_ITEMS.find(i=>i.id===G.equip[slot]) : null;
  const el = $(elId);
  if (item) {
    const col = item.iconColor || 'inherit';
    el.innerHTML = `<i class="fa-solid ${item.icon}" style="color:${col}"></i>`;
  } else {
    el.innerHTML = '';
  }
}

export function startIdleMessages() {
  clearTimeout(idleTimer);
  function setMsg() {
    $('jaguarSpeech').textContent = pick(MSGS.idle);
    idleTimer = setTimeout(setMsg, 5000);
  }
  idleTimer = setTimeout(setMsg, 3000);
}

export function jaguarSpeak(msg) {
  $('jaguarSpeech').textContent = msg;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(startIdleMessages, 4000);
}

/** para os minigames pararem de falar com a criança enquanto joga */
export function clearIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = null;
}
