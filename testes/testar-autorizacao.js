/* ===================================================
   CANDY MATH — testes/testar-autorizacao.js
   Teste de autorização DE VERDADE, contra o banco ligado: ele faz as mesmas
   chamadas que o navegador faz e confere o que o Postgres responde.

   Precisamente por isso ele não roda aqui sozinho: precisa de um projeto
   Supabase e de três contas de teste. Sem elas este arquivo não finge que
   passou — ele diz o que falta e sai sem alterar nada. Quem escreve os
   resultados em RELATORIO-TESTES.md é você, depois de rodar.

   O que ele prova (o mesmo mapa do testes/testar-rls.sql, pelo lado HTTP):
     A1 sem login, pela chave pública: nenhuma linha de salas e de jogadas
     A2 sem login: as portas do duelo recusam
     A3 conta estranha que sabe o código: não lê a sala nem os lances
     A4 conta estranha: não escreve lance na mesa alheia
     A5 membro: lê a própria mesa (prova positiva)
     A6 escrita direta em salas/jogadas: recusada
     A7 forja de autor/assento: o banco grava quem realmente chamou
     A8 payload inválido/gigante/tipo desconhecido: recusado
     A9 progresso alheio: nem leitura, nem reescrita

   Como rodar:
     1. crie três contas em Authentication → Users (e-mails que você controla)
     2. copie .env.example para .env e preencha SUPABASE_URL, SUPABASE_ANON_KEY
        e os três pares CM_TESTE_n_EMAIL / CM_TESTE_n_SENHA
     3. node testes/testar-autorizacao.js
   =================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { RAIZ } = require('./_raiz.js');

// ── ambiente ──────────────────────────────────────────────
// O .env do projeto só é lido aqui, e só para este teste. O navegador nunca
// vê este arquivo (está no .gitignore).
function carregarEnvLocal() {
  const alvo = path.join(RAIZ, '.env');
  if (!fs.existsSync(alvo)) return;
  fs.readFileSync(alvo, 'utf8').split('\n').forEach((linha) => {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha);
    if (!m) return;
    if (typeof process.env[m[1]] === 'undefined') {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  });
}
carregarEnvLocal();

const URL_BASE = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const CHAVE = process.env.SUPABASE_ANON_KEY || '';
const CONTAS = [1, 2, 3].map((i) => ({
  email: process.env['CM_TESTE_' + i + '_EMAIL'] || '',
  senha: process.env['CM_TESTE_' + i + '_SENHA'] || '',
}));

const faltando = [];
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(URL_BASE) && !/^http:\/\/(localhost|127\.0\.0\.1)/i.test(URL_BASE)) {
  faltando.push('SUPABASE_URL (ex.: https://abcdef.supabase.co)');
}
if (!CHAVE) faltando.push('SUPABASE_ANON_KEY (a chave pública do projeto)');
CONTAS.forEach((c, i) => {
  if (!c.email) faltando.push('CM_TESTE_' + (i + 1) + '_EMAIL');
  if (!c.email && !c.senha) return;
  if (c.email && !c.senha) faltando.push('CM_TESTE_' + (i + 1) + '_SENHA');
});

const tokens = [];

// ── saída ────────────────────────────────────────────────
let aprovados = 0;
let reprovados = 0;

function ok(rotulo, detalhe) { aprovados++; console.log('  ✓ ' + rotulo + (detalhe ? ' — ' + detalhe : '')); }
function nao(rotulo, detalhe) { reprovados++; console.log('  ✗ ' + rotulo + (detalhe ? ' — ' + detalhe : '')); }
function informativo(rotulo, detalhe) { console.log('  · ' + rotulo + (detalhe ? ' — ' + detalhe : '')); }

function exige(condicao, rotulo, detalhe) {
  if (condicao) ok(rotulo, detalhe); else nao(rotulo, detalhe);
  return !!condicao;
}

// ── transporte ────────────────────────────────────────────
async function chamar(rota, { metodo = 'GET', corpo, token, cabe } = {}) {
  const cab = Object.assign({ apikey: CHAVE, 'Content-Type': 'application/json' }, cabe || {});
  if (token) { cab.Authorization = 'Bearer ' + token; }
  let resposta;
  try {
    resposta = await fetch(URL_BASE + rota, {
      method: metodo,
      headers: cab,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch (e) {
    return { status: 0, erro: 'rede: ' + e.message, dados: null };
  }
  const texto = await resposta.text();
  let dados = null;
  try { dados = JSON.parse(texto); } catch (e) { dados = texto; }
  return { status: resposta.status, dados: dados, texto: texto };
}

const rpc = (fn, args, token) =>
  chamar('/rest/v1/rpc/' + fn, { metodo: 'POST', corpo: args, token: token });

// ── entrada ───────────────────────────────────────────────
async function entrar(conta) {
  const r = await chamar('/auth/v1/token?grant_type=password',
    { metodo: 'POST', corpo: { email: conta.email, password: conta.senha } });
  if (r.status !== 200 || !r.dados || !r.dados.access_token) {
    return null;
  }
  return r.dados.access_token;
}

async function montarMesa(tokensDaMesa) {
  // A mesa é montada pelo próprio app: quem abre abre, quem entra entra. Nada
  // de fixture direto no banco — aqui interessa exatamente o caminho do
  // navegador.
  const aberta = await rpc('criar_sala', {}, tokensDaMesa[0]);
  if (aberta.status !== 200 || !Array.isArray(aberta.dados) || !aberta.dados.length) {
    return null;
  }
  const codigo = aberta.dados[0].codigo;
  const entrada = await rpc('entrar_na_sala', { p_codigo: codigo }, tokensDaMesa[1]);
  if (entrada.status !== 200) return { codigo, sentou: false, erro: entrada.dados };
  return { codigo, sentou: true };
}

const CONTAS_DADO = {
  densidade: 20,
  contas: [{ txt: '7 + 5', resposta: '12', u: 'numeros', ref: 'EF03MA01' }],
};

// ── cenários ──────────────────────────────────────────────
async function cenario_sem_login() {
  console.log('\nA1/A2 — a chave pública sozinha, sem conta');
  const salas = await chamar('/rest/v1/salas?select=codigo');
  if (salas.status === 401 || salas.status === 403 || salas.status === 404) {
    ok('anon não lista salas', 'HTTP ' + salas.status);
  } else if (Array.isArray(salas.dados) && salas.dados.length === 0) {
    ok('anon lista salas e recebe zero linhas');
  } else {
    nao('anon não lista salas', 'HTTP ' + salas.status + ' com ' +
      (Array.isArray(salas.dados) ? salas.dados.length + ' linhas' : JSON.stringify(salas.dados).slice(0, 80)));
  }

  const jogadas = await chamar('/rest/v1/jogadas?select=sala');
  exige(Array.isArray(jogadas.dados) ? jogadas.dados.length === 0 : jogadas.status >= 400,
    'anon não lê jogadas', 'HTTP ' + jogadas.status);

  for (const [fn, args] of [['criar_sala', {}], ['entrar_na_sala', { p_codigo: 'AAAAAAAA' }],
    ['registrar_jogada', { p_sala: 'AAAAAAAA', p_tipo: 'duelo:acerto', p_dado: { peca: 'x', conta: '1', tempo: '1' } }],
    ['purgar_salas_velhas', {}]]) {
    const r = await rpc(fn, args, null);
    exige(r.status === 401 || r.status === 403, fn + '() recusada para anon', 'HTTP ' + r.status);
  }
}

async function cenario_estranho(mesa) {
  console.log('\nA3/A4 — a terceira conta, que conhece o código da mesa');
  const intruso = tokens[2];

  const lerSala = await chamar('/rest/v1/salas?codigo=eq.' + mesa.codigo + '&select=*', { token: intruso });
  exige(Array.isArray(lerSala.dados) && lerSala.dados.length === 0,
    'estranho não enxerga a sala pelo código',
    Array.isArray(lerSala.dados) ? lerSala.dados.length + ' linhas' : 'HTTP ' + lerSala.status);

  const lerLances = await chamar('/rest/v1/jogadas?sala=eq.' + mesa.codigo + '&select=*', { token: intruso });
  exige(Array.isArray(lerLances.dados) && lerLances.dados.length === 0,
    'estranho não lê os lances da mesa alheia',
    Array.isArray(lerLances.dados) ? lerLances.dados.length + ' linhas' : 'HTTP ' + lerLances.status);

  const escrever = await rpc('registrar_jogada',
    { p_sala: mesa.codigo, p_tipo: 'duelo:acerto', p_dado: { peca: 'x', conta: '7 + 5', tempo: '2' } }, intruso);
  exige(escrever.status >= 400, 'estranho não grava lance na mesa dos outros',
    'HTTP ' + escrever.status + ' ' + JSON.stringify(escrever.dados).slice(0, 90));

  const encerrar = await rpc('encerrar_sala', { p_sala: mesa.codigo }, intruso);
  exige(encerrar.status >= 400, 'estranho não encerra a mesa alheia', 'HTTP ' + encerrar.status);

  const invadir = await chamar('/rest/v1/salas',
    { metodo: 'POST', token: intruso, corpo: { codigo: 'MANU0001', anfitriao: intruso ? '00000000-0000-0000-0000-000000000000' : null } });
  exige(invadir.status >= 400, 'insert direto em salas é recusado', 'HTTP ' + invadir.status);

  const invadir2 = await chamar('/rest/v1/jogadas',
    { metodo: 'POST', token: intruso, corpo: { sala: mesa.codigo, assento: 0, tipo: 'duelo:acerto', dado: {} } });
  exige(invadir2.status >= 400, 'insert direto em jogadas é recusado', 'HTTP ' + invadir2.status);
}

async function cenario_membros(mesa) {
  console.log('\nA5 — os dois da mesa (prova positiva)');
  const ler1 = await chamar('/rest/v1/salas?codigo=eq.' + mesa.codigo + '&select=codigo,estado',
    { token: tokens[0] });
  exige(Array.isArray(ler1.dados) && ler1.dados.length === 1,
    'o anfitrião lê a própria sala', JSON.stringify(ler1.dados).slice(0, 80));

  const ler2 = await chamar('/rest/v1/salas?codigo=eq.' + mesa.codigo + '&select=codigo',
    { token: tokens[1] });
  exige(Array.isArray(ler2.dados) && ler2.dados.length === 1, 'o desafiante lê a mesma sala');

  const partida = await rpc('registrar_jogada',
    { p_sala: mesa.codigo, p_tipo: 'duelo:partida', p_dado: CONTAS_DADO }, tokens[0]);
  exige(partida.status === 200, 'o anfitrião entrega as contas', 'HTTP ' + partida.status);

  const lances = await chamar('/rest/v1/jogadas?sala=eq.' + mesa.codigo + '&select=*', { token: tokens[1] });
  exige(Array.isArray(lances.dados) && lances.dados.length >= 1,
    'o desafiante vê os lances da mesa dele',
    Array.isArray(lances.dados) ? lances.dados.length + ' linhas' : 'HTTP ' + lances.status);
  return lances;
}

async function cenario_forja(mesa) {
  console.log('\nA7 — o navegador não escolhe autor nem assento');
  // O desafiante finge ser o assento 0 e assina como o anfitrião.
  const tentativa = await rpc('registrar_jogada', {
    p_sala: mesa.codigo,
    p_tipo: 'duelo:acerto',
    p_dado: { peca: 'x', conta: '7 + 5', tempo: '3', assento: 0,
      autor: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
  }, tokens[1]);

  if (tentativa.status !== 200) {
    // Fora da vez também é uma resposta correta: o turno é real.
    ok('lance fora da vez travado pelo banco', 'HTTP ' + tentativa.status);
    const ler = await chamar('/rest/v1/jogadas?sala=eq.' + mesa.codigo + '&select=*', { token: tokens[0] });
    const ultimo = (ler.dados || []).slice(-1)[0];
    exige(!ultimo || ultimo.assento === 0, 'nenhum lance gravado com assento forjado');
    return;
  }
  const ler = await chamar('/rest/v1/jogadas?sala=eq.' + mesa.codigo + '&select=*', { token: tokens[0] });
  const ultimo = (ler.dados || []).slice(-1)[0];
  exige(ultimo && ultimo.assento === 1, 'o banco gravou o assento real (1), não o enviado (0)',
    ultimo ? 'assento=' + ultimo.assento : 'sem linha');
  exige(ultimo && ultimo.autor !== 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'o autor gravado é a conta que chamou, não a que o JSON pediu');
}

async function cenario_payload(mesa) {
  console.log('\nA8 — o que o navegador manda é conferido antes de virar linha');
  const casos = [
    ['tipo desconhecido', { p_sala: mesa.codigo, p_tipo: 'duelo:xingamento', p_dado: { tempo: '1' } }],
    ['lance que não é objeto', { p_sala: mesa.codigo, p_tipo: 'duelo:acerto', p_dado: 'texto solto' }],
    ['acerto sem conta', { p_sala: mesa.codigo, p_tipo: 'duelo:acerto', p_dado: { peca: 'x' } }],
    ['unidade fora da BNCC', { p_sala: mesa.codigo, p_tipo: 'duelo:partida',
      p_dado: { densidade: 20, contas: [{ txt: '1+1', resposta: '2', u: 'bobagem' }] } }],
    ['densidade malformada', { p_sala: mesa.codigo, p_tipo: 'duelo:partida',
      p_dado: { densidade: '20; DROP TABLE salas', contas: CONTAS_DADO.contas } }],
    ['sala que não existe', { p_sala: 'ZZZZZZZZ', p_tipo: 'duelo:acerto',
      p_dado: { peca: 'x', conta: '1', tempo: '1' } }],
  ];
  for (const [rotulo, args] of casos) {
    const r = await rpc('registrar_jogada', args, tokens[0]);
    exige(r.status >= 400, 'recusado: ' + rotulo, 'HTTP ' + r.status);
  }

  const grande = await rpc('registrar_jogada', { p_sala: mesa.codigo, p_tipo: 'duelo:acerto',
    p_dado: { peca: 'x', conta: 'a'.repeat(70000), tempo: '1' } }, tokens[0]);
  exige(grande.status >= 400, 'recusado: lance de 70 mil caracteres', 'HTTP ' + grande.status);

  const salasRest = await chamar('/rest/v1/salas?codigo=eq.' + mesa.codigo + '&select=estado',
    { token: tokens[0] });
  const estado = ((salasRest.dados || [])[0] || {}).estado;
  informativo('estado da mesa depois de todas as tentativas', String(estado));
}

async function cenario_progresso() {
  console.log('\nA9 — boletim de outra criança');
  const ler = await chamar('/rest/v1/progressos?select=*', { token: tokens[2] });
  exige(Array.isArray(ler.dados) ? ler.dados.length === 0 : ler.status >= 400,
    'quem não tem vínculo não lista progresso',
    Array.isArray(ler.dados) ? ler.dados.length + ' linhas' : 'HTTP ' + ler.status);

  const escrever = await chamar('/rest/v1/progressos',
    { metodo: 'POST', token: tokens[2], corpo: { codigo_crianca: 'TESTE00000', dados: { estrelas: 1 } },
      cabe: { Prefer: 'return=representation' } });
  exige(escrever.status >= 400, 'criar progresso de criança que não é sua é recusado',
    'HTTP ' + escrever.status);

  const formatar = await rpc('vincular_por_codigo', { p_codigo: 'a'.repeat(400) }, tokens[2]);
  exige(formatar.status >= 400, 'código com formato absurdo recusado antes da busca',
    'HTTP ' + formatar.status);
}

async function cenario_fluxo_offline() {
  console.log('\nA10 — o duelo continua bloqueado pelo config');
  const config = fs.readFileSync(path.join(RAIZ, 'config.js'), 'utf8');
  const ligada = /dueloRedeHabilitado\s*:\s*true/.test(config);
  exige(!ligada, 'o duelo por rede segue desligado no config.js',
    ligada ? 'dueloRedeHabilitado: true' : 'dueloRedeHabilitado: false');
}

// ── A0: o interruptor, conferido sem banco ────────────────
// Roda sempre, com ou sem credenciais. O teste de verdade (A1…A9) prova o
// Postgres; este aqui prova o navegador: cada porta que fala com o banco tem
// de esbarrar na conferência de direito ANTES da chamada. Se alguém ligar o
// duelo no config amanhã, o que segura ainda é este código.
function corpoDe(fonte, nome) {
  const inicio = fonte.indexOf('function ' + nome + '(');
  if (inicio < 0) return null;
  let i = fonte.indexOf('{', inicio);
  if (i < 0) return null;
  let profundidade = 0;
  for (let p = i; p < fonte.length; p++) {
    const c = fonte[p];
    if (c === "'" || c === '"' || c === '`') {                 // string: não conta
      const fim = fonte.indexOf(c, p + 1);
      if (fim < 0) return null;
      p = fim;
      continue;
    }
    if (c === '/' && fonte[p + 1] === '/') { p = fonte.indexOf('\n', p); if (p < 0) break; continue; }
    if (c === '/' && fonte[p + 1] === '*') { p = fonte.indexOf('*/', p + 2) + 1; continue; }
    if (c === '{') profundidade++;
    else if (c === '}') {
      profundidade--;
      if (profundidade === 0) return fonte.slice(i, p + 1);
    }
  }
  return null;
}

