/* ===================================================
   CANDY MATH — nuvem.js
   A conta do responsável, a verificação de e-mail, a subida do progresso e
   as salas do duelo. Tudo aqui é opcional por construção:

   · sem CM_CONFIG preenchido → nada acontece além de uma tela explicando o
     que falta. O jogo continua inteiro no aparelho, offline, sem pedir nada
     a ninguém.
   · com config, sem internet → cada chamada falha avisando, nunca sumindo;
     o progresso local segue em localStorage como sempre esteve.
   · com config e internet    → login de responsável com e-mail verificado,
     vínculo com a criança por código de 6 letras, histórico sincronizado e
     sala por código para o duelo em aparelhos diferentes.

   Nenhuma chave é inventada aqui: quem publica cola a chave do próprio
   projeto em config.js. Nada sobe antes de o adulto registrar a criança.
   =================================================== */
(function (root) {
'use strict';

const CHAVE_ID_APARELHO = 'candymath_id_aparelho';
// 10 letras: o antigo código de 6 (31^6 ≈ 885 mil) era pouco contra alguém
// martelando a API, e ele abre a porta do boletim de uma criança.
const TAMANHO_CODIGO = 10;
const CODE_MINIMO = 6;      // códigos de seis letras já emitidos continuam válidos
const CODE_MAXIMO = 24;
// Sem as letras que se confundem quando alguém copia o código à mão.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const FORMA_CODIGO = new RegExp('^[' + ALFABETO + ']{' + CODE_MINIMO + ',' + CODE_MAXIMO + '}$');
// A biblioteca vem de CDN, mas só de origens que este arquivo conhece. Sem
// essa lista, um config.js copiado de qualquer lugar viraria um jeito de
// rodar JavaScript arbitrário dentro do jogo.
const ORIGENS_BIBLIOTECA = ['https://cdn.jsdelivr.net/'];
// Tipos de lance que o duelo conhece. Qualquer outro é jogado fora antes de
// chegar na tela — o outro lado é um usuário, não uma fonte confiável.
const TIPOS_DE_LANCE = ['duelo:partida', 'duelo:acerto', 'duelo:passada'];
// O que cada lance pode carregar, em bytes. O banco confere de novo; conferir
// aqui evita subir lixo e estourar a partida com um erro de rede. A densidade
// máxima do duelo é 80 contas, e é esse o teto que casa com registrar_jogada.
const LIMITE_LANCE_BYTES = 60000;
// A URL do projeto vem do painel do Supabase sem barra no fim
// ("https://abcd.supabase.co"), então o padrão não pode exigir uma.
const PADRAO_BANCO = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)(\/[^\s]*)?$/i;

const N = {
  cliente: null,        // cliente do supabase-js, só existe com config válida
  sessao: null,         // sessão devolvida pelo banco (null = sem login)
  pendente: null,       // {email} de quem criou conta e ainda não clicou no link
  recado: null,         // {painel, texto, tipo} — sobrevive à repintura da tela
  erro: '',             // último erro visto por quem acompanha
  aoMudar: [],          // funções que redrawem a tela da conexão
  subida: null,         // timer do debounce da sincronização
  sala: null,           // transporte da sala em uso agora
  canal: null,          // canal Realtime da sala
  varredura: null,      // intervalo de segurança quando o Realtime não pega
  porSegundo: false,    // true = estamos varrendo em vez de escutar
  vistoUltimamente: 0,  // carimbo da última jogada recebida
  nublado: false,       // true enquanto uma exclusão de conta está em curso
  redefinir: false,     // true quando o link de "esqueci a senha" acabou de chegar
};

// G é const no script.js: mora no escopo global, mas não aparece em window.
// O try/catch é o que segura o antes-do-script-carregar — referência a const
// em TDZ estoura, e aí a nuvem segue a vida sem estado, offline.
function estado() { try { return G; } catch (e) { return null; } }

// ── 1. CONFIGURAÇÃO ─────────────────────────────────────
// Vazio, "coloque-aqui" ou URL que nem parece banco conta como não
// configurado: é melhor o jogo se declarar offline do que bater numa porta
// inventada.
function config() {
  const c = root.CM_CONFIG || {};
  const url = String(c.supabaseUrl || '').trim();
  const chave = String(c.supabaseAnonKey || '').trim();
  const valido = PADRAO_BANCO.test(url) && chave.length > 20 && !/coloque|preencha|sua-?chave/i.test(chave);
  return { url: url, chave: chave, valido: valido, bruto: c };
}

function ativa() { return !!(config().valido && N.cliente); }

// O interruptor do duelo em rede. Fica desligado até que as políticas de
// autorização do banco estejam aplicadas E conferidas no projeto de quem
// publica — ver SEGURANCA.md. Não é para "funcionar de novo" que ele existe.
function dueloLiberado() {
  const c = config().bruto || {};
  return c.dueloRedeHabilitado === true && ativa() && logado();
}

function motivoDoBloqueio() {
  const c = config().bruto || {};
  if (c.dueloRedeHabilitado !== true) return 'desativado por segurança';
  if (!ativa()) return 'sem conexão configurada';
  if (!logado()) return 'sem conta autenticada';
  return '';
}

// Um sorteio que não é previsível: o código da sala e o de vínculo abrem
// dados, então Math.random() (que é reconstruível) não serve.
function aoAcaso(n) {
  const bytes = new Uint8Array(n);
  if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(bytes);
  else for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

function logado() { return !!(N.sessao && N.sessao.user); }
function verificado() {
  const u = N.sessao && N.sessao.user;
  if (!u) return false;
  return !!(u.email_confirmed_at || u.confirmed_at);
}
// Criar conta com confirmação de e-mail não devolve sessão. Sem esta memória
// o navegador acha que ninguém tem conta, a tela volta para "Criar conta" e a
// pessoa recomeça o cadastro para sempre - o e-mail já existe, e o banco
// responde a isso com um erro que não explica nada.
function aVerificar() { return !logado() && !!(N.pendente && N.pendente.email); }
function emailPendente() {
  const u = N.sessao && N.sessao.user;
  return (u && u.email) || (N.pendente && N.pendente.email) || '';
}
// Só há sincronização depois de registrar a criança: é o consentimento do
// adulto traduzido em estado. Antes disso o jogo inteiro fica local.
function vinculada() {
  const g = estado();
  return !!(g && g.codigoVinculo);
}

function idAparelho() {
  try {
    let v = localStorage.getItem(CHAVE_ID_APARELHO);
    if (!v) {
      v = 'ap-' + Array.from(aoAcaso(5)).map((b) => b.toString(36).padStart(2, '0')).join('');
      localStorage.setItem(CHAVE_ID_APARELHO, v);
    }
    return v;
  } catch (e) { return 'ap-descartavel'; }
}

// Amostragem sem viés: o alfabeto tem 31 letras, e 256 não divide por 31.
// Bytes acima de 248 são descartados em vez de torcidos pelo resto da divisão.
function codigoDe(n) {
  const limite = 31 * 8;
  let out = '';
  let pool = [];
  while (out.length < n) {
    if (!pool.length) pool = Array.from(aoAcaso(Math.max(n * 2, 16)));
    const b = pool.shift();
    if (b >= limite) continue;
    out += ALFABETO[b % 31];
  }
  return out;
}

function mensagemDe(e) {
  if (!e) return 'erro desconhecido';
  if (typeof e === 'string') return traduzErro(e);
  return traduzErro(e.message || e.error_description || e.msg || 'erro inesperado');
}

/* "Failed to fetch" é o navegador dizendo que a requisição não chegou a lugar
   nenhum. É o que aparece quando o Project URL do config.js está errado (ou
   quando o avião decolou), e a frase sozinha não diz o que fazer com ela. */
function traduzErro(m) {
  const t = String(m || '');
  if (/failed to fetch|networkerror|network request failed|load failed|net::err/i.test(t)) {
    return 'o banco não respondeu. Confira o Project URL no config.js e a sua conexão. (detalhe: ' + t + ')';
  }
  if (/invalid login credentials|incorrect password|invalid password/i.test(t)) {
    return 'e-mail e senha não batem. Se a senha esquecida for o caso, use "Não lembro a senha".';
  }
  return t;
}

// A biblioteca chega por CDN apenas quando faz diferença. Abrir o jogo do
// disco, sem chave, não baixa nada de fora.
function carregarBiblioteca() {
  if (root.supabase && root.supabase.createClient) return Promise.resolve();
  const bruto = String(config().bruto.supabaseJs ||
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js');
  const destino = bruto.trim();
  const deOutraOrigem = /^https?:\/\//i.test(destino);
  if (deOutraOrigem && !ORIGENS_BIBLIOTECA.some((o) => destino.indexOf(o) === 0)) {
    N.erro = 'a biblioteca do banco só pode vir de uma origem confiável';
    return Promise.reject(new Error(N.erro));
  }
  if (!deOutraOrigem && /^(javascript:|data:|file:)/i.test(destino)) {
    N.erro = 'endereço da biblioteca não aceito';
    return Promise.reject(new Error(N.erro));
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = destino;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('não foi possível carregar a biblioteca do banco'));
    document.head.appendChild(s);
  });
}

async function montarCliente() {
  const cfg = config();
  if (!cfg.valido) { N.erro = 'sem chave configurada'; return null; }
  if (N.cliente) return N.cliente;
  try {
    await carregarBiblioteca();
    if (!root.supabase || !root.supabase.createClient) throw new Error('biblioteca indisponível');
    N.cliente = root.supabase.createClient(cfg.url, cfg.chave, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 8 } },
    });
    N.erro = '';
    return N.cliente;
  } catch (e) {
    N.cliente = null;
    N.erro = mensagemDe(e);
    return null;
  }
}

