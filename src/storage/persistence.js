import { saveData, loadData, removeData } from './storageAdapter.js';
import { G, localDate, MAX_ATTEMPTS, MAX_SESSIONS } from '../state/gameState.js';
import { $ } from '../utils/dom.js';
import { queueRemoteSync } from '../services/dataService.js';

const SAVE_KEY = 'candymath_v4';
const GUEST_KEY = 'candymath_guest';
const LEGACY_KEYS = ['candymath_v3', 'candymath_v2'];

function isGuestSession() {
  return sessionStorage.getItem('guest') === 'true';
}

function currentKey() {
  return isGuestSession() ? GUEST_KEY : SAVE_KEY;
}

export function clearGuestData() {
  return removeData(GUEST_KEY);
}

/** tudo que é persistido — manter em um lugar só evita campo esquecido */
const CAMPOS = [
  'profile', 'stars', 'phase', 'totalCorrect', 'totalAttempts', 'streak', 'bestStreak',
  'soundOn', 'autoTTS', 'highContrast', 'dyslexiaFont', 'reduceMotion',
  'grade', 'selectedTrack', 'equip', 'owned', 'puzzleIndex',
  'xp', 'level', 'lastLoginDate', 'dailyQuests',
  'stats', 'skillStats', 'unitStats', 'modeStats', 'attempts', 'sessions',
];

export async function saveState() {
  const payload = { version: 4, lastSaved: Date.now() };
  CAMPOS.forEach(c => { payload[c] = G[c]; });
  await saveData(currentKey(), payload);
  // sobe para o Supabase quando configurado; sem chave no ambiente é um no-op silencioso
  queueRemoteSync(payload);
  return payload;
}

function gerarMissoes(grade) {
  const alvo = grade <= 3 ? 10 : grade <= 6 ? 14 : 18;
  const modelos = [
    { tipo: 'play_any', alvo: 3, recompensa: 20, texto: 'Jogue 3 partidas de qualquer jogo' },
    { tipo: 'correct_math', alvo, recompensa: 30, texto: `Acerte ${alvo} contas` },
    { tipo: 'play_falling', alvo: 2, recompensa: 20, texto: 'Jogue Chuva de Doces 2 vezes' },
    { tipo: 'play_quiz', alvo: 2, recompensa: 20, texto: 'Jogue Quiz Doce 2 vezes' },
    { tipo: 'play_race', alvo: 1, recompensa: 20, texto: 'Vença 1 Corrida Doce' },
    { tipo: 'play_tf', alvo: 2, recompensa: 20, texto: 'Jogue Verdadeiro ou Falso 2 vezes' },
    { tipo: 'play_memory', alvo: 1, recompensa: 25, texto: 'Complete 1 partida de Memória Doce' },
    { tipo: 'play_puzzle', alvo: 1, recompensa: 25, texto: 'Resolva 1 Cruzadinha de Doces' },
    { tipo: 'play_market', alvo: 1, recompensa: 25, texto: 'Ajude a Juju no Mercadinho 1 vez' },
    { tipo: 'play_fraction', alvo: 1, recompensa: 25, texto: 'Monte 1 Fatia de Bolo' },
    { tipo: 'play_balance', alvo: 1, recompensa: 25, texto: 'Equilibre a Balança da Juju 1 vez' },
    { tipo: 'no_hint', alvo: 1, recompensa: 30, texto: 'Ganhe uma rodada sem usar dica' },
  ];
  // embaralha e fica com 3
  const copia = modelos.slice().sort(() => Math.random() - 0.5);
  return copia.slice(0, 3).map((m, i) => ({
    id: i + 1,
    type: m.tipo,
    target: m.alvo,
    progress: 0,
    reward: m.recompensa,
    desc: m.texto,
    claimed: false,
  }));
}

function verificarDiario() {
  const hoje = localDate();
  if (G.lastLoginDate === hoje) return;

  if (G.lastLoginDate) {
    const [ly, lm, ld] = G.lastLoginDate.split('-').map(Number);
    const [cy, cm, cd] = hoje.split('-').map(Number);
    const diff = Math.round((new Date(cy, cm - 1, cd) - new Date(ly, lm - 1, ld)) / 86400000);
    if (diff === 1) {
      G.streak++;
      if (G.streak > G.bestStreak) G.bestStreak = G.streak;
    } else if (diff > 1) {
      G.streak = 1;
    }
  } else {
    G.streak = 1;
  }

  G.lastLoginDate = hoje;
  G.dailyQuests = gerarMissoes(G.grade || 3);
  saveState();
}

export async function loadState() {
  const key = currentKey();
  let data = await loadData(key);

  // migração das versões anteriores do save local
  if (!data && !isGuestSession()) {
    for (const antiga of LEGACY_KEYS) {
      let legado = null;
      try {
        legado = await loadData(antiga);
        if (!legado) legado = JSON.parse(localStorage.getItem(antiga) || 'null');
      } catch (e) { legado = null; }
      if (legado) {
        data = legado;
        await saveData(SAVE_KEY, { ...legado, version: 4, lastSaved: Date.now() });
        break;
      }
    }
  }

  if (data) {
    CAMPOS.forEach(c => {
      if (data[c] !== undefined && data[c] !== null) G[c] = data[c];
    });
    G.soundOn = data.soundOn !== undefined ? data.soundOn : true;
  }

  // garante containers
  ['stats', 'skillStats', 'unitStats', 'modeStats'].forEach(o => { if (!G[o]) G[o] = {}; });
  if (!G.stats.add) G.stats = { add: { c: 0, w: 0 }, sub: { c: 0, w: 0 }, mul: { c: 0, w: 0 }, div: { c: 0, w: 0 } };
  if (!Array.isArray(G.attempts)) G.attempts = [];
  if (!Array.isArray(G.sessions)) G.sessions = [];
  if (!Array.isArray(G.owned)) G.owned = [];
  if (G.attempts.length > MAX_ATTEMPTS) G.attempts = G.attempts.slice(-MAX_ATTEMPTS);
  if (G.sessions.length > MAX_SESSIONS) G.sessions = G.sessions.slice(0, MAX_SESSIONS);

  if (G.profile && G.profile.grade) G.grade = Number(G.profile.grade) || G.grade;

  aplicarPreferencias();

  if (G.profile || isGuestSession()) verificarDiario();
  return data;
}

export function aplicarPreferencias() {
  const sIcon = $('soundIcon');
  if (sIcon) sIcon.className = G.soundOn ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';

  document.body.classList.toggle('high-contrast', !!G.highContrast);
  document.body.classList.toggle('dyslexia-font', !!G.dyslexiaFont);
  document.body.classList.toggle('reduce-motion', !!G.reduceMotion);

  const mapa = [
    ['toggleSoundBtn', G.soundOn, 'Ativado', 'Desativado'],
    ['toggleTTSBtn', G.autoTTS, 'Ativado', 'Desativado'],
    ['toggleContrastBtn', G.highContrast, 'Ativado', 'Desativado'],
    ['toggleFontBtn', G.dyslexiaFont, 'Ativado', 'Desativado'],
    ['toggleMotionBtn', !G.reduceMotion, 'Ativado', 'Desativado'],
  ];
  mapa.forEach(([id, ligado, on, off]) => {
    const btn = $(id);
    if (!btn) return;
    btn.textContent = ligado ? on : off;
    btn.className = ligado ? 'btn-toggle active' : 'btn-toggle';
  });
}
