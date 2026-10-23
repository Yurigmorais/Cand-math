/**
 * Camada de dados do jogo.
 *
 * Hoje: o save local (IndexedDB/Preferences) é a fonte da verdade e o jogo
 * funciona 100% offline.
 * Amanhã: as mesmas estruturas viram linhas no Supabase, porque os nomes de
 * campo já batem 1:1 com supabase/schema.sql (profiles, sessions, attempts,
 * skill_progress).
 *
 * Regras de ouro:
 *  - sem VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY = nenhuma chamada de rede;
 *  - erro de rede nunca atrapalha a partida: o lote volta para uma fila no
 *    armazenamento local e é reenviado quando a conexão voltar;
 *  - nada de dado de criança em texto claro para a rede além do necessário
 *    (o PIN dos pais só viaja como hash).
 */
import {
  supabaseConfigured, getDeviceToken, insertRows, upsertRows, selectRows, TABELAS,
} from './supabaseClient.js';

const FILA_KEY = 'candymath_sync_queue_v1';
const CURSOR_KEY = 'candymath_sync_cursor_v1';
const MAX_FILAS = 40;
const AGUARDAR_MS = 3500;

let timer = null;
let enviando = false;

export function remotoAtivo() {
  return supabaseConfigured;
}

/* ------------------------------------------------------------------ helpers */

function lerLocal(chave, padrao) {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? JSON.parse(bruto) : padrao;
  } catch (e) {
    return padrao;
  }
}

function gravarLocal(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) { /* cota cheia */ }
}