// ── 2. CONTA E VERIFICAÇÃO ──────────────────────────────
async function registrar(dados) {
  await montarCliente();
  if (!N.cliente) return { ok: false, erro: N.erro || 'conexão não configurada' };
  try {
    const { data, error } = await N.cliente.auth.signUp({
      email: dados.email,
      password: dados.senha,
      options: { data: { apelido: dados.apelido } },
    });
    if (error) return { ok: false, erro: mensagemDe(error) };
    N.sessao = data.session || null;
    // Sem sessão quer dizer "falta o clique no e-mail". Guardamos o endereço
    // para a tela de verificação poder mostrar o reenvio em vez de devolver a
    // pessoa ao formulário de cadastro.
    N.pendente = data.session ? null : { email: dados.email };
    if (data.user) await criarPerfil(data.user, dados.apelido);
    avisouMudanca();
    return { ok: true, precisaVerificar: !data.session, email: dados.email };
  } catch (e) {
    return { ok: false, erro: mensagemDe(e) };
  }
}

async function entrar(email, senha) {
  await montarCliente();
  if (!N.cliente) return { ok: false, erro: N.erro || 'conexão não configurada' };
  try {
    const { data, error } = await N.cliente.auth.signInWithPassword({ email: email, password: senha });
    if (error) {
      // Conta criada e não confirmada responde com erro de credencial, que leva
      // a pessoa a tentar senha errada para sempre. É a verificação que falta:
      // mostramos a tela dela.
      const msg = mensagemDe(error);
      if (/not confirmed|não confirmad|unconfirmed|verify your email/i.test(msg + ' ' + String(error.code || ''))) {
        N.pendente = { email: email };
        avisouMudanca();
        return { ok: false, verificar: true, erro: 'falta confirmar o e-mail' };
      }
      return { ok: false, erro: msg };
    }
    N.sessao = data.session || null;
    N.pendente = null;
    // O cadastro com confirmação de e-mail não devolve sessão: o perfil nasce
    // aqui, na primeira entrada depois de verificar. Sem essa linha a criança
    // não tem para onde apontar a FK e o registro quebra silenciosamente.
    if (data.session && data.session.user) {
      await criarPerfil(data.session.user, (data.session.user.user_metadata || {}).apelido);
    }
    avisouMudanca();
    return { ok: true, verificado: verificado() };
  } catch (e) {
    return { ok: false, erro: mensagemDe(e) };
  }
}

// Esqueci a senha: o link sai do banco e volta para cá com a sessão de
// recuperação no endereço (#redefinir-senha). O supabase-js já sabe ler esse
// pedaço da URL; o que falta é a tela que pede a senha nova.
async function recuperar(email) {
  await montarCliente();
  if (!N.cliente) return { ok: false, erro: N.erro || 'conexão não configurada' };
  try {
    const destino = root.location
      ? root.location.origin + root.location.pathname + '#redefinir-senha'
      : undefined;
    const { error } = await N.cliente.auth.resetPasswordForEmail(email, { redirectTo: destino });
    if (error) return { ok: false, erro: mensagemDe(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: mensagemDe(e) };
  }
}

async function redefinirSenha(senha) {
  await montarCliente();
  if (!N.cliente) return { ok: false, erro: N.erro || 'conexão não configurada' };
  if (!senha || senha.length < 6) return { ok: false, erro: 'a senha precisa de pelo menos 6 caracteres' };
  try {
    const { error } = await N.cliente.auth.updateUser({ password: senha });
    if (error) return { ok: false, erro: mensagemDe(error) };
    N.redefinir = false;
    avisouMudanca();
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: mensagemDe(e) };
  }
}

async function sair() {
  try { if (N.cliente) await N.cliente.auth.signOut(); } catch (e) {}
  N.sessao = null;
  N.pendente = null;
  N.redefinir = false;
  N.recado = null;
  avisouMudanca();
}

