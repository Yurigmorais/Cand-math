/**
 * Cliente Supabase (REST / PostgREST).
 *
 * Usa a API HTTP do Supabase em vez do SDK para não acrescentar dependência
 * ao bundle — o jogo continua leve e roda igual no Vite, na Vercel e no
 * Capacitor. Se as variáveis de ambiente não estiverem definidas, nada aqui
 * é chamado de verdade: `supabaseConfigured` fica false e a camada de dados
 * vira um no-op.
 *
 * Variáveis (Vercel: Project Settings → Environment Variables):
 *   VITE_SUPABASE_URL        https://xxxxxxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY   chave "anon" (pública, protegida por RLS)
 */

const RAW_URL = (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || '';
const ANON_KEY = (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || '';

export const SUPABASE_URL = String(RAW_URL).replace(/\/+$/, '');
export const supabaseConfigured = Boolean(SUPABASE_URL && ANON_KEY);

export const TABELAS = {
  profiles: 'profiles',
  sessions: 'sessions',
  attempts: 'attempts',
  skillProgress: 'skill_progress',
};

const TIMEOUT_MS = 6000;

function headers(extra = {}) {
  const h = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
  const token = getDeviceToken();
  if (token) h['X-Device-Token'] = token;
  return h;
}

/**
 * Token do aparelho: é o que segura o RLS na fase sem login.
 * Criado uma vez e guardado junto do save local.
 */
export function getDeviceToken() {
  const CHAVE = 'candymath_device_token';
  try {
    let t = localStorage.getItem(CHAVE);
    if (!t) {
      t = (crypto.randomUUID ? crypto.randomUUID() : `d${Date.now()}${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(CHAVE, t);
    }
    return t;
  } catch (e) {
    return null;
  }
}

async function request(path, method, body, queryString = '', prefer) {
  if (!supabaseConfigured) throw new Error('supabase não configurado');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}${queryString}`, {
      method,
      headers: headers(prefer ? { Prefer: prefer } : {}),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`http ${res.status}: ${txt.slice(0, 160)}`);
    }
    if (method === 'HEAD' || res.status === 204) return null;
    const ct = res.headers.get('content-type') || '';
    return ct.includes('json') ? res.json() : res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** insere linhas (append puro, usado pelo log de tentativas) */
export function insertRows(table, rows) {
  return request(table, 'POST', rows, '', 'return=minimal');
}

/** insere ou atualiza pelas chaves naturais (profiles, sessions, skill_progress) */
export function upsertRows(table, rows, onConflict) {
  const q = onConflict ? `?on_conflict=${onConflict}` : '';
  return request(table, 'POST', rows, q, 'resolution=merge-duplicates,return=minimal');
}

/** leitura simples; `filtros` vira query string do PostgREST (ex.: { profile_id: 'eq.abc' }) */
export function selectRows(table, filtros = {}, limites = {}) {
  const partes = [];
  Object.entries(filtros).forEach(([k, v]) => partes.push(`${k}=eq.${encodeURIComponent(v)}`));
  if (limites.order) partes.push(`order=${limites.order}`);
  if (limites.limit) partes.push(`limit=${limites.limit}`);
  const qs = partes.length ? `?${partes.join('&')}` : '';
  return request(table, 'GET', undefined, qs);
}
