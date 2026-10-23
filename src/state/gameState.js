/**
 * Estado global do jogo. Tudo que precisa ser salvo passa por aqui
 * e pelo mapa de campos de storage/persistence.js.
 */

export const ESTADO_INICIAL = {
  profile: null,          // { childName, childAge, grade, guardianName, guardianEmail, parentPin }
  stars: 0,
  phase: 1,
  totalCorrect: 0,
  totalAttempts: 0,
  streak: 0,
  bestStreak: 0,
  soundOn: true,
  autoTTS: false,
  highContrast: false,
  dyslexiaFont: false,
  reduceMotion: false,
  grade: 3,
  selectedTrack: 'mix',
  roundCorrect: 0,
  roundHints: 0,
  currentMode: null,
  currentQ: null,
  quizIndex: 0,
  raceIndex: 0,
  puzzleIndex: 0,
  equip: { hat: null, glasses: null, outfit: null, accessory: null },
  owned: [],
  xp: 0,
  level: 1,
  lastLoginDate: null,
  dailyQuests: [],
  // progresso pedagogico
  stats: { add: { c: 0, w: 0 }, sub: { c: 0, w: 0 }, mul: { c: 0, w: 0 }, div: { c: 0, w: 0 } },
  skillStats: {},         // { [skillId]: { c, w, bestMs, avgMs, lastSeen } }
  unitStats: {},          // { [unidade]: { c, w } }
  modeStats: {},          // { [modo]: { plays, correct, attempts } }
  attempts: [],           // log fino das ultimas tentativas (topes em MAX_ATTEMPTS)
  sessions: [],           // resumo por dia de jogo
};

export const MAX_ATTEMPTS = 400;
export const MAX_SESSIONS = 90;

export const G = { ...ESTADO_INICIAL };

export function resetGameState() {
  Object.keys(ESTADO_INICIAL).forEach(k => {
    G[k] = Array.isArray(ESTADO_INICIAL[k]) ? [] : (typeof ESTADO_INICIAL[k] === 'object' && ESTADO_INICIAL[k] ? { ...ESTADO_INICIAL[k] } : ESTADO_INICIAL[k]);
  });
  G.profile = null;
  G.skillStats = {};
  G.unitStats = {};
  G.modeStats = {};
}

/**
 * Registra uma tentativa respondida. É o dado bruto que a Área dos Pais lê
 * e que amanhã vira linha na tabela `attempts` do Supabase.
 */
export function registrarTentativa(q, acertou, ms, modo) {
  G.totalAttempts++;
  if (acertou) G.totalCorrect++;

  // missão diária de acertos vale para qualquer modo de jogo, não só o quiz
  if (acertou && Array.isArray(G.dailyQuests)) {
    G.dailyQuests.forEach(m => {
      if (m.type === 'correct_math' && !m.claimed && m.progress < m.target) m.progress++;
    });
  }

  if (q && q.skillId) {
    const st = G.skillStats[q.skillId] || { c: 0, w: 0, avgMs: 0, n: 0, lastSeen: null };
    if (acertou) st.c++; else st.w++;
    if (ms > 0) {
      st.avgMs = Math.round((st.avgMs * st.n + ms) / (st.n + 1));
      st.n++;
      st.bestMs = st.bestMs ? Math.min(st.bestMs, ms) : ms;
    }
    st.lastSeen = new Date().toISOString();
    G.skillStats[q.skillId] = st;
  }

  if (q && q.unidadeTematica) {
    const u = G.unitStats[q.unidadeTematica] || { c: 0, w: 0 };
    if (acertou) u.c++; else u.w++;
    G.unitStats[q.unidadeTematica] = u;
  }

  if (q && q.op && G.stats[q.op]) {
    if (acertou) G.stats[q.op].c++; else G.stats[q.op].w++;
  }

  if (modo) {
    const m = G.modeStats[modo] || { plays: 0, correct: 0, attempts: 0 };
    m.correct += acertou ? 1 : 0;
    m.attempts++;
    G.modeStats[modo] = m;
  }

  const hoje = localDate();
  const sessao = G.sessions.find(s => s.date === hoje);
  if (sessao) {
    sessao.attempts++;
    sessao.correct += acertou ? 1 : 0;
    if (q && q.skillId) sessao.skills[q.skillId] = (sessao.skills[q.skillId] || 0) + (acertou ? 1 : -1);
  } else {
    G.sessions.unshift({
      date: hoje,
      attempts: 1,
      correct: acertou ? 1 : 0,
      minutes: 0,
      skills: q && q.skillId ? { [q.skillId]: acertou ? 1 : -1 } : {},
    });
    if (G.sessions.length > MAX_SESSIONS) G.sessions.length = MAX_SESSIONS;
  }

  G.attempts.push({
    at: Date.now(),
    skill: q ? q.skillId : null,
    trilha: q ? q.trilhaId : null,
    unidade: q ? q.unidadeTematica : null,
    grade: q ? q.grade : G.grade,
    ok: !!acertou,
    ms: Math.max(0, Math.min(120000, Math.round(ms || 0))),
    modo,
    prompt: q ? q.prompt.slice(0, 90) : '',
    resposta: q ? q.answerText : '',
  });
  if (G.attempts.length > MAX_ATTEMPTS) {
    G.attempts.splice(0, G.attempts.length - MAX_ATTEMPTS);
  }
}

export function localDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