async function reenviar(email) {
  await montarCliente();
  if (!N.cliente) return { ok: false, erro: 'conexão não configurada' };
  try {
    const { error } = await N.cliente.auth.resend({ type: 'signup', email: email });
    if (error) return { ok: false, erro: mensagemDe(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: mensagemDe(e) };
  }
}

async function lerSessao() {
  if (!N.cliente) return;
  try {
    const { data } = await N.cliente.auth.getSession();
    N.sessao = data && data.session ? data.session : null;
    // Sessão viva apaga a memória da verificação pendente: o clique aconteceu.
    if (N.sessao) N.pendente = null;
  } catch (e) {
    N.sessao = null;
    N.erro = 'não foi possível ler a sessão: ' + mensagemDe(e);
  }
}

function avisouMudanca() {
  N.aoMudar.forEach((fn) => { try { fn(); } catch (e) {} });
}

// ── 3. PERFIS, CRIANÇAS E VÍNCULO ───────────────────────
// A conta é do adulto. A criança não tem login: ela tem um código de seis
// letras gerado neste aparelho, e é esse código que liga o boletim local ao
// adulto em outro aparelho.
async function criarPerfil(user, apelido) {
  // A linha do perfil pertence à conta que acabou de entrar. Sem sessão não há
  // perfil, e um id que não é o da sessão viva não é gravado: o banco confere
  // de novo pelo RLS, mas o navegador também não se oferece para escrever na
  // conta de outra pessoa.
  if (!logado()) return;
  const atual = N.sessao.user;
  if (!user || String(user.id) !== String(atual.id)) return;
  try {
    // ignoreDuplicates: a linha serve para a criança apontar para esta conta
    // (criancas.responsavel_id tem FK), não para reescrever o apelido que o
    // adulto já escolheu. Se o perfil existe, fica como está.
    await N.cliente.from('perfis').upsert(
      { id: user.id, papel: 'responsavel', apelido: apelido || 'Responsável' },
      { onConflict: 'id', ignoreDuplicates: true });
  } catch (e) { /* tabela ainda não criada: a conta existe, o resto vem depois */ }
}

async function registrarCrianca(apelido) {
  await montarCliente();
  if (!ativa()) return { ok: false, erro: 'conexão não configurada' };
  if (!logado() || !verificado()) return { ok: false, erro: 'confirme o e-mail da conta antes' };
  const g = estado();
  try {
    const codigo = codigoDe(TAMANHO_CODIGO);
    const { data, error } = await N.cliente.from('criancas').insert({
      codigo: codigo,
      apelido: apelido || 'Criança',
      responsavel_id: N.sessao.user.id,
      id_aparelho: idAparelho(),
      ano: g ? g.ano : 5,
      nivel: g ? g.nivel : 1,
    }).select().single();
    if (error) return { ok: false, erro: mensagemDe(error) };
    if (g) {
      g.codigoVinculo = data.codigo;
      g.apelidoCrianca = data.apelido;
      if (typeof root.saveState === 'function') root.saveState();
    }
    avisouMudanca();
    return { ok: true, crianca: data };
  } catch (e) {
    return { ok: false, erro: mensagemDe(e) };
  }
}

async function listarCriancas() {
  if (!ativa() || !logado()) return { ok: false, erro: 'sem conta ativa', lista: [] };
  try {
    // A view já traz tanto a criança registrada por esta conta quanto as
    // vinculadas por código: o filtro é o banco quem decide (RLS), não aqui.
    const { data, error } = await N.cliente.from('criancas_visiveis')
      .select('*')
      .order('criada_em', { ascending: false });
    if (error) return { ok: false, erro: mensagemDe(error), lista: [] };
    return { ok: true, lista: data || [] };
  } catch (e) {
    return { ok: false, erro: mensagemDe(e), lista: [] };
  }
}

// Vincular é para o adulto que já tem um código anotado (o do aparelho da
// criança, por exemplo). A função do banco checa o código e grava o vínculo.
async function vincularPorCodigo(codigo) {
  if (!ativa() || !logado()) return { ok: false, erro: 'sem conta ativa' };
  const limpo = String(codigo || '').trim().toUpperCase();
  if (!FORMA_CODIGO.test(limpo)) return { ok: false, erro: 'o código só tem letras e números, entre ' + CODE_MINIMO + ' e ' + CODE_MAXIMO + ' caracteres' };
  try {
    const { data, error } = await N.cliente.rpc('vincular_por_codigo', { p_codigo: limpo });
    if (error) return { ok: false, erro: mensagemDe(error) };
    return { ok: true, crianca: data };
  } catch (e) {
    return { ok: false, erro: mensagemDe(e) };
  }
}

// Apagar os dados da conta. A porta é a única que remove as linhas desta conta
// no banco (apagar_meus_registros, no schema) e ela só alcança o que é do
// adulto que chamou: quem não tem sessão não passa daqui, e o banco confere de
// novo. Depois de apagar, a subida do progresso fica desligada de propósito —
// seria jogar de volta no banco o pacote que o jogo acabou de destruir.
async function apagarRegistros() {
  if (!ativa() || !N.cliente) return { ok: false, erro: 'a conexão não está ativada neste aparelho' };
  if (!logado()) return { ok: false, erro: 'entre na conta do responsável antes de apagar' };
  N.nublado = true;
  if (N.subida) { clearTimeout(N.subida); N.subida = null; }
  pararVarredura();
  try {
    const { error } = await N.cliente.rpc('apagar_meus_registros');
    if (error) { N.nublado = false; return { ok: false, erro: mensagemDe(error) }; }
    fecharSala();
    try { await N.cliente.auth.signOut(); } catch (e) { /* a linha já foi; a sessão caduca sozinha */ }
    N.sessao = null;
    N.nublado = false;
    avisouMudanca();
    return { ok: true };
  } catch (e) {
    N.nublado = false;
    return { ok: false, erro: mensagemDe(e) };
  }
}

// ── 4. SUBIDA DO PROGRESSO ──────────────────────────────
// O jogo grava em localStorage a cada mudança. Subir a cada gravação seria
// escrever demais, então a subida atrasa um pouco e manda só a última versão
// — e apenas quando há conta verificada E criança registrada.
function aoSalvar() {
  if (N.nublado) return;
  if (!ativa() || !logado() || !verificado() || !vinculada()) return;
  const atraso = Number(config().bruto.atrasoSubidaMs) || 2500;
  if (N.subida) clearTimeout(N.subida);
  N.subida = setTimeout(() => { subirProgresso(); }, atraso);
}

function pacoteDoProgresso() {
  const g = estado();
  if (!g) return null;
  return {
    apelido: g.apelidoCrianca || 'Criança deste aparelho',
    estrelas: g.stars,
    ano: g.ano,
    nivel: g.nivel,
    desde: g.desde || Date.now(),
    atualizado_em: new Date().toISOString(),
    conteudos: Object.keys(g.hist || {}).length,
    respostas: Object.keys(g.hist || {}).reduce((s, k) => s + (g.hist[k].feitas || 0), 0),
    acertos: g.totalCorrect || 0,
    hist: g.hist || {},
    provas: g.provas || [],
    duelos: g.duelos || {},
    equipment: g.equip || {},
    owned: (g.owned || []).length,
  };
}

async function subirProgresso(agora) {
  if (!ativa()) return { ok: false, erro: 'conexão não configurada' };
  if (!logado() || !verificado()) return { ok: false, erro: 'confirme o e-mail da conta' };
  if (!vinculada()) return { ok: false, erro: 'registre a criança antes de sincronizar' };
  if (N.subida) { clearTimeout(N.subida); N.subida = null; }
  const dados = pacoteDoProgresso();
  if (!dados) return { ok: false, erro: 'o jogo ainda não abriu' };
  try {
    const { error } = await N.cliente.from('progressos').upsert(
      { codigo_crianca: estado().codigoVinculo, dados: dados, atualizado_em: dados.atualizado_em },
      { onConflict: 'codigo_crianca' });
    N.erro = error ? mensagemDe(error) : '';
    if (agora || error) avisouMudanca();
    return error ? { ok: false, erro: N.erro } : { ok: true, dados: dados };
  } catch (e) {
    N.erro = mensagemDe(e);
    avisouMudanca();
    return { ok: false, erro: N.erro };
  }
}

// Leitura do adulto em outro aparelho: o pacote mais recente daquela criança.
async function baixarProgresso(codigo) {
  if (!ativa() || !logado()) return { ok: false, erro: 'sem conta ativa' };
  try {
    const { data, error } = await N.cliente.from('progressos')
      .select('codigo_crianca, atualizado_em, dados')
      .eq('codigo_crianca', String(codigo || '').trim().toUpperCase())
      .maybeSingle();
    if (error) return { ok: false, erro: mensagemDe(error) };
    return { ok: true, pacote: data ? data.dados : null, quando: data ? data.atualizado_em : '' };
  } catch (e) {
    return { ok: false, erro: mensagemDe(e) };
  }
}

// ── 5. SALAS DO DUELO ───────────────────────────────────
// Duas estradas para a mesma mensagem: o Realtime, que é instantâneo, e uma
// varredura curta quando o websocket não pega (rede escolar, proxy, banco sem
// publicação). O duelo não precisa saber em qual estrada está.
//
// O navegador não escreve em salas nem em jogadas: ele pede. As três funções
// do banco (criar_sala, entrar_na_sala, registrar_jogada) é que decidem quem
// participa, em qual assento e se o lance faz sentido. Um código de sala,
// sozinho, não abre mais nada.
async function criarSala() {
  await montarCliente();
  exigirDueloLiberado();
  const { data, error } = await N.cliente.rpc('criar_sala');
  if (error) throw new Error(mensagemDe(error));
  if (!data || !data.length) throw new Error('o banco não devolveu a sala');
  const sala = data[0];
  return abrirSala({
    codigo: sala.codigo, assento: Number(sala.assento), nome: nomeDaSala(true),
    adversario: sala.adversario || '',
  });
}

async function entrarSala(codigo) {
  await montarCliente();
  exigirDueloLiberado();
  const limpo = String(codigo || '').trim().toUpperCase();
  if (!FORMA_CODIGO.test(limpo)) throw new Error('esse código de sala não tem um formato válido');
  // O update é atômico lá dentro: se dois baterem no mesmo código, um entra e
  // o ouve a mesma resposta que um código errado daria.
  const { data, error } = await N.cliente.rpc('entrar_na_sala', { p_codigo: limpo });
  if (error) throw new Error(mensagemDe(error));
  if (!data || !data.length) throw new Error('não deu para entrar nesta sala');
  const sala = data[0];
  return abrirSala({
    codigo: sala.codigo, assento: Number(sala.assento), nome: nomeDaSala(false),
    adversario: sala.adversario || '',
  });
}

function exigirDueloLiberado() {
  if (dueloLiberado()) return;
  throw new Error('o duelo em rede está ' + motivoDoBloqueio() +
    '. Ele só abre depois de o schema novo estar aplicado e conferido neste projeto.');
}

function nomeDaSala(anfitriao) {
  const meta = N.sessao && N.sessao.user && N.sessao.user.user_metadata;
  if (meta && meta.apelido) return meta.apelido;
  const g = estado();
  if (g && g.apelidoCrianca) return g.apelidoCrianca;
  return anfitriao ? 'Anfitrião' : 'Desafiante';
}

// O transporte exposto ao duelo é mínimo: código, assento, os dois nomes e
// enviar/sair. O resto (canal, tabela, varredura) fica aqui dentro.
function abrirSala(dados) {
  fecharSala();
  const sala = {
    codigo: dados.codigo,
    assento: dados.assento,
    nome: dados.nome,
    adversario: dados.adversario || '',
    enviar: function (tipo, dado) { gravarJogada(tipo, dado); },
    sair: function () {avisouSaida(sala.codigo); fecharSala(); },
  };
  N.sala = sala;
  N.erro = '';
  escutar(sala.codigo);
  avisouMudanca();
  return sala;
}

// Avisar o banco que a pessoa saiu é o que devolve a sala para o estado
// certo (o desafiante que vai embora libera a cadeira dele). Falha aqui não
// derruba o jogo: o lance seguinte é recusado e a tela diz o que aconteceu.
function avisouSaida(codigo) {
  if (!ativa() || !N.cliente || !dueloLiberado()) return;
  try {
    N.cliente.rpc('sair_da_sala', { p_sala: codigo }).then(() => {}, () => {});
  } catch (e) { /* sem aviso: a sala vence sozinha em um dia */ }
}

// O navegador não decide o próprio assento nem se apresenta como outra
// pessoa: ele manda o lance e o banco olha quem é. Aqui só fica o filtro de
// formato, para não subir lixo que estouraria a partida do outro lado.
async function gravarJogada(tipo, dado) {
  const sala = N.sala;
  if (!ativa() || !sala) return;
  // O interruptor conferido de novo aqui, e não só na porta de entrada: se o
  // bloqueio cair no meio da partida (a pessoa desliga o duelo no config e
  // recarrega a aba), o lance para antes de subir. A tela avisa em vez de
  // fingir que a jogada chegou ao outro lado.
  if (!dueloLiberado()) {
    N.erro = 'a jogada não subiu: o duelo em rede está ' + motivoDoBloqueio() + '.';
    avisouMudanca();
    return;
  }
  const limpo = frearLance(tipo, dado);
  if (!limpo) {
    N.erro = 'este lance não passou na conferência e não foi enviado.';
    avisouMudanca();
    return;
  }
  try {
    const { error } = await N.cliente.rpc('registrar_jogada', {
      p_sala: sala.codigo,
      p_tipo: limpo.tipo,
      p_dado: limpo.dado,
    });
    if (error) N.erro = 'a jogada não subiu: ' + mensagemDe(error);
    else N.erro = '';
  } catch (e) {
    N.erro = 'a jogada não subiu: ' + mensagemDe(e);
  }
  avisouMudanca();
}

function textoSeguro(v, max) {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[<>]/g, '').trim().slice(0, max);
  return s.length ? s : null;
}