function preflight() {
  console.log('\nA0 — cada porta de rede do navegador tem o interruptor na frente');
  const nuvem = fs.readFileSync(path.join(RAIZ, 'nuvem.js'), 'utf8');
  const config = fs.readFileSync(path.join(RAIZ, 'config.js'), 'utf8');
  const duelo = fs.readFileSync(path.join(RAIZ, 'duelo.js'), 'utf8');

  // O interruptor existe, é único e recusa em vez de desligar na maciota.
  exige(/dueloRedeHabilitado\s*:\s*false/.test(config),
    'o config.js entrega o duelo desligado', 'dueloRedeHabilitado: false');

  const exigente = corpoDe(nuvem, 'exigirDueloLiberado');
  exige(!!exigente && /throw new Error/.test(exigente),
    'quem tenta abrir a sala sem direito recebe um erro, não um "segue o baile"',
    exigente ? 'throw' : 'função não encontrada');

  const liberado = corpoDe(nuvem, 'dueloLiberado');
  exige(!!liberado && /dueloRedeHabilitado\s*===\s*true/.test(liberado)
      && /ativa\(\)/.test(liberado) && /logado\(\)/.test(liberado),
    'o direito de jogar em rede pede as três coisas: config ligado, banco e conta',
    liberado ? 'config + ativa + logado' : 'função não encontrada');

  // Cada porta, e a porta tem de vir antes da chamada. Não basta a conferência
  // estar no arquivo: ela tem de estar no caminho.
  const PORTAS = [
    ['criarSala', 'criar_sala', /exigirDueloLiberado\(\)/],
    ['entrarSala', 'entrar_na_sala', /exigirDueloLiberado\(\)/],
    ['gravarJogada', 'registrar_jogada', /dueloLiberado\(\)/],
    ['avisouSaida', 'sair_da_sala', /dueloLiberado\(\)/],
    // O que fala de progresso pessoal só sobe para uma conta verificada com
    // criança registrada; aqui o interessado é o mesmo: nenhum dado de criança
    // sai do aparelho sem dono.
    ['subirProgresso', "from('progressos')", /logado\(\)/],
    ['baixarProgresso', "from('progressos')", /logado\(\)/],
    ['registrarCrianca', "from('criancas')", /verificado\(\)/],
    ['listarCriancas', "from('criancas_visiveis')", /logado\(\)/],
    ['vincularPorCodigo', 'vincular_por_codigo', /logado\(\)/],
    // Apagar é a operação que mais precisa de dono: sem sessão não se pede
    // exclusão a banco nenhum.
    ['apagarRegistros', 'apagar_meus_registros', /logado\(\)/],
  ];
  PORTAS.forEach((porta) => {
    const corpo = corpoDe(nuvem, porta[0]);
    if (!corpo) { nao(porta[0] + ': a função que fala com o banco não foi encontrada'); return; }
    const chamada = corpo.indexOf(porta[1]);
    if (chamada < 0) { nao(porta[0] + ': procurei ' + porta[1] + ' dentro dela e não está lá'); return; }
    const guard = corpo.search(porta[2]);
    exige(guard >= 0 && guard < chamada,
      porta[0] + ': conferido antes de ' + porta[1],
      guard < 0 ? 'sem conferência' : 'conferência na posição ' + guard + ' · chamada na ' + chamada);
  });

  // A varredura de mensagens e o canal Realtime leem a tabela de lances direto.
  // Eles só existem depois de abrirSala(), que só vem das portas conferidas
  // acima — mas a leitura não pode depender dessa implicação.
  const varredura = corpoDe(nuvem, 'varredura');
  const escutar = corpoDe(nuvem, 'escutar');
  exige(!!varredura && !!escutar && /N\.sala/.test(varredura) && /N\.sala/.test(escutar),
    'a leitura de lances só anda junto de uma sala já aberta',
    varredura && escutar ? 'as duas funções olham N.sala' : 'função não encontrada');

  // O chip da tela não é a única defesa: o modo "rede" é recusado no clique.
  exige(/b\.dataset\.modo === 'rede' && !redeLigada\(\)/.test(duelo),
    'o duelo.js recusa o modo rede no clique, não só no desenho do chip');
  exige(/function sala\(acao, codigo\)/.test(duelo) &&
      /nuvem\.criarSala\(\)/.test(duelo) && /nuvem\.entrarSala\(codigo\)/.test(duelo),
    'criar/entrar sala passam pelo nuvem.js — onde está a conferência');

  // Sobrou alguma porta sem donos? Toda chamada de rede do arquivo mora numa
  // função conferida.
  const GATES = /dueloLiberado\(\)|exigirDueloLiberado\(\)|logado\(\)|verificado\(\)|vinculada\(\)/;
  const nomesD = /function ([A-Za-zÀ-ú_][\wÀ-ú]*)\s*\(/g;
  const huves = [];
  let m;
  while ((m = nomesD.exec(nuvem))) {
    const corpo = corpoDe(nuvem, m[1]);
    if (!corpo) continue;
    if (!/N\.cliente\.(rpc|from|channel)\(/.test(corpo)) continue;
    if (!GATES.test(corpo)) huves.push(m[1]);
  }
  exige(huves.length === 0, 'nenhuma chamada de rede ficou fora das funções conferidas',
    huves.length ? 'sem gate: ' + huves.join(', ') : 'todas as portas conferem antes');
}

// ── execução ──────────────────────────────────────────────
(async function principal() {
  console.log('autorização do duelo — ' + (URL_BASE || '(sem SUPABASE_URL)'));
  preflight();

  if (faltando.length) {
    console.log('\nNÃO EXECUTADO — faltam credenciais de teste. Nada foi provado aqui.');
    faltando.forEach((f) => console.log('  falta: ' + f));
    console.log('\nIsto não é uma falha do código: é um teste que exige um projeto');
    console.log('Supabase seu. Preencha .env (veja .env.example) e rode de novo.');
    console.log('Enquanto isso, o duelo continua desligado em config.js — que é o');
    console.log('estado certo: sem esta prova, não há como dizer que é seguro.');
    console.log('\n' + aprovados + ' verificações aprovadas (só o A0, sem banco) · '
      + reprovados + ' falhas');
    process.exitCode = reprovados ? 1 : 0;
    return;
  }

  for (let i = 0; i < CONTAS.length; i++) {
    const t = await entrar(CONTAS[i]);
    if (!t) {
      console.log('\nNÃO EXECUTADO — a conta CM_TESTE_' + (i + 1) + '_EMAIL não entrou.');
      console.log('  veja se ela existe em Authentication → Users e se a confirmação de');
      console.log('  e-mail está desligada para as contas de teste.');
      console.log('  nada foi provado.');
      process.exitCode = 0;
      return;
    }
    tokens.push(t);
  }
  informativo('três contas autenticadas', CONTAS.map((c) => c.email).join(' · '));

  await cenario_sem_login();

  const mesa = await montarMesa(tokens);
  if (!mesa || !mesa.sentou) {
    console.log('\nNÃO EXECUTADO — não deu para montar a mesa de teste.');
    console.log('  criar_sala()/entrar_na_sala() responderam: ' +
      JSON.stringify(mesa && mesa.erro ? mesa.erro : 'sem resposta').slice(0, 200));
    console.log('  o schema novo está aplicado neste projeto? (supabase/schema.sql)');
    process.exitCode = 0;
    return;
  }
  informativo('mesa de teste', mesa.codigo);

  await cenario_estranho(mesa);
  await cenario_membros(mesa);
  await cenario_forja(mesa);
  await cenario_payload(mesa);
  await cenario_progresso();
  await cenario_fluxo_offline();

  // Encerra a mesa de teste para não deixar sala aberta no projeto.
  await rpc('encerrar_sala', { p_sala: mesa.codigo }, tokens[0]);

  console.log('\n' + aprovados + ' verificações aprovadas · ' + reprovados + ' falhas de autorização');
  if (reprovados) {
    console.log('Estes resultados são do SEU banco. Uma falha aqui é um buraco real:');
    console.log('mantenha o duelo desligado até a política consertada passar.');
  }
  process.exitCode = reprovados ? 1 : 0;
})();