/** hash curto só para não expor o PIN na rede (o portão local usa o valor salvo no aparelho) */
function hashPin(pin) {
  const s = String(pin || '');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

function mastery(c, w) {
  if (c + w === 0) return 0;
  return Number((((c + 0.5) / (c + w + 1))).toFixed(4));
}

/* ------------------------------------------------------------- montagem dos lotes */

function linhaProfile(payload, profileId) {
  const p = payload.profile || {};
  return {
    id: profileId,
    device_token: getDeviceToken(),
    child_name: p.childName || '',
    child_age: Number(p.childAge) || null,
    grade: Number(payload.grade || p.grade) || 3,
    guardian_name: p.guardianName || '',
    guardian_email: p.guardianEmail || '',
    parent_pin_hash: hashPin(p.parentPin),
    stars: Number(payload.stars) || 0,
    xp: Number(payload.xp) || 0,
    level: Number(payload.level) || 1,
    phase: Number(payload.phase) || 1,
    streak: Number(payload.streak) || 0,
    best_streak: Number(payload.bestStreak) || 0,
    total_correct: Number(payload.totalCorrect) || 0,
    total_attempts: Number(payload.totalAttempts) || 0,
    selected_track: payload.selectedTrack || 'mix',
    settings: {
      soundOn: !!payload.soundOn,
      autoTTS: !!payload.autoTTS,
      highContrast: !!payload.highContrast,
      dyslexiaFont: !!payload.dyslexiaFont,
      reduceMotion: !!payload.reduceMotion,
    },
    last_login_date: payload.lastLoginDate || null,
    updated_at: new Date().toISOString(),
  };
}

function linhasHabilidades(payload, profileId) {
  const stats = payload.skillStats || {};
  return Object.keys(stats).map((id) => {
    const st = stats[id] || {};
    const c = st.c || 0, w = st.w || 0;
    return {
      profile_id: profileId,
      skill_id: id,
      correct: c,
      wrong: w,
      n: st.n || (c + w),
      avg_ms: Math.round(st.avgMs || 0),
      best_ms: Math.round(st.bestMs || 0),
      mastery: mastery(c, w),
      last_seen: st.lastSeen || new Date().toISOString(),
    };
  });
}

function linhasSessoes(payload, profileId) {
  return (payload.sessions || []).map((s) => ({
    profile_id: profileId,
    day: s.date,
    attempts: s.attempts || 0,
    correct: s.correct || 0,
    minutes: s.minutes || 0,
    skills: s.skills || {},
  }));
}

function linhasTentativas(payload, profileId, cursor) {
  return (payload.attempts || [])
    .filter((a) => a && Number(a.at) > cursor)
    .map((a) => ({
      profile_id: profileId,
      answered_at: new Date(a.at).toISOString(),
      skill_id: a.skill || null,
      trilha_id: a.trilha || null,
      unidade: a.unidade || null,
      grade: a.grade || null,
      ok: !!a.ok,
      ms: a.ms || 0,
      mode: a.modo || null,
      prompt: a.prompt || '',
      answer_text: a.resposta || '',
    }));
}

function montarLote(payload) {
  const profileId = payload.profile ? (getDeviceToken() || 'sem-id') : null;
  if (!profileId) return null;
  const cursor = Number(lerLocal(CURSOR_KEY, 0));
  const tentativas = linhasTentativas(payload, profileId, cursor);
  const ultimoAt = (payload.attempts || []).reduce((m, a) => Math.max(m, Number(a.at) || 0), cursor);

  const operacoes = [];
  operacoes.push({ tipo: 'upsert', tabela: TABELAS.profiles, rows: [linhaProfile(payload, profileId)], onConflict: 'id' });

  const hab = linhasHabilidades(payload, profileId);
  if (hab.length) operacoes.push({ tipo: 'upsert', tabela: TABELAS.skillProgress, rows: hab, onConflict: 'profile_id,skill_id' });

  const sess = linhasSessoes(payload, profileId);
  if (sess.length) operacoes.push({ tipo: 'upsert', tabela: TABELAS.sessions, rows: sess, onConflict: 'profile_id,day' });

  if (tentativas.length) {
    operacoes.push({ tipo: 'insert', tabela: TABELAS.attempts, rows: tentativas.slice(-120), cursor: ultimoAt });
  }
  return { feito: false, cursorEm: ultimoAt, operacoes };
}

/* ------------------------------------------------------------------- envio */

async function executar(op) {
  if (op.tipo === 'upsert') return upsertRows(op.tabela, op.rows, op.onConflict);
  return insertRows(op.tabela, op.rows);
}

/**
 * Ponto de entrada chamado por storage/persistence.js a cada saveState().
 * Não bloqueia o jogo: só agenda e trata erros.
 */
export function queueRemoteSync(payload) {
  if (!supabaseConfigured || !payload || !payload.profile) return;
  try {
    const lote = montarLote(payload);
    if (!lote) return;
    const fila = lerLocal(FILA_KEY, []);
    // guarda apenas o lote mais recente por perfil (evita fila duplicada)
    fila.push(lote);
    while (fila.length > MAX_FILAS) fila.shift();
    gravarLocal(FILA_KEY, fila);
  } catch (e) {
    return;
  }
  clearTimeout(timer);
  timer = setTimeout(() => { flushQueue().catch(() => {}); }, AGUARDAR_MS);
}

/** envia o que estiver na fila; para no primeiro erro para não perder dados */
export async function flushQueue() {
  if (!supabaseConfigured || enviando) return { ok: false, pendente: 0 };
  enviando = true;
  let fila = lerLocal(FILA_KEY, []);
  let enviados = 0;
  try {
    while (fila.length) {
      const lote = fila[0];
      try {
        for (const op of (lote.operacoes || [])) await executar(op);
        if (lote.cursorEm) gravarLocal(CURSOR_KEY, lote.cursorEm);
        fila.shift();
        enviados++;
        gravarLocal(FILA_KEY, fila);
      } catch (erro) {
        // rede fora do ar / tabela ainda não criada: mantém na fila para a próxima tentativa
        break;
      }
    }
    return { ok: fila.length === 0, pendente: fila.length, enviados };
  } finally {
    enviando = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', onOnline);
      window.addEventListener('online', onOnline, { once: true });
    }
  }
}

function onOnline() {
  flushQueue().catch(() => {});
}

/** usado pela Área dos Pais quando o banco estiver ligado (multi-aparelho no futuro) */
export async function pullProgress() {
  if (!supabaseConfigured) return null;
  const token = getDeviceToken();
  if (!token) return null;
  try {
    const [perfis, hab, sess] = await Promise.all([
      selectRows(TABELAS.profiles, { device_token: token }),
      selectRows(TABELAS.skillProgress, { profile_id: token }),
      selectRows(TABELAS.sessions, { profile_id: token }, { order: 'day.desc', limit: 30 }),
    ]);
    return { profile: (perfis && perfis[0]) || null, skillProgress: hab || [], sessions: sess || [] };
  } catch (e) {
    return null;
  }
}

/** estado da fila, para diagnóstico em console / tela de depuração */
export function syncStatus() {
  return {
    configurado: supabaseConfigured,
    pendentes: (lerLocal(FILA_KEY, []) || []).length,
    cursor: Number(lerLocal(CURSOR_KEY, 0)),
    dispositivo: getDeviceToken(),
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', onOnline);
  document.addEventListener && document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flushQueue().catch(() => {});
  });
  // primeira tentativa logo ao abrir o jogo
  setTimeout(() => { flushQueue().catch(() => {}); }, 4000);
  window.candySync = { status: syncStatus, flush: flushQueue, pull: pullProgress };
}