function numeroEntre(v, minimo, maximo) {
  const n = Number(v);
  if (!isFinite(n) || n < minimo || n > maximo) return null;
  return n;
}

// Espelho do que o banco confere (registrar_jogada). Texto do outro lado do
// fio nunca entra cru na tela: só as chaves conhecidas, nos tamanhos de sempre.
const CONTAS_PERMITIDAS = ['numeros', 'algebra', 'geometria', 'medidas', 'dados'];

function frearConta(conta) {
  if (!conta || typeof conta !== 'object' || Array.isArray(conta)) return null;
  const txt = textoSeguro(conta.txt, 300);
  const resposta = textoSeguro(conta.resposta, 40);
  const u = CONTAS_PERMITIDAS.indexOf(String(conta.u)) >= 0 ? String(conta.u) : null;
  if (!txt || !resposta || !u) return null;
  const limpa = { txt: txt, resposta: resposta, u: u };
  const o = textoSeguro(conta.o, 200);
  if (o) limpa.o = o;
  const ref = textoSeguro(conta.ref, 40);
  if (ref) limpa.ref = ref;
  if (Array.isArray(conta.alt)) limpa.alt = conta.alt.slice(0, 8).map((a) => textoSeguro(a, 60) || '');
  if (Array.isArray(conta.bncc)) limpa.bncc = conta.bncc
    .filter((b) => /^EF\d\dMA\d\d$/.test(String(b))).slice(0, 4);
  else if (typeof conta.bncc === 'string' && /^EF\d\dMA\d\d$/.test(conta.bncc)) limpa.bncc = [conta.bncc];
  const valor = Number(conta.valor);
  if (isFinite(valor)) limpa.valor = valor;
  return limpa;
}

function frearLance(tipo, dado) {
  if (TIPOS_DE_LANCE.indexOf(tipo) < 0) return null;
  if (!dado || typeof dado !== 'object' || Array.isArray(dado)) return null;
  if (JSON.stringify(dado).length > LIMITE_LANCE_BYTES) return null;

  if (tipo === 'duelo:partida') {
    const densidade = numeroEntre(dado.densidade, 1, 80);
    if (!densidade || !Array.isArray(dado.contas)) return null;
    const contas = dado.contas.slice(0, 80).map(frearConta);
    if (!contas.length || contas.some((c) => !c)) return null;
    return { tipo: tipo, dado: { densidade: densidade, contas: contas } };
  }
  if (tipo === 'duelo:acerto') {
    const peca = textoSeguro(dado.peca, 24);
    const conta = textoSeguro(dado.conta, 40);
    const tempo = numeroEntre(dado.tempo, 0, 3600000);
    if (!peca || !conta || tempo === null) return null;
    return { tipo: tipo, dado: { peca: peca, conta: conta, tempo: tempo } };
  }
  const tempo = numeroEntre(dado.tempo, 0, 3600000);
  const motivo = textoSeguro(dado.motivo, 80) || 'A vez passou.';
  if (tempo === null) return null;
  return { tipo: tipo, dado: { tempo: tempo, motivo: motivo } };
}

function escutar(codigo) {
  // Ouvir a mesa é uma leitura de rede: entra pelo mesmo interruptor das
  // outras portas, para o canal não ficar vivo depois de o duelo ser desligado.
  if (!dueloLiberado()) return;
  try {
    N.canal = N.cliente
      .channel('sala-' + codigo)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'jogadas', filter: 'sala=eq.' + codigo },
        (payload) => entregar(payload && payload.new))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') { N.porSegundo = false; pararVarredura(); return; }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          N.porSegundo = true;
          varredura(codigo);
        }
      });
  } catch (e) {
    N.porSegundo = true;
    varredura(codigo);
  }
  // Se em quatro segundos nada chegou e o canal também não confirmou, a
  // varredura assume — o duelo não pode ficar esperando mensagem que não vem.
  setTimeout(() => { if (N.sala && N.sala.codigo === codigo && !escutando()) varredura(codigo); }, 4000);
}

function escutando() {
  try { return N.canal && N.canal.state === 'joined'; } catch (e) { return false; }
}

function varredura(codigo) {
  if (N.varredura || !dueloLiberado()) return;
  const intervalo = Number(config().bruto.varreduraSalaMs) || 900;
  N.varredura = setInterval(async () => {
    if (!N.sala || N.sala.codigo !== codigo) { pararVarredura(); return; }
    try {
      const desde = new Date(Date.now() - 20000).toISOString();
      const { data } = await N.cliente.from('jogadas')
        .select('*').eq('sala', codigo).gt('criado_em', desde)
        .order('criado_em', { ascending: true }).limit(40);
      (data || []).forEach(entregar);
    } catch (e) { /* a próxima varredura tenta de novo */ }
  }, intervalo);
}

function pararVarredura() {
  if (N.varredura) { clearInterval(N.varredura); N.varredura = null; }
}

// A mesma jogada pode chegar pelo canal e pela varredura. O carimbo decide o
// que já foi visto, senão o tabuleiro apagaria a peça duas vezes.
const vistas = [];
function jaVista(id) {
  if (vistas.indexOf(id) >= 0) return true;
  vistas.push(id);
  if (vistas.length > 300) vistas.shift();
  return false;
}

function entregar(nova) {
  if (!nova || !N.sala) return;
  // Nada que vem do outro lado é aceito cru: o tipo precisa ser conhecido, o
  // assento tem de ser o do adversário (o eco do meu próprio lance já entrou
  // aqui dentro) e todo texto passa pela mesma peneira de quem envia.
  const assento = Number(nova.assento);
  if (assento !== 0 && assento !== 1) return;
  if (assento === Number(N.sala.assento)) return;
  const limpo = frearLance(nova.tipo, nova.dado);
  if (!limpo) return;

  const id = String(nova.id || (nova.criado_em + ':' + assento + ':' + nova.tipo));
  if (jaVista(id)) return;
  N.vistoUltimamente = Date.now();
  const duelo = root.CM_DUELO;
  if (duelo && duelo.receber) {
    duelo.receber(limpo.tipo, Object.assign({}, limpo.dado, { assento: assento }));
  }
}

function fecharSala() {
  pararVarredura();
  try { if (N.canal && N.cliente) N.cliente.removeChannel(N.canal); } catch (e) {}
  N.canal = null;
  N.sala = null;
  vistas.length = 0;
}

// ── 6. A TELA DA CONEXÃO ────────────────────────────────
// A linha de estado (config.js / e-mail / sincronia / sala) é um painel de
// diagnóstico. Ela estava sempre em primeiro lugar, e isso colocava quatro
// fichas de 10,5 px acima do botão de entrar — exatamente o contrário do que
// quem abre a tela procura. Onde a conexão É o assunto (conta ativa, projeto
// vazio, cliente carregando) ela continua no topo; onde o assunto é entrar, ela
// desce para o fim, logo antes de "não lembro a senha" virar um mistério.
function pintar() {
  const caixa = document.getElementById('nuvemCorpo');
  if (!caixa) return;
  const cfg = config();
  caixa.innerHTML = '';
  if (!cfg.valido) { caixa.appendChild(estadoLinha(cfg)); caixa.appendChild(painelSemConfig()); return; }
  if (!N.cliente) { caixa.appendChild(estadoLinha(cfg)); caixa.appendChild(painelCarregando()); return; }
  // O link de "esqueci a senha" trouxe uma sessão de recuperação: a única
  // coisa que faz sentido pedir agora é a senha nova.
  if (N.redefinir && logado()) { caixa.appendChild(painelRedefinir()); caixa.appendChild(estadoLinha(cfg)); return; }
  if (!logado()) {
    caixa.appendChild(aVerificar() ? painelVerificacao() : painelEntrar());
    caixa.appendChild(estadoLinha(cfg));
    return;
  }
  if (!verificado()) { caixa.appendChild(painelVerificacao()); caixa.appendChild(estadoLinha(cfg)); return; }
  caixa.appendChild(estadoLinha(cfg));
  caixa.appendChild(painelLigado());
}

function estadoLinha(cfg) {
  const p = document.createElement('p');
  p.className = 'nuvem-fit';
  const transporte = N.sala ? (N.porSegundo ? 'varredura' : 'Realtime') : '—';
  const situacao = logado()
    ? (verificado() ? 'confirmado' : 'aguardando clique')
    : (aVerificar() ? 'aguardando clique' : 'sem conta');
  p.innerHTML = '<span><i class="fa-solid fa-key"></i> config.js: <b>' +
    (cfg.valido ? 'chave válida' : 'vazia') + '</b></span>' +
    '<span><i class="fa-solid fa-envelope-circle-check"></i> e-mail: <b>' + situacao + '</b></span>' +
    '<span><i class="fa-solid fa-cloud-arrow-up"></i> sincronia: <b>' +
    (vinculada() ? 'ligada a ' + esc((estado() || {}).codigoVinculo || '—') : 'desligada') + '</b></span>' +
    '<span><i class="fa-solid fa-wifi"></i> sala: <b>' + transporte + '</b></span>';
  return p;
}

function painelSemConfig() {
  const d = document.createElement('div');
  d.className = 'nuvem-painel';
  d.innerHTML =
    '<h3 class="nuvem-titulo"><i class="fa-solid fa-plug"></i> Conexão desligada — e o jogo funciona assim</h3>' +
    '<p class="nuvem-texto">Nada foi enviado para nenhum servidor, e nada será enquanto esta tela mostrar ' +
      'isto. Login, verificação de e-mail, boletim lido de outro aparelho e sala por código no duelo só ' +
      'existem depois de ligar o jogo ao seu próprio projeto do Supabase.</p>' +
    '<ol class="nuvem-passos">' +
      '<li>Crie um projeto gratuito em <b>supabase.com</b>.</li>' +
      '<li>No <b>SQL Editor</b>, cole o conteúdo de <code>supabase/schema.sql</code> e rode uma vez.</li>' +
      '<li>Em <b>Project Settings → API Keys</b>, copie a <b>Project URL</b> e a <b>Publishable key</b> '
        '(no painel antigo: <b>anon public key</b> — é a mesma função, com papel <code>anon</code>).</li>' +
      '<li>Cole as duas em <code>config.js</code> e recarregue esta página.</li>' +
      '<li>Em <b>Authentication → URL configuration</b>, ponha o endereço público do jogo como <b>Site URL</b>, ' +
        'para o link de confirmação voltar para cá.</li>' +
      '<li>Em <b>Database → Replication</b>, marque a tabela <code>jogadas</code> no <code>supabase_realtime</code> ' +
        '(sem isso, a sala funciona por varredura — mesmo resultado, um pouco mais lento).</li>' +
    '</ol>' +
    '<p class="nuvem-nota"><i class="fa-solid fa-shield-halved"></i> A anon key é pública por natureza: o que ' +
      'protege os dados são as políticas (RLS) do schema, não a chave. Já a <b>service role key</b> '
      '(no painel novo: a chave que começa com o prefixo de secreta) nunca entra ' +
      'num navegador — deixe-a fora do projeto.</p>';
  return d;
}

function painelCarregando() {
  const d = document.createElement('div');
  d.className = 'nuvem-painel';
  const p = document.createElement('p');
  p.className = 'nuvem-texto';
  p.textContent = N.erro
    ? 'A conexão configurada não respondeu: ' + N.erro + '. O jogo segue funcionando neste aparelho.'
    : 'Configuração encontrada. Tentando conversar com o banco…';
  d.appendChild(p);
  d.appendChild(botao('<i class="fa-solid fa-rotate"></i> Tentar de novo', 'btn-nuvem-primario', async () => {
    N.cliente = null;
    pintar();
    await montarCliente();
    await lerSessao();
    pintar();
  }));
  return d;
}

function painelEntrar() {
  const d = document.createElement('div');
  d.className = 'nuvem-painel';
  const titulo = document.createElement('h3');
  titulo.className = 'nuvem-titulo';
  titulo.innerHTML = '<i class="fa-solid fa-user-shield"></i> Conta de quem acompanha';
  d.appendChild(titulo);
  // Uma frase, e o formulário vem junto. A explicação inteira de privacidade
  // continua disponível — embaixo, aberta por quem a quer — mas deixou de
  // ficar na frente do botão, que era o motivo de a tela parecer longa antes
  // de parecer clara.
  const explic = document.createElement('p');
  explic.className = 'nuvem-texto';
  explic.textContent = 'A conta é do adulto, não da criança. Entre para ler o boletim ' +
    'deste mesmo jogo em outro aparelho.';
  d.appendChild(explic);

  const forms = [];
  const abaCriar = painelCriarConta();
  const abaEntrar = painelEntrarConta();
  forms.push(abaCriar, abaEntrar);

  const abas = document.createElement('div');
  abas.className = 'nuvem-abas';
  abas.setAttribute('role', 'tablist');
  ['Criar conta', 'Já tenho conta'].forEach((texto, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'nuvem-aba' + (i === 0 ? ' ativa' : '');
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    b.textContent = texto;
    b.onclick = () => {
      Array.prototype.forEach.call(abas.children, (c, j) => {
        c.classList.remove('ativa');
        c.setAttribute('aria-selected', 'false');
        if (j === i) { c.classList.add('ativa'); c.setAttribute('aria-selected', 'true'); }
      });
      forms.forEach((f, j) => { f.hidden = j !== i; });
      const alvo = forms[i].querySelector('input');
      if (alvo) alvo.focus();
    };
    abas.appendChild(b);
  });
  d.appendChild(abas);
  forms.forEach((f) => d.appendChild(f));

  d.appendChild(detalhes('Por que a conta é do adulto?',
    'Ela serve para duas coisas: ler o boletim em outro aparelho e abrir salas do duelo por código. ' +
    'Nenhum dado sai deste aparelho antes de você registrar a criança, e o vínculo é feito com um ' +
    'código de dez letras gerado aqui — a criança não tem login, não tem e-mail e não tem nome, só o ' +
    'apelido que você escolher.'));
  return d;
}

// Um parágrafo que não desaparece quando a tela é redesenhada: <details> é HTML
// puro, o estado aberto/fechado é do navegador, e o conteúdo não compete com o
// formulário por atenção nem por rolagem.
function detalhes(resumo, texto) {
  const d = document.createElement('details');
  d.className = 'nuvem-detalhes';
  const s = document.createElement('summary');
  s.textContent = resumo;
  const p = document.createElement('p');
  p.className = 'nuvem-texto';
  p.textContent = texto;
  d.appendChild(s); d.appendChild(p);
  return d;
}

function painelCriarConta() {
  const f = document.createElement('div');
  f.className = 'nuvem-form';
  const nome = campo('text', 'Como você quer ser chamada(o)', 'nuvemApelido', 'Mãe, pai, tio…');
  const email = campo('email', 'Seu e-mail', 'nuvemEmail', 'voce@exemplo.com');
  const senha = campo('password', 'Senha (mínimo de 6 caracteres)', 'nuvemSenha', '••••••');
  const msg = recado('criar');
  f.appendChild(nome.caixa); f.appendChild(email.caixa); f.appendChild(senha.caixa);
  f.appendChild(botao('<i class="fa-solid fa-envelope"></i> Criar conta e enviar o link', 'btn-nuvem-primario', async () => {
    if (nome.valor.trim().length < 2) { msg.dizer('Diga como quer ser chamada(o).', 'erro'); return; }
    if (!/\S+@\S+\.\S+/.test(email.valor)) { msg.dizer('O e-mail não parece válido.', 'erro'); return; }
    if (senha.valor.length < 6) { msg.dizer('A senha precisa de pelo menos 6 caracteres.', 'erro'); return; }
    msg.dizer('Criando conta…');
    const r = await registrar({ email: email.valor.trim(), senha: senha.valor, apelido: nome.valor.trim() });
    if (!r.ok) { msg.dizer('Não deu: ' + r.erro, 'erro'); return; }
    msg.dizer(r.precisaVerificar
      ? 'Conta criada. Abra ' + r.email + ', clique no link de confirmação e volte aqui.'
      : 'Conta criada e confirmada.', 'ok');
    pintar();
  }));
  f.appendChild(msg);
  return f;
}

function painelEntrarConta() {
  const f = document.createElement('div');
  f.className = 'nuvem-form';
  f.hidden = true;
  const email = campo('email', 'Seu e-mail', 'nuvemEmail2', 'voce@exemplo.com');
  const senha = campo('password', 'Senha', 'nuvemSenha2', '••••••');
  const msg = recado('entrar');
  f.appendChild(email.caixa); f.appendChild(senha.caixa);
  f.appendChild(botao('<i class="fa-solid fa-right-to-bracket"></i> Entrar', 'btn-nuvem-primario', async () => {
    if (!/\S+@\S+\.\S+/.test(email.valor)) { msg.dizer('Falta escrever o e-mail.', 'erro'); return; }
    msg.dizer('Entrando…');
    const r = await entrar(email.valor.trim(), senha.valor);
    if (!r.ok) {
      // "falta confirmar" não é falha para ler e fechar: a tela de verificação
      // já tem o reenvio do link, e é para ela que a pessoa deve ir.
      if (r.verificar) { msg.dizer('Falta confirmar o e-mail. Abrimos a tela de verificação.', 'erro'); pintar(); return; }
      msg.dizer('Não entrou: ' + r.erro, 'erro');
      return;
    }
    msg.dizer('Entrou.', 'ok');
    pintar();
  }));
  f.appendChild(botao('<i class="fa-solid fa-key"></i> Não lembro a senha', '', async () => {
    if (!/\S+@\S+\.\S+/.test(email.valor)) { msg.dizer('Escreva o e-mail primeiro: é para ele que vai o link.', 'erro'); return; }
    msg.dizer('Mandando o link…');
    const r = await recuperar(email.valor.trim());
    if (!r.ok) { msg.dizer('Não mandou: ' + r.erro, 'erro'); return; }
    msg.dizer('Se o e-mail existir no projeto, o link de redefinição chega em alguns minutos. Abra no mesmo aparelho deste jogo e clique nele.', 'ok');
  }));
  f.appendChild(msg);
  return f;
}

function painelVerificacao() {
  const d = document.createElement('div');
  d.className = 'nuvem-painel';
  const email = emailPendente();
  const t = document.createElement('h3');
  t.className = 'nuvem-titulo';
  t.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Falta confirmar o e-mail';
  d.appendChild(t);
  d.appendChild(linha(email
    ? 'A conta existe, mas ainda não vale para acompanhar ninguém. Mandamos um link para ' + email +
      '. Enquanto o clique não acontecer, nada sobe deste aparelho — o boletim continua só local.'
    : 'A conta existe, mas este aparelho perdeu o endereço dela. Digite o e-mail abaixo para receber o link de novo.'));
  const msg = recado('verificar');
  if (!email) {
    const email2 = campo('email', 'Seu e-mail', 'nuvemEmailVerificar', 'voce@exemplo.com');
    d.appendChild(email2.caixa);
    d.appendChild(botao('<i class="fa-solid fa-paper-plane"></i> Enviar o link para este e-mail', 'btn-nuvem-primario', async () => {
      if (!/\S+@\S+\.\S+/.test(email2.valor)) { msg.dizer('O e-mail não parece válido.', 'erro'); return; }
      msg.dizer('Mandando…');
      const r = await reenviar(email2.valor.trim());
      if (!r.ok) { msg.dizer('Não mandou: ' + r.erro, 'erro'); return; }
      N.pendente = { email: email2.valor.trim() };
      msg.dizer('Link enviado. Confira também a caixa de spam.', 'ok');
      pintar();
    }));
    d.appendChild(msg);
    return d;
  }
  d.appendChild(botao('<i class="fa-solid fa-paper-plane"></i> Reenviar o link', 'btn-nuvem-primario', async () => {
    msg.dizer('Mandando de novo…');
    const r = await reenviar(email);
    if (r.ok) msg.dizer('Reenviado. Confira também a caixa de spam.', 'ok');
    else msg.dizer('Não reenviou: ' + r.erro, 'erro');
  }));
  d.appendChild(botao('<i class="fa-solid fa-rotate"></i> Já cliquei — conferir', '', async () => {
    msg.dizer('Confirmando…');
    await montarCliente();
    await lerSessao();
    if (verificado()) msg.dizer('E-mail confirmado.', 'ok');
    else if (!logado()) msg.dizer('O clique ainda não apareceu no banco. Espere alguns segundos e confira de novo.', 'erro');
    else msg.dizer('O clique ainda não apareceu no banco. Espere alguns segundos e confira de novo.', 'erro');
    pintar();
  }));
  d.appendChild(botao('<i class="fa-solid fa-user-pen"></i> Usar outro e-mail', '', () => {
    N.pendente = null;
    N.recado = null;
    pintar();
  }));
  d.appendChild(msg);
  return d;
}

// Volta do link de "esqueci a senha": o navegador já tem uma sessão viva que só
// serve para isso, e a única saída honesta é pedir a senha nova agora.
function painelRedefinir() {
  const d = document.createElement('div');
  d.className = 'nuvem-painel';
  const t = document.createElement('h3');
  t.className = 'nuvem-titulo';
  t.innerHTML = '<i class="fa-solid fa-lock"></i> Definir a senha nova';
  d.appendChild(t);
  d.appendChild(linha('O link fez diferença: esta janela está aberta só para trocar a senha. ' +
    'Escolha a senha nova e pronto — o jogo continua com a mesma conta de antes.'));
  const uma = campo('password', 'Senha nova (mínimo de 6 caracteres)', 'nuvemSenhaNova', '••••••');
  const duas = campo('password', 'Repita a senha nova', 'nuvemSenhaNova2', '••••••');
  const msg = recado('redefinir');
  d.appendChild(uma.caixa);
  d.appendChild(duas.caixa);
  d.appendChild(botao('<i class="fa-solid fa-floppy-disk"></i> Guardar a senha nova', 'btn-nuvem-primario', async () => {
    if (uma.valor.length < 6) { msg.dizer('A senha precisa de pelo menos 6 caracteres.', 'erro'); return; }
    if (uma.valor !== duas.valor) { msg.dizer('As duas senhas não são iguais.', 'erro'); return; }
    msg.dizer('Guardando…');
    const r = await redefinirSenha(uma.valor);
    if (!r.ok) { msg.dizer('Não guardou: ' + r.erro, 'erro'); return; }
    msg.dizer('Senha nova no lugar. Já dá para acompanhar o boletim deste aparelho.', 'ok');
    pintar();
  }));
  d.appendChild(botao('<i class="fa-solid fa-xmark"></i> Deixar para depois', '', () => {
    N.redefinir = false;
    pintar();
  }));
  d.appendChild(msg);
  return d;
}

function painelLigado() {
  const d = document.createElement('div');
  d.className = 'nuvem-painel';
  const t = document.createElement('h3');
  t.className = 'nuvem-titulo';
  t.innerHTML = '<i class="fa-solid fa-cloud"></i> Conta ativa: ' +
    esc((N.sessao && N.sessao.user && N.sessao.user.email) || '');
  d.appendChild(t);
  d.appendChild(linha('A partir daqui, o histórico deste aparelho pode ser lido por você em outro aparelho, ' +
    'e as salas do duelo funcionam por código. O que fica no banco: desempenho por conteúdo, provas ' +
    'aplicadas, registro dos duelos e as jogadas da sala enquanto ela estiver aberta. Não fica: nome real, ' +
    'foto, endereço ou qualquer coisa que identificasse a criança além do código de vínculo.'));

  const msg = recado('ligado');
  d.appendChild(botao('<i class="fa-solid fa-child"></i> Registrar a criança deste aparelho', 'btn-nuvem-primario', async () => {
    const g = estado();
    msg.dizer('Registrando…');
    const r = await registrarCrianca((g && g.apelidoCrianca) || 'Criança');
    if (!r.ok) { msg.dizer('Não registrou: ' + r.erro, 'erro'); return; }
    msg.dizer('Pronto. Código de vínculo: ' + r.crianca.codigo + ' — anote e guarde.', 'ok');
    carregarLista(lista, msg);
  }));

  d.appendChild(botao('<i class="fa-solid fa-arrow-up-from-bracket"></i> Subir o progresso agora', '', async () => {
    msg.dizer('Subindo…');
    const r = await subirProgresso(true);
    if (!r.ok) { msg.dizer('Não subiu: ' + r.erro, 'erro'); return; }
    msg.dizer('Sincronizado às ' + new Date().toLocaleTimeString('pt-BR') + '.', 'ok');
  }));

  const lista = document.createElement('div');
  lista.className = 'nuvem-criancas';
  d.appendChild(lista);
  carregarLista(lista, msg);

  d.appendChild(botao('<i class="fa-solid fa-right-from-bracket"></i> Sair da conta', 'btn-nuvem-perigo', async () => {
    fecharSala();
    await sair();
  }));
  d.appendChild(msg);
  if (N.erro) d.appendChild(linha('Último erro visto: ' + N.erro, 'nuvem-erro'));
  return d;
}

async function carregarLista(destino, msg) {
  destino.innerHTML = '';
  const r = await listarCriancas();
  if (!r.ok) { destino.appendChild(linha('Não foi possível listar: ' + r.erro)); return; }
  if (!r.lista.length) {
    destino.appendChild(linha('Nenhuma criança vinculada a esta conta ainda. Registre a deste aparelho ' +
      'ou digite o código de vínculo do aparelho onde a criança joga.'));
    const codigo = campo('text', 'Código de vínculo', 'nuvemVinculo', 'ABCDEFGHJK');
    codigo.entrada.style.textTransform = 'uppercase';
    destino.appendChild(codigo.caixa);
    destino.appendChild(botao('<i class="fa-solid fa-link"></i> Vincular por código', '', async () => {
      const v = await vincularPorCodigo(codigo.valor);
      if (v.ok) {
        msg.dizer('Vinculado: ' + ((v.crianca && v.crianca.apelido) || v.crianca.codigo), 'ok');
        carregarLista(destino, msg);
      } else {
        msg.dizer('Não vincula: ' + v.erro, 'erro');
      }
    }));
    return;
  }
  r.lista.forEach((c) => {
    const item = document.createElement('div');
    item.className = 'nuvem-crianca';
    item.innerHTML = '<span class="nuvem-crianca-nome">' + esc(c.apelido || 'sem nome') + '</span>' +
      '<span class="nuvem-crianca-codigo">' + esc(c.codigo || '') + '</span>' +
      '<span class="nuvem-crianca-quando">jogando no ' + esc(c.ano || '?') + 'º ano · ' +
        esc(NIVEIS_NAME(c.nivel)) + '</span>';
    destino.appendChild(item);
    item.appendChild(botao('<i class="fa-solid fa-download"></i> Ler o progresso', 'btn-nuvem-mini', async () => {
      msg.dizer('Lendo…');
      const p = await baixarProgresso(c.codigo);
      if (p.ok && p.pacote) {
        msg.dizer(p.pacote.apelido + ' · ' + (p.pacote.respostas || 0) + ' respostas · ' +
          (p.pacote.provas ? p.pacote.provas.length : 0) + ' prova(s) · atualizado em ' +
          new Date(p.pacote.atualizado_em).toLocaleString('pt-BR'), 'ok');
      } else if (p.ok) {
        msg.dizer('Nada guardado para este código ainda — a criança ainda não sincronizou.', 'erro');
      } else {
        msg.dizer('Não leu: ' + p.erro, 'erro');
      }
    }));
  });
}

function NIVEIS_NAME(nv) {
  const C = root.CM;
  return (C && C.NIVEIS && C.NIVEIS[nv - 1]) || 'Base';
}

// ── 7. PEQUENOS CONSTRUTORES DE TELA ────────────────────
function linha(texto, classe) {
  const p = document.createElement('p');
  p.className = 'nuvem-texto' + (classe ? ' ' + classe : '');
  p.textContent = texto;
  return p;
}

// Recado de formulário: a mesma linha, três caras — neutro enquanto trabalha,
// erro quando não deu, ok quando deu. Sem isso, "Não deu: Failed to fetch"
// tem exatamente a mesma roupa de uma instrução e passa despercebido.
function recado(chave) {
  const p = document.createElement('p');
  p.className = 'nuvem-msg';
  function desenhar(reg) {
    p.className = 'nuvem-msg' + (reg.tipo === 'erro' ? ' nuvem-erro' : reg.tipo === 'ok' ? ' nuvem-ok' : '');
    p.textContent = reg.texto;
  }
  p.dizer = function (texto, tipo) {
    N.recado = { painel: chave || '', texto: texto, tipo: tipo || '' };
    desenhar(N.recado);
  };
  // A repintura destrói este parágrafo e cria outro no lugar dele. Sem guardar
  // o recado, "Não deu: ..." e "Abra seu e-mail e clique no link" somem antes
  // de a pessoa terminar de ler - e a tela da conexão parece que ignorou o
  // clique. O recado volta junto do painel que o escreveu.
  if (chave && N.recado && N.recado.painel === chave) desenhar(N.recado);
  return p;
}

function botao(html, classe, aoClicar) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn-nuvem' + (classe ? ' ' + classe : '');
  b.innerHTML = html;
  b.onclick = aoClicar;
  return b;
}

function campo(tipo, rotulo, nome, placeholder) {
  const r = document.createElement('label');
  r.className = 'nuvem-campo';
  const t = document.createElement('span');
  t.className = 'nuvem-rotulo';
  t.textContent = rotulo;
  r.appendChild(t);
  const i = document.createElement('input');
  i.type = tipo;
  i.id = nome;
  i.name = nome;
  i.placeholder = placeholder || '';
  // O gerenciador de senha do navegador só ajuda se for convidado. 'off' num
  // campo de senha de login é o mesmo que exigir que a pessoa digite de novo
  // uma senha de 12 caracteres num teclado de 390 px — e foi exatamente o que
  // esteve aqui.
  const autocompletar = {
    nuvemEmail: 'email', nuvemEmail2: 'email', nuvemEmailVerificar: 'email',
    nuvemApelido: 'nickname',
    nuvemSenha: 'new-password', nuvemSenha2: 'current-password',
    nuvemSenhaNova: 'new-password', nuvemSenhaNova2: 'new-password',
  };
  i.autocomplete = autocompletar[nome] || (tipo === 'email' ? 'email' : 'off');
  if (tipo === 'password') {
    i.spellcheck = false;
    // Sem isto, o Android coloca a primeira letra em maiúscula sozinho e a
    // senha digitada não é a senha guardada — um "senha errada" que não é.
    i.setAttribute('autocapitalize', 'none');
    i.setAttribute('autocorrect', 'off');
  }
  r.appendChild(i);
  // Devolvemos os dois: `caixa` é o que se anexa (rótulo + campo), e
  // `valor` é o que se lê. Anexar só o input deixaria o formulário muda.
  return { caixa: r, entrada: i, get valor() { return i.value; } };
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ── 8. ENTRADA ──────────────────────────────────────────
async function iniciar() {
  // O link de "esqueci a senha" devolve a pessoa a esta página com
  // #redefinir-senha no endereço. É o único sinal de que ela está no meio de
  // uma troca de senha, e a tela abaixo é a resposta.
  N.redefinir = /#redefinir-senha/.test(String((root.location || {}).hash || ''));
  await montarCliente();
  if (N.cliente) {
    await lerSessao();
    try {
      N.cliente.auth.onAuthStateChange((evento, sessao) => {
        if (evento === 'PASSWORD_RECOVERY') N.redefinir = true;
        N.sessao = sessao;
        if (sessao) N.pendente = null;
        avisouMudanca();
      });
    } catch (e) { /* versão da biblioteca sem escuta de estado */ }
  }
  try {
    pintar();
  } catch (e) {
    // Uma tela que estoura não pode levar o jogo junto: a criança continua
    // jogando neste aparelho, e quem publica precisa ver o motivo na tela.
    N.erro = mensagemDe(e);
    const caixa = document.getElementById('nuvemCorpo');
    if (caixa) {
      caixa.textContent = 'A tela da conexão não conseguiu ser desenhada: ' + N.erro +
        '. O jogo continua funcionando neste aparelho.';
    }
  }
  // Abrir a tela de conexão mais de uma vez não pode dobrar a escuta: a
  // pintura sairia duas vezes para cada mudança de estado.
  if (N.aoMudar.indexOf(pintar) < 0) N.aoMudar.push(pintar);
}

// Abrir a tela da conexão tem de mostrar o estado de agora, e não o de quando
// a página carregou: sessão, verificação e vínculo mudam sem recarregar nada.
async function repintar() {
  try { if (N.cliente) await lerSessao(); } catch (e) { /* fica como está */ }
  try {
    pintar();
  } catch (e) {
    N.erro = mensagemDe(e);
  }
}

root.CM_NUVEM = {
  iniciar: iniciar,
  repintar: repintar,
  aoSalvar: aoSalvar,
  ativa: ativa,
  logado: logado,
  verificado: verificado,
  vinculada: vinculada,
  criarSala: criarSala,
  entrarSala: entrarSala,
  sairDaSala: fecharSala,
  subir: subirProgresso,
  baixar: baixarProgresso,
  apagarRegistros: apagarRegistros,
  registrarCrianca: registrarCrianca,
  resumo: function () {
    const cfg = config();
    return {
      configurado: cfg.valido,
      cliente: !!N.cliente,
      sessao: logado(),
      verificado: verificado(),
      pendente: aVerificar(),
      vinculada: vinculada(),
      erro: N.erro,
      sala: N.sala ? N.sala.codigo : null,
      assento: N.sala ? N.sala.assento : null,
      transporte: N.sala ? (N.porSegundo ? 'varredura' : 'realtime') : null,
      dueloLiberado: dueloLiberado(),
      bloqueioDoDuelo: motivoDoBloqueio(),
    };
  },
  // Só o que dá para mostrar numa tela de diagnóstico. A sessão crua
  // (access token, refresh token, e-mail) fica dentro deste módulo e nunca
  // sai por uma função pública — na versão anterior, detalhe() devolvia N
  // inteiro, tokens incluídos, acessível de qualquer lugar do jogo.
  detalhe: function () {
    return {
      configurado: config().valido,
      cliente: !!N.cliente,
      logado: logado(),
      verificado: verificado(),
      vinculada: vinculada(),
      erro: N.erro,
      emSala: !!N.sala,
      transporte: N.sala ? (N.porSegundo ? 'varredura' : 'realtime') : null,
      dueloLiberado: dueloLiberado(),
    };
  },
  // Peças que o duelo e a tela de conexão precisam para falar a verdade.
  dueloLiberado: dueloLiberado,
  bloqueioDoDuelo: motivoDoBloqueio,
  codigoDe: codigoDe,
  frearLance: frearLance,
};
})(typeof window !== 'undefined' ? window : this);
