/* ===================================================
   CANDY MATH — testes/testar-narracao.js

   ★ TESTE SIMULADO ★
   Nenhuma requisição real é feita ao Fish Audio aqui. O ambiente (variáveis),
   a rede (fetch) e o relógio são fornecidos por este arquivo, e o navegador é
   um falso com localStorage, Audio, Blob, URL e Web Speech de mentirinha.
   Passar neste teste prova a LÓGICA da ponte de voz — o que é aceito, o que é
   recusado, o que sobe, o que cai no aparelho. Não prova que a síntese real
   funciona: isso só se confirma com uma chamada autorizada, feita pelo dono do
   projeto com a própria chave (veja CONFIGURACAO-DEPLOY.md, passo "ouvir a
   primeira frase").

   Rodar: node testes/testar-narracao.js
   =================================================== */
'use strict';

const fs = require('fs');
const vm = require('vm');
const { emRaiz } = require('./_raiz.js');

const nucleo = require('../api/_voz-nucleo.js');

// Uma chave que não é chave: se este valor aparecer em qualquer resposta, em
// qualquer log, em qualquer requisição do navegador, o teste falha.
const CHAVE_FALSA = 'peixe-falso-6dc0699d1b3d4d639a2f6f3e8d5b7c11';
const PEDIDO_LIMPO = { texto: 'Sete mais cinco são doze.', voz: 'sara' };

const ok = [];
const falhas = [];
function exige(condicao, descricao) {
  if (condicao) ok.push('✓ ' + descricao);
  else falhas.push('✗ ' + descricao);
}
function semVazamento(resultado) {
  const serializado = JSON.stringify(
    (resultado && (resultado.corpo || resultado.headers)) || {}
  ) + String(resultado && resultado.status);
  return serializado.indexOf(CHAVE_FALSA) < 0 && !/Bearer/i.test(serializado);
}

// ── miolo: serviço com ambiente, rede e relógio falsos ─────────────────
function montarNucleo(maqueta) {
  const env = Object.assign({}, maqueta.env || {});
  if (env.FISH_AUDIO_API_KEY === undefined) {
    env.FISH_AUDIO_API_KEY = maqueta.semChave ? '' : CHAVE_FALSA;
  }
  const estado = {
    chamadas: [],
    relogio: 1730000000000,
    avancar(ms) { estado.relogio += ms; },
  };
  const fila = (maqueta.http || []).slice();
  const fetchFalso = async function (url, opcoes) {
    estado.chamadas.push({ url, opcoes });
    const r = fila.length ? fila.shift() : { bytes: Buffer.from([7, 7, 7]) };
    if (r.lancar) throw new Error(String(r.lancar));
    const status = r.status || (r.ok === false ? 500 : 200);
    return {
      ok: status >= 200 && status < 300,
      status: status,
      arrayBuffer: async () => (r.bytes || new ArrayBuffer(0)),
    };
  };
  estado.servico = nucleo.criarServico({
    env: env,
    fetch: fetchFalso,
    agora: () => estado.relogio,
    contador: nucleo.criarContador(),
    sinal: () => undefined,
  });
  return estado;
}

async function pedir(estado, corpo, ip) {
  return estado.servico.processar({ corpo: corpo, ip: ip || '203.0.113.7' });
}

// ── casca da Vercel: req/res falsos, ambiente controlado por cenário ────
// A função lê o ambiente e a rede no momento em que é carregada (criarServico()
// roda no topo do módulo), então cada cenário recarrega o módulo com as próprias
// variáveis e um fetch falso — e devolve o processo ao estado de antes.
async function chamarAdaptador(maqueta) {
  const ambiente = Object.assign({ FISH_AUDIO_API_KEY: CHAVE_FALSA }, maqueta.env || {});
  const guardados = {};
  Object.keys(ambiente).forEach((nome) => {
    guardados[nome] = process.env[nome];
    process.env[nome] = ambiente[nome];
  });
  const chamadas = [];
  const fetchAntigo = globalThis.fetch;
  globalThis.fetch = async function (url, opcoes) {
    chamadas.push({ url, opcoes });
    const status = maqueta.status || 200;
    const bytes = maqueta.bytes || Buffer.from([1, 2, 3, 4]);
    return { ok: status < 400, status: status, arrayBuffer: async () => bytes };
  };
  const caminhoCasca = require.resolve('../api/voz.js');
  const caminhoMiolo = require.resolve('../api/_voz-nucleo.js');
  delete require.cache[caminhoCasca];
  delete require.cache[caminhoMiolo];

  const cabecalhos = {};
  let textoSaid = null;
  let audioSaid = null;
  const res = {
    statusCode: 0,
    setHeader(nome, valor) { cabecalhos[nome] = valor; return res; },
    end(dados) {
      if (Buffer.isBuffer(dados) || dados instanceof Uint8Array) audioSaid = dados;
      else if (typeof dados === 'string') textoSaid = dados;
      return res;
    },
  };
  const req = Object.assign({ method: 'POST', headers: {}, body: JSON.stringify(PEDIDO_LIMPO) },
    maqueta.req || {});

  try {
    await require(caminhoCasca)(req, res);
  } finally {
    Object.keys(ambiente).forEach((nome) => {
      if (guardados[nome] === undefined) delete process.env[nome];
      else process.env[nome] = guardados[nome];
    });
    globalThis.fetch = fetchAntigo;
    delete require.cache[caminhoCasca];
    delete require.cache[caminhoMiolo];
  }
  return { status: res.statusCode, cabecalhos, texto: textoSaid, audio: audioSaid, chamadas };
}

// ── navegador falso para o módulo do jogo ───────────────────────────────
// Os ids que a tela de voz pinta só existem no DOM falso se existirem no
// index.html de verdade: assim um id errado no módulo não "passa" no teste.
const PAGINA = fs.readFileSync(emRaiz('index.html'), 'utf8');
const IDS_REAIS = new Set((PAGINA.match(/id="[\w-]+"/g) || []).map((s) => s.slice(4, -1)));

function montarDomFalso() {
  const porId = new Map();
  const noDocumento = { ouvintes: {} };

  function elemento(tag) {
    const classes = new Set();
    const el = {
      tagName: String(tag || 'div').toUpperCase(),
      textContent: '', hidden: false, disabled: false, title: '', type: '',
      dataset: {}, attrs: {}, filhos: [], ouvintes: {}, style: {}, parentNode: null,
    };
    Object.defineProperty(el, 'className', {
      get() { return Array.from(classes).join(' '); },
      set(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((c) => classes.add(c)); },
    });
    el.classList = {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c, on) => {
        if (on === undefined) { if (classes.has(c)) classes.delete(c); else classes.add(c); }
        else if (on) classes.add(c);
        else classes.delete(c);
        return classes.has(c);
      },
    };
    el.setAttribute = (n, v) => { el.attrs[n] = String(v); if (n === 'class') el.className = String(v); };
    el.getAttribute = (n) => (n === 'class' ? el.className
      : Object.prototype.hasOwnProperty.call(el.attrs, n) ? el.attrs[n] : null);
    el.appendChild = (c) => { el.filhos.push(c); c.parentNode = el; return c; };
    el.addEventListener = (nome, f) => { (el.ouvintes[nome] = el.ouvintes[nome] || []).push(f); };
    el.click = () => (el.ouvintes.click || []).forEach((f) => f({ target: el, stopPropagation() {} }));
    el.querySelector = (sel) => procurar(el, sel)[0] || null;
    el.querySelectorAll = (sel) => procurar(el, sel);
    return el;
  }

  function tokenDe(sel) { const m = /\.([\w-]+)\s*$/.exec(sel); return m ? m[1] : null; }

  function procurar(ponto, sel) {
    const token = tokenDe(sel);
    const inicial = /^#([\w-]+)/.exec(sel);
    let raiz = ponto;
    if (inicial) raiz = porId.get(inicial[1]) || null;
    if (!raiz || !token) return [];
    const achados = [];
    const visitar = (el) => {
      (el.filhos || []).forEach((c) => {
        if (c.classList && c.classList.contains(token)) achados.push(c);
        visitar(c);
      });
    };
    if (raiz === documento) porId.forEach((el) => visitar(el));
    else { if (raiz.classList.contains(token)) achados.push(raiz); visitar(raiz); }
    return achados;
  }

  const documento = {
    readyState: 'complete',
    ouvintes: noDocumento.ouvintes,
    getElementById: (id) => {
      if (!IDS_REAIS.has(id)) return null;
      if (!porId.has(id)) porId.set(id, elemento('div'));
      return porId.get(id);
    },
    createElement: (tag) => elemento(tag),
    querySelector: (sel) => procurar(documento, sel)[0] || null,
    querySelectorAll: (sel) => procurar(documento, sel),
    addEventListener: (nome, f) => { (noDocumento.ouvintes[nome] = noDocumento.ouvintes[nome] || []).push(f); },
  };
  return { documento, porId, ouvintes: noDocumento.ouvintes };
}

function montarNavegador(maqueta) {
  const m = maqueta || {};
  let seq = 0;
  const estado = {
    fetches: [],
    falas: [],
    tocados: [],
    pausados: [],
    revogados: [],
    cancelou: 0,
    audios: [],
    storage: new Map(),
    errosDeTela: [],
    ouvintesJanela: {},
  };

  const sandbox = {
    console: { warn: (msg, e) => estado.errosDeTela.push(String(msg) + ' :: ' + String((e && e.message) || e)) },
    addEventListener: (nome, f) => {
      (estado.ouvintesJanela[nome] = estado.ouvintesJanela[nome] || []).push(f);
    },
    CM_CONFIG: {
      narracao: {
        endpoint: m.endpoint === undefined ? '/api/voz' : m.endpoint,
        preferencia: m.preferencia || 'peixe',
        vozes: m.vozes === undefined
          ? [{ id: 'sara', rotulo: 'Sara' }, { id: 'miguel', rotulo: 'Miguel' }]
          : m.vozes,
        maximoCaracteres: m.maximoCaracteres || 320,
      },
    },
    localStorage: {
      getItem: (k) => (estado.storage.has(k) ? estado.storage.get(k) : null),
      setItem: (k, v) => { estado.storage.set(k, String(v)); },
    },
    URL: {
      createObjectURL: () => { seq += 1; return 'blob:falso-' + seq; },
      revokeObjectURL: (u) => { estado.revogados.push(u); },
    },
    Blob: function BlobFake() { this.partes = Array.prototype.slice.call(arguments); },
    Audio: function AudioFake(url) {
      const a = {
        url: url,
        play() {
          if (m.bloqueioDeReproducao) return Promise.reject(new Error('bloqueado pelo navegador'));
          estado.tocados.push(url);
          return Promise.resolve();
        },
        pause() { estado.pausados.push(url); },
      };
      estado.audios.push(a);
      return a;
    },
    navigator: { onLine: m.onLine === undefined ? true : m.onLine },
    setTimeout: (fn) => { estado.tempoProgramado = fn; return 1; },
    clearTimeout: () => { estado.tempoProgramado = null; },
    fetch: async function (url, opcoes) {
      estado.fetches.push({ url, opcoes });
      if (m.recusa === 'abort') {
        const e = new Error('aborted'); e.name = 'AbortError'; throw e;
      }
      if (m.recusa === 'rede') throw new TypeError('failed to fetch');
      const status = m.status || 200;
      return {
        ok: status < 400,
        status: status,
        arrayBuffer: async () => (status < 400 ? new Uint8Array([1, 2, 3]) : new ArrayBuffer(0)),
      };
    },
  };
  if (!m.semSinteseNativa) {
    sandbox.speechSynthesis = {
      cancel() { estado.cancelou += 1; },
      speak(fala) { estado.falas.push(fala); },
    };
    sandbox.SpeechSynthesisUtterance = function FalaFake(texto) { this.text = texto; };
  }
  if (m.comAbortador) {
    sandbox.AbortController = function AbortFake() {
      this.signal = { aborted: false };
      sandbox._sinal = this.signal;
    };
  }

  if (m.dom) {
    const dom = montarDomFalso();
    dom.documento.readyState = m.domPronto === false ? 'loading' : 'complete';
    sandbox.document = dom.documento;
    estado.dom = dom;
    estado.porId = dom.porId;
    estado.textoDe = (id) => {
      const el = dom.porId.get(id);
      return el ? String(el.textContent) : null;
    };
    estado.clique = (id) => {
      const el = dom.porId.get(id);
      if (!el) throw new Error('o DOM falso não chegou a criar #' + id);
      el.click();
    };
    estado.dispararJanela = (nome) => (estado.ouvintesJanela[nome] || []).forEach((f) => f({ type: nome }));
  }

  const codigo = fs.readFileSync(emRaiz('narracao.js'), 'utf8');
  vm.runInNewContext(codigo, sandbox);
  estado.narracao = sandbox.CM_NARRACAO;
  estado.sandbox = sandbox;
  if (!estado.narracao) throw new Error('narracao.js não expôs CM_NARRACAO no navegador falso');
  estado.amostras = [];
  estado.narracao.aoMudar((s) => estado.amostras.push(s));
  return estado;
}

function ultimo(estado) { return estado.amostras[estado.amostras.length - 1]; }

// ── rodando tudo ────────────────────────────────────────────────────────
async function principal() {
  // ═══ 1. O MIOLO ══════════════════════════════════════════════════════
  {
    const e = montarNucleo({ semChave: true });
    const r = await pedir(e, PEDIDO_LIMPO);
    exige(r.status === 503, 'sem FISH_AUDIO_API_KEY a função devolve 503 (e o jogo cai para o aparelho)');
    exige(e.chamadas.length === 0, 'sem chave nenhuma requisição de rede é tentada');
    exige(JSON.stringify(r.corpo).indexOf('FISH_AUDIO') < 0, 'a 503 não revela o nome da variável secreta para o navegador');
  }

  {
    const e = montarNucleo({});
    const r = await pedir(e, { texto: 'quanto é 2 mais 2?', voz: 'dora' });
    exige(r.status === 400, 'voz fora da lista do projeto é recusada (400)');
    exige(e.chamadas.length === 0, 'voz desconhecida não chega à API de síntese');
    const r2 = await pedir(e, { texto: 'oi', voz: 'https://example.com/x' });
    exige(r2.status === 400, 'o campo da voz não é tratado como endereço');
    const r3 = await pedir(e, 'texto solto');
    exige(r3.status === 400, 'corpo que não é objeto é recusado');
    const r4 = await pedir(e, [PEDIDO_LIMPO]);
    exige(r4.status === 400, 'corpo que é uma lista é recusado');
    const r5 = await pedir(e, null);
    exige(r5.status === 400, 'corpo ausente é recusado');
    exige(e.chamadas.length === 0, 'nenhum corpo malformado chega à upstream');
  }

  {
    const e = montarNucleo({});
    const casos = [
      ['vazio', { texto: '', voz: 'sara' }],
      ['só espaço', { texto: '    ', voz: 'sara' }],
      ['sem texto', { voz: 'sara' }],
      ['texto numérico', { texto: 12, voz: 'sara' }],
    ];
    for (const [nome, corpo] of casos) {
      const r = await pedir(e, corpo);
      exige(r.status === 400, 'texto ' + nome + ' é recusado antes de gastar synthesis');
    }
    exige(e.chamadas.length === 0, 'nenhum dos quatro textos inválidos subiu para a API');
  }

  {
    const e = montarNucleo({});
    const r = await pedir(e, { texto: '  <b>Sete</b>\te mais\r\n cinco\n\n são doze  ', voz: 'SARA ' });
    exige(r.status === 200, 'a voz aceita a grafia com espaços e maiúsculas (SARA → sara)');
    const corpoUp = JSON.parse(e.chamadas[0].opcoes.body);
    exige(corpoUp.text === 'Sete e mais cinco são doze',
      'a marcação e os controles saem do texto, sem deixar lixo falável: ' + JSON.stringify(corpoUp.text));
    exige(!/[<>]/.test(corpoUp.text) && !/[\u0000-\u001f\u007f]/.test(corpoUp.text),
      'sem sobra de HTML nem caractere de controle no que sobe');
    exige(/\s{2,}/.test(corpoUp.text) === false, 'os espaços viram um só no que sobe');
  }

  {
    const e = montarNucleo({});
    const r = await pedir(e, { texto: 'a'.repeat(5000), voz: 'sara' });
    exige(r.status === 200, 'texto gigante não derruba a função');
    const corpoUp = JSON.parse(e.chamadas[0].opcoes.body);
    exige(corpoUp.text.length === 320, 'o texto é cortado no teto de caracteres (320), não enviado inteiro');
  }

  {
    const e = montarNucleo({ env: { FISH_AUDIO_MAX: '24' } });
    await pedir(e, { texto: 'uma frase de tamanho médio para o jogo', voz: 'sara' });
    exige(JSON.parse(e.chamadas[0].opcoes.body).text.length === 24,
      'o teto é configurável por variável (FISH_AUDIO_MAX)');
  }

  {
    const e = montarNucleo({ env: { FISH_AUDIO_POR_HORA: '3' } });
    const primeiros = [];
    for (let i = 0; i < 3; i++) primeiros.push(await pedir(e, PEDIDO_LIMPO, '198.51.100.4'));
    exige(primeiros.every((r) => r.status === 200), 'as três primeiras frases do IP passam');
    const quarto = await pedir(e, PEDIDO_LIMPO, '198.51.100.4');
    exige(quarto.status === 429, 'a quarta frase do mesmo IP na mesma hora é barrada (429)');
    exige(quarto.headers['Retry-After'] === '60', 'a 429 traz Retry-After para o cliente saber esperar');
    exige(e.chamadas.length === 3, 'a requisição barrada não chega à API de síntese');
    const outro = await pedir(e, PEDIDO_LIMPO, '203.0.113.99');
    exige(outro.status === 200, 'o teto é por IP: outro visitante continua falando');
    e.avancar(3600001);
    const depois = await pedir(e, PEDIDO_LIMPO, '198.51.100.4');
    exige(depois.status === 200, 'passada uma hora o mesmo IP volta a poder');
  }

  {
    const e = montarNucleo({});
    const r = await pedir(e, Object.assign({}, PEDIDO_LIMPO, {
      url: 'https://exemplo-atacante.teste/rouba',
      endpoint: 'https://exemplo-atacante.teste/rouba',
      reference_id: 'f02406be1bd54f43842c049b4feba0ed',
      model: 'outro-modelo',
    }));
    exige(r.status === 200, 'campos extras no corpo são apenas ignorados');
    exige(e.chamadas[0].url === nucleo.ENDERECO_DA_API,
      'o destino é sempre a API do serviço: o cliente não escolhe para onde a função vai');
    const chavesUp = Object.keys(JSON.parse(e.chamadas[0].opcoes.body)).sort().join(',');
    exige(chavesUp === 'chunk_length,format,language,latency,normalize,prosody,reference_id,text',
      'o corpo que sobe tem exatamente os campos previstos, nada do pedido do cliente: ' + chavesUp);
    const subido = JSON.stringify(e.chamadas[0].opcoes).toLowerCase();
    exige(subido.indexOf('exemplo-atacante') < 0, 'nenhum endereço vindo do navegador é repassado');
    exige(subido.indexOf('f02406be') < 0, 'um reference_id forjado no corpo não chega à upstream');
  }

  {
    const e = montarNucleo({});
    const r = await pedir(e, PEDIDO_LIMPO);
    const cab = e.chamadas[0].opcoes.headers;
    exige(cab.Authorization === 'Bearer ' + CHAVE_FALSA, 'a chave sai apenas no Authorization da upstream');
    exige(cab.model === nucleo.MODELO_PADRAO, 'o modelo vai no cabeçalho, como a API documenta');
    exige(r.status === 200 && r.headers['Content-Type'] === 'audio/mpeg', 'sucesso devolve audio/mpeg');
    exige(r.headers['Cache-Control'] === 'no-store' && r.headers['X-Content-Type-Options'] === 'nosniff',
      'a resposta de áudio vem com no-store e nosniff');
    exige(Number(r.headers['Content-Length']) === r.audio.length, 'Content-Length bate com o número de bytes');
    exige(semVazamento(r), 'a resposta ao navegador não contém a chave nem um Bearer');
  }

  {
    const e = montarNucleo({ http: [
      { ok: false, status: 401 },
      { ok: false, status: 402 },
      { ok: false, status: 403 },
      { ok: false, status: 404 },
    ] });
    const respostas = [];
    for (let i = 0; i < 4; i++) respostas.push(await pedir(e, PEDIDO_LIMPO));
    exige(respostas.every((r) => r.status === 502), '401/402/403/404 da upstream viram 502 genérica');
    const textos = respostas.map((r) => JSON.stringify(r.corpo)).join(' ');
    exige(!/chave|key|cr[eé]dito|billing|Fish/i.test(textos),
      'nem chave, nem crédito, nem o nome do serviço vazam para quem joga');
    exige(respostas.every(semVazamento), 'nenhuma falha da upstream devolve a chave');
  }

  {
    const e = montarNucleo({ http: [{ ok: false, status: 429 }] });
    const r = await pedir(e, PEDIDO_LIMPO);
    exige(r.status === 429 && r.headers['Retry-After'] === '30', 'o 429 da upstream é repassado com Retry-After');
  }

  {
    const e = montarNucleo({ http: [{ lancar: 'rede caiu' }] });
    const r = await pedir(e, PEDIDO_LIMPO);
    exige(r.status === 502, 'falha de rede com a upstream vira 502, não uma exceção na cara do jogo');
    exige(String(r.corpo.erro).indexOf('rede caiu') < 0, 'a mensagem interna da exceção não é devolvida');
  }

  {
    const e = montarNucleo({ http: [{ bytes: Buffer.alloc(0) }] });
    const r = await pedir(e, PEDIDO_LIMPO);
    exige(r.status === 502, 'resposta 200 sem bytes nenhum é tratada como falha');
  }

  {
    const e = montarNucleo({});
    exige(Object.keys(e.servico.vozes).join(',') === 'sara,bruna,miguel,evelyn',
      'a lista fechada de vozes é exatamente a que o projeto aprovou');
    exige(e.servico.origemAceita('') === true && e.servico.origemAceita('https://qualquer.teste') === true,
      'sem CM_ORIGENS configurada a função segue a política da hospedagem (mesma origem)');
    const comLista = montarNucleo({ env: { CM_ORIGENS: 'https://jogo.exemplo,https://www.jogo.exemplo' } });
    exige(comLista.servico.origemAceita('https://jogo.exemplo') === true,
      'com CM_ORIGENS, a origem listada passa');
    exige(comLista.servico.origemAceita('https://intruso.exemplo') === false,
      'e uma origem de fora da lista é recusada');
    exige(montarNucleo({ env: { CM_ORIGENS: '*' } }).servico.origemAceita('https://qualquer.teste') === false,
      'um "*" solto em CM_ORIGENS não abre a função para o mundo');
  }

  // ═══ 1b. O CACHE DE ÁUDIO NO SUPABASE ════════════════════════════════
  // As idas ao banco passam pelo mesmo fetch falso do resto do arquivo: dá
  // para ver ordem, destino e corpo de cada uma. A chave de serviço é falsa
  // aqui como lá, e a regra é a mesma da chave da Fish — nunca aparece em
  // resposta, nunca viaja para a upstream.
  const CHAVE_SERVICO = 'servico-falso-4f2a9c17b8e34d5a9c6b0e1d2f3a4b5c';
  const URL_BANCO = 'https://candy-math-demo.supabase.co';
  const ENV_CACHE = { SUPABASE_URL: URL_BANCO, SUPABASE_SERVICE_ROLE_KEY: CHAVE_SERVICO };
  const HASH_ESPERADO = nucleo.sha256De(PEDIDO_LIMPO.texto + '|sara|' + nucleo.MODELO_PADRAO);
  const CAMINHO_ESPERADO = 'sara/' + HASH_ESPERADO + '.mp3';
  const URL_PROCURA = URL_BANCO + '/rest/v1/narracoes?select=caminho';
  const URL_OBJETO = URL_BANCO + '/storage/v1/object/narracoes/' + CAMINHO_ESPERADO;
  const URL_INSERE = URL_BANCO + '/rest/v1/narracoes?on_conflict=chave,voz,modelo';
  const URL_USO = URL_BANCO + '/rest/v1/rpc/narracao_usada';
  const URL_PODA = URL_BANCO + '/rest/v1/rpc/purgar_narracoes';
  const AO_FUNDO = () => new Promise((fim) => setImmediate(fim));
  function semChaveDeServico(serializado) {
    return String(serializado).indexOf(CHAVE_SERVICO) < 0 && !/Bearer/i.test(String(serializado));
  }

  {
    const e = montarNucleo({});
    exige(!e.servico.cacheLigado(), 'sem SUPABASE_URL e chave de serviço o cache nasce desligado');
    const r = await pedir(e, PEDIDO_LIMPO);
    exige(r.status === 200 && e.chamadas.length === 1 && e.chamadas[0].url === nucleo.ENDERECO_DA_API,
      'com o cache desligado a função faz exatamente uma ida — a síntese, como fazia antes');
  }

  {
    const e = montarNucleo({ env: ENV_CACHE, http: [
      { bytes: Buffer.from(JSON.stringify([{ caminho: CAMINHO_ESPERADO }])) },
      { bytes: Buffer.from([9, 9, 9, 9, 9]) },
    ] });
    exige(e.servico.cacheLigado(), 'com as duas variáveis o cache liga sozinho');
    const r = await pedir(e, PEDIDO_LIMPO);
    exige(r.status === 200, 'a frase do cache chega com 200');
    exige(e.chamadas[0].url.indexOf(URL_PROCURA) === 0 &&
          e.chamadas[0].url.indexOf(HASH_ESPERADO) > 0 &&
          e.chamadas[0].url.indexOf('voz=eq.sara') > 0 &&
          e.chamadas[0].url.indexOf('modelo=eq.' + nucleo.MODELO_PADRAO) > 0,
      'a procura é pela chave derivada do texto, da voz e do modelo — a mesma conta que a ' +
      'coluna generated do schema faz');
    exige(e.chamadas[1].url === URL_OBJETO, 'o objeto é buscado no bucket privado pelo caminho da tabela');
    exige(!e.chamadas.some((c) => c.url === nucleo.ENDERECO_DA_API),
      'frase achada no cache não custa nenhuma síntese na Fish Audio');
    exige(Buffer.compare(r.audio, Buffer.from([9, 9, 9, 9, 9])) === 0,
      'os bytes devolvidos são os do bucket, não um novo pedido');
    exige(r.headers['Content-Type'] === 'audio/mpeg' && r.headers['Cache-Control'] === 'no-store' &&
          Number(r.headers['Content-Length']) === r.audio.length,
      'a resposta do cache tem o mesmo contrato da resposta da síntese');
    exige(semChaveDeServico(JSON.stringify(r)) && semVazamento(r),
      'nem a chave de serviço nem um Bearer aparecem na resposta ao navegador');
    exige(!!e.chamadas[0] && !!e.chamadas[0].opcoes &&
          e.chamadas[0].opcoes.headers.apikey === CHAVE_SERVICO &&
          e.chamadas[0].opcoes.headers.Authorization === 'Bearer ' + CHAVE_SERVICO,
      'a chave de serviço sai só nas idas ao banco');
    await AO_FUNDO();
    const uso = e.chamadas.filter((c) => c.url === URL_USO);
    exige(uso.length === 1 && JSON.parse(uso[0].opcoes.body).p_chave === HASH_ESPERADO,
      'acerto registra o uso — é isso que a poda olha para decidir o que sai');
    // Conferido só quando a chamada existe: sem ela a linha de cima já reprova,
    // e aqui o que se quer é o número de falhas, não um TypeError no meio.
    exige(uso.length === 1 && !uso[0].opcoes.body.toLowerCase().includes('texto'),
      'o registro de uso não reenvia o texto da pergunta');
  }

  {
    const e = montarNucleo({ env: ENV_CACHE, http: [
      { bytes: Buffer.from('[]') },
      { bytes: Buffer.from([1, 2, 3, 4]) },
      { bytes: Buffer.from('') },
      { bytes: Buffer.from('') },
    ] });
    const r = await pedir(e, PEDIDO_LIMPO);
    exige(r.status === 200 && e.chamadas[1].url === nucleo.ENDERECO_DA_API,
      'frase nova: procura vazia, síntese, e só então grava');
    exige(e.chamadas[2].url === URL_OBJETO && e.chamadas[2].opcoes.method === 'POST' &&
          e.chamadas[2].opcoes.headers['x-upsert'] === 'true' &&
          e.chamadas[2].opcoes.headers['Content-Type'] === 'audio/mpeg',
      'o áudio sobe para o bucket pelo caminho derivado, com content-type de mp3');
    const ficha = JSON.parse(e.chamadas[3].opcoes.body)[0];
    exige(e.chamadas[3].url === URL_INSERE &&
          Object.keys(ficha).sort().join(',') === 'bytes,chave,modelo,texto,usos,voz',
      'a linha gravada tem exatamente chave, voz, modelo, texto, bytes e usos — caminho é ' +
      'coluna gerada no banco, quem escrevesse estragaria a promessa');
    exige(ficha.chave === HASH_ESPERADO && ficha.voz === 'sara' &&
          ficha.modelo === nucleo.MODELO_PADRAO && ficha.bytes === 4,
      'a ficha bate com o que foi sintetizado agora');
    exige(ficha.texto === PEDIDO_LIMPO.texto, 'guarda-se o texto limpo que a criança ouviu');
    exige(e.chamadas[3].opcoes.headers.Prefer.indexOf('merge-duplicates') > 0,
      'repetir a mesma frase não cria linha duplicada (upsert na chave única)');
    const upstream = e.chamadas[1].opcoes.headers;
    exige(!upstream.apikey && upstream.Authorization === 'Bearer ' + CHAVE_FALSA,
      'a chave do banco nunca vai junto com a chave da Fish Audio');
  }

  {
    const e = montarNucleo({ env: ENV_CACHE, http: [{ status: 500 }] });
    const r = await pedir(e, PEDIDO_LIMPO);
    exige(r.status === 200 && e.chamadas[1].url === nucleo.ENDERECO_DA_API,
      'banco com erro no meio da procura não atrasa nem derruba a frase: síntese normal');
    exige(e.chamadas.length === 4 && e.chamadas[2].url === URL_OBJETO && e.chamadas[3].url === URL_INSERE,
      'e a frase mesmo assim é gravada: o erro anterior era de leitura, não de escrita');
    const e2 = montarNucleo({ env: ENV_CACHE, http: [
      { bytes: Buffer.from(JSON.stringify([{ caminho: CAMINHO_ESPERADO }])) },
      { status: 404 },
      { bytes: Buffer.from([5, 5]) },
      { bytes: Buffer.from('') },
      { bytes: Buffer.from('') },
    ] });
    const r2 = await pedir(e2, PEDIDO_LIMPO);
    exige(r2.status === 200 && e2.chamadas[2].url === nucleo.ENDERECO_DA_API,
      'linha sem arquivo (poda no meio do caminho) volta para a síntese e reescreve');
    exige(e2.chamadas[3].url === URL_OBJETO, 'e reescreve no MESMO caminho: não sobra órfão no bucket');
  }

  {
    const e = montarNucleo({ env: ENV_CACHE, http: [
      { bytes: Buffer.from('isto não é json') },
    ] });
    const r = await pedir(e, PEDIDO_LIMPO);
    exige(r.status === 200 && e.chamadas[1].url === nucleo.ENDERECO_DA_API,
      'resposta torta do banco é tratada como ausência, não como falha de quem joga');
  }

  {
    // Queda de rede com o banco não é um status 500: a promessa rejeita. É o
    // jeito mais comum de o Supabase falhar dentro de uma função serverless
    // (dns, conexão resetada, sinal estourado), e em nenhum deles a criança
    // pode deixar de ouvir a frase — nem a síntese pode ser paga de novo à toa.
    const c = montarNucleo({ env: ENV_CACHE, http: [
      { lancar: 'banco sem dns' },
      { bytes: Buffer.from([9, 9]) },
      { bytes: Buffer.from('') },
      { bytes: Buffer.from('') },
    ] });
    const rc = await pedir(c, PEDIDO_LIMPO);
    exige(rc.status === 200 && rc.audio.length === 2 &&
          c.chamadas[1].url === nucleo.ENDERECO_DA_API,
      'queda de rede na procura sintetiza a frase como se o cache não existisse');
    exige(c.chamadas.length === 4 && c.chamadas[2].url === URL_OBJETO &&
          c.chamadas[3].url === URL_INSERE,
      'e a gravação continua tentada depois da queda: a procura é leitura, não destino');

    const d = montarNucleo({ env: ENV_CACHE, http: [
      { bytes: Buffer.from(JSON.stringify([{ caminho: CAMINHO_ESPERADO }])) },
      { lancar: 'objeto não desce' },
      { bytes: Buffer.from([8, 8, 8]) },
      { bytes: Buffer.from('') },
      { bytes: Buffer.from('') },
    ] });
    const rd = await pedir(d, PEDIDO_LIMPO);
    exige(rd.status === 200 && rd.audio.length === 3 &&
          d.chamadas[2].url === nucleo.ENDERECO_DA_API,
      'linha achada e arquivo que não desce voltam para a síntese, sem erro na tela');
    exige(d.chamadas.length === 5, 'e a frase reescrita ocupa o lugar da que faltava');

    const f = montarNucleo({ env: ENV_CACHE, http: [
      { bytes: Buffer.from('[]') },
      { bytes: Buffer.from([6, 6]) },
      { lancar: 'upload caiu' },
    ] });
    const rf = await pedir(f, PEDIDO_LIMPO);
    exige(rf.status === 200 && rf.audio.length === 2 && f.chamadas.length === 3,
      'upload que rejeita devolve o áudio mesmo assim — cache não é caminho de falha');
    exige(!f.chamadas.some((x) => x.url === URL_INSERE),
      'e a ficha não é escrita se o arquivo não subiu: linha sem áudio é promessa furada');

    const g = montarNucleo({ env: ENV_CACHE, http: [
      { bytes: Buffer.from(JSON.stringify([{ caminho: CAMINHO_ESPERADO }])) },
      { bytes: Buffer.from([1, 2, 3, 4]) },
      { lancar: 'rpc caiu' },
    ] });
    const rg = await pedir(g, PEDIDO_LIMPO);
    exige(rg.status === 200 && rg.audio.length === 4 &&
          !g.chamadas.some((x) => x.url === nucleo.ENDERECO_DA_API),
      'acerto entregue antes de qualquer conta de uso: a Fish Audio não é chamada');
    await AO_FUNDO();
    exige(g.chamadas.length === 3 && g.chamadas[2].url === URL_USO,
      'o registro de uso acontece depois da resposta e a queda dele não muda o áudio');
  }

  {
    const ruins = ['http://a.supabase.co', 'https://a.supabase.co.evil.test', 'https://evil.test',
      'https://a.supabase.co/deploy', 'https://a.supabase.co:9/caminho', ''];
    for (let i = 0; i < ruins.length; i++) {
      const e = montarNucleo({ env: { SUPABASE_URL: ruins[i],
        SUPABASE_SERVICE_ROLE_KEY: CHAVE_SERVICO } });
      exige(!nucleo.enderecoDoBancoAceitavel(ruins[i]) || ruins[i] === '',
        'endereço fora do padrão canônico do Supabase é recusado: ' + (ruins[i] || '(vazio)'));
      exige(!e.servico.cacheLigado(), 'com esse endereço o cache fica desligado');
    }
    exige(nucleo.enderecoDoBancoAceitavel('https://a.supabase.in'),
      'o outro domínio oficial do Supabase (.in) também vale, como em nuvem.js');
    const fraca = montarNucleo({ env: { SUPABASE_URL: URL_BANCO,
      SUPABASE_SERVICE_ROLE_KEY: 'curta' } });
    exige(!fraca.servico.cacheLigado(), 'chave de serviço curta ou incompleta não liga o cache');
    const desligado = montarNucleo({ env: Object.assign({ CM_CACHE: 'off' }, ENV_CACHE) });
    exige(!desligado.servico.cacheLigado(), 'CM_CACHE=off desliga o cache com as chaves no ar');
  }

  {
    // 99 frases × 4 idas (procura, síntese, objeto, ficha) = 396. A centésima
    // fechada é a nº 400, e a poda é a chamada 401 — por isso a fila é montada
    // até lá e devolve, naquele ponto, dois caminhos para apagar.
    const fila = [];
    for (let i = 0; i < 400; i++) fila.push({ bytes: Buffer.from('[]') });
    fila.push({ bytes: Buffer.from(JSON.stringify(['sara/aaaa.mp3', 'bruna/bbbb.mp3'])) });
    const e = montarNucleo({ env: Object.assign({ CM_CACHE_TETO: '10',
      FISH_AUDIO_POR_HORA: '500' }, ENV_CACHE), http: fila });
    for (let i = 0; i < 99; i++) await pedir(e, { texto: 'Frase número ' + i + ' das cem.', voz: 'sara' });
    exige(!e.chamadas.some((c) => c.url === URL_PODA),
      'com 99 frases guardadas a poda ainda não aconteceu (ela vem a cada 100 escritas)');
    await pedir(e, { texto: 'Frase número 99 das cem.', voz: 'sara' });
    await AO_FUNDO();
    const poda = e.chamadas.filter((c) => c.url === URL_PODA);
    exige(poda.length === 1, 'a centésima frase escrita dispara a poda, sem esperar por ela');
    const corpo = JSON.parse(poda[0].opcoes.body);
    exige(corpo.p_teto === 10 && corpo.p_lote === 50,
      'a poda respeita o teto configurado (CM_CACHE_TETO) e sai em lote');
    const apagados = e.chamadas.filter((c) => c.opcoes && c.opcoes.method === 'DELETE');
    exige(apagados.length === 2 &&
      apagados.every((c) => c.url.indexOf(URL_BANCO + '/storage/v1/object/narracoes/') === 0),
      'a poda apaga os arquivos que a tabela devolveu, e só dentro do bucket do cache');
  }

  // ═══ 2. A CASCA DA VERCEL ════════════════════════════════════════════
  {
    const r = await chamarAdaptador({ req: { method: 'OPTIONS' } });
    exige(r.status === 204 && r.cabecalhos.Allow === 'POST', 'OPTIONS responde 204 com Allow: POST');
    exige(r.chamadas.length === 0, 'OPTIONS não gera synthesis');
  }
  {
    const r = await chamarAdaptador({ req: { method: 'GET' } });
    exige(r.status === 405 && r.cabecalhos.Allow === 'POST', 'GET é recusado com 405 + Allow');
    exige(r.chamadas.length === 0, 'método errado não chega à upstream');
  }
  {
    const r = await chamarAdaptador({ env: { CM_ORIGENS: 'https://jogo.exemplo' }, req: { headers: { origin: 'https://intruso.exemplo' } } });
    exige(r.status === 403, 'origem fora da lista é barrada antes de qualquer custo');
    exige(r.chamadas.length === 0, 'origem barrada não gera síntese');
  }
  {
    const r = await chamarAdaptador({
      env: { CM_ORIGENS: 'https://jogo.exemplo' },
      req: { headers: { origin: 'https://jogo.exemplo' } },
    });
    exige(r.status === 200, 'origem listada passa');
    exige(r.cabecalhos['Access-Control-Allow-Origin'] === 'https://jogo.exemplo'
      && r.cabecalhos.Vary === 'Origin', 'o CORS ecoa só a origem aprovada, com Vary: Origin');
  }
  {
    const r = await chamarAdaptador({ req: { body: '{"texto":"quanto é 5 vezes 5?","voz":"bruna"}' } });
    exige(r.status === 200 && r.chamadas.length === 1, 'body vindo como string JSON é interpretado');
    exige(JSON.parse(r.chamadas[0].opcoes.body).reference_id === nucleo.VOZES.bruna.referenceId,
      'a voz escolhida vira o reference_id certo, decidido no servidor');
  }
  {
    const r = await chamarAdaptador({ req: { body: '{isso não é json' } });
    exige(r.status === 400, 'body que não é JSON vira 400 em vez de derrubar a função');
    exige(r.chamadas.length === 0, 'JSON quebrado não gera custo');
  }
  {
    const r = await chamarAdaptador({ req: { headers: { 'x-forwarded-for': '198.51.100.23, 10.0.0.1' } } });
    exige(r.status === 200, 'a função lê o primeiro IP do x-forwarded-for');
    const semIp = await chamarAdaptador({ req: { headers: {} } });
    exige(semIp.status === 200, 'sem cabeçalho de IP a função ainda atende (o contador usa "sem-ip")');
  }
  {
    const r = await chamarAdaptador({ bytes: Buffer.from([1, 2, 3, 4, 5, 6]) });
    exige(r.audio && r.audio.length === 6, 'os bytes do mp3 saem pelo res.end, não por JSON');
    exige(String(r.texto || '').indexOf(CHAVE_FALSA) < 0, 'a casca também nunca devolve a chave');
  }
  {
    const r = await chamarAdaptador({ status: 401 });
    exige(r.status === 502, 'uma 401 da upstream morre em 502 genérica na casca também');
  }

  // ═══ 3. O NAVEGADOR (narracao.js) ════════════════════════════════════
  {
    const n = montarNavegador({ preferencia: 'desligada' });
    n.narracao.iniciar();
    const falou = await n.narracao.falar('Seis vezes quatro');
    exige(falou === false, 'com a narração desligada nada é falado');
    exige(n.fetches.length === 0 && n.falas.length === 0, 'desligada = nenhuma rede e nenhuma síntese');
    exige(n.narracao.podeFalar() === false, 'o botão "Ouvir" sabe que está desligado');
  }

  {
    const n = montarNavegador({ endpoint: '' });
    n.narracao.iniciar();
    const falou = await n.narracao.falar('Dez dividido por dois');
    exige(falou === true, 'sem endpoint a fala acontece pelo aparelho, sem tocar em rede');
    exige(n.fetches.length === 0, 'endpoint vazio = nada sai deste navegador');
    exige(n.falas.length === 1 && n.falas[0].lang === 'pt-BR', 'a voz do aparelho é chamada em pt-BR');
    exige(n.falas[0].rate === 0.92, 'a fala do aparelho vem mais devagar, como convém a uma criança');
  }

  {
    const n = montarNavegador({});
    n.narracao.iniciar();
    const falou = await n.narracao.falar('Sete mais cinco são doze.');
    exige(falou === true, 'no modo IA a frase é pedida à função do projeto');
    exige(n.fetches.length === 1, 'uma frase = uma requisição');
    exige(n.fetches[0].url === '/api/voz', 'o navegador fala com a função deste projeto, no mesmo endereço');
    const corpo = JSON.parse(n.fetches[0].opcoes.body);
    exige(Object.keys(corpo).sort().join(',') === 'texto,voz',
      'sobe apenas {texto, voz} — e nada de nome, e-mail, código, estrelas ou histórico');
    const bruto = JSON.stringify(n.fetches[0].opcoes).toLowerCase();
    exige(bruto.indexOf('authorization') < 0 && bruto.indexOf(CHAVE_FALSA) < 0,
      'o navegador nunca manda uma chave junto');
    exige(!(n.fetches[0].opcoes.headers || {}).Authorization, 'sem header de autorização no pedido do jogo');
    const audios = n.audios[0];
    exige(!!audios && n.tocados.length === 1, 'o áudio que volta é tocado');
    exige(ultimo(n).falando === true, 'enquanto toca, o estado diz "falando"');
    audios.onended();
    exige(ultimo(n).falando === false, 'quando o áudio termina, o estado volta ao neutro');
  }

  {
    const n = montarNavegador({});
    n.narracao.iniciar();
    await n.narracao.falar('Três vezes três');
    await n.narracao.falar('Três vezes três');
    exige(n.fetches.length === 1, 'a mesma frase na mesma sessão não é pedida duas vezes (cache de memória)');
    exige(n.narracao.__cache().entradas === 1, 'o cache guarda uma entrada');
    exige(n.narracao.__cache().entradas <= n.narracao.__cache().teto, 'o cache respeita o próprio teto');
  }

  {
    const n = montarNavegador({});
    n.narracao.iniciar();
    for (let i = 0; i < 10; i++) await n.narracao.falar('Frase número ' + i + ' da conta de doces');
    exige(n.narracao.__cache().entradas === 8, 'o cache para em 8 entradas, mesmo depois de 10 frases');
    exige(n.revogados.length === 2, 'as duas URLs de blob expulsas são revogadas (senão a memória fica presa)');
    exige(n.fetches.length === 10, 'cada frase nova continua sendo pedida uma vez');
  }

  {
    const n = montarNavegador({});
    n.narracao.iniciar();
    await n.narracao.falar('Quanto é oito mais sete?');
    const antesDaTroca = n.fetches.length;
    n.narracao.definirVoz('miguel');
    exige(n.pausados.length === 1, 'trocar de voz no meio da fala para o áudio anterior');
    exige(n.narracao.__cache().entradas === 0, 'trocar de voz limpa o cache: o áudio em memória é da voz antiga');
    exige(n.revogados.length === 1, 'a URL descartada na troca é revogada');
    await n.narracao.falar('Quanto é oito mais sete?');
    exige(n.fetches.length === antesDaTroca + 1, 'com a voz nova a mesma frase é pedida de novo');
    exige(JSON.parse(n.fetches[1].opcoes.body).voz === 'miguel', 'e sobe com o id da voz nova');
  }

  {
    const n = montarNavegador({});
    n.narracao.iniciar();
    exige(n.narracao.definirVoz('dora') === false, 'o cliente não consegue escolher uma voz fora da lista do config');
    exige(n.narracao.definirPreferencia('satelite') === false, 'preferência inventada é recusada');
    n.narracao.definirVoz('sara');
    exige(ultimo(n).voz === 'sara', 'a voz aprovada é aceita');
  }

  {
    const n = montarNavegador({ status: 503 });
    n.narracao.iniciar();
    const falou = await n.narracao.falar('Nove menos quatro');
    exige(falou === true, 'função sem chave publicada não deixa a pergunta muda');
    exige(n.falas.length === 1, 'e o jogo cai para a voz do aparelho');
    exige(/IA n?ã?o veio|voz deste aparelho/.test(ultimo(n).nota) || ultimo(n).nota.length > 0,
      'a queda é anotada para quem abriu a tela de voz');
    exige(!/503/.test(ultimo(n).nota), 'a nota para a criança não é um código HTTP');
  }

  {
    const n = montarNavegador({ status: 429 });
    n.narracao.iniciar();
    await n.narracao.falar('Doze dividido por quatro');
    exige(n.falas.length === 1 && n.tocados.length === 0, 'um 429 da função vira voz do aparelho, sem tela quebrada');
  }

  {
    const n = montarNavegador({ recusa: 'rede' });
    n.narracao.iniciar();
    await n.narracao.falar('Cinco mais seis');
    exige(n.falas.length === 1, 'rede caída vira voz do aparelho');
    exige(/não chegou/.test(ultimo(n).erro), 'e a falha fica registrada para a tela de voz: ' + ultimo(n).erro);
  }

  {
    const n = montarNavegador({ recusa: 'abort', comAbortador: true });
    n.narracao.iniciar();
    await n.narracao.falar('Quarenta e oito sobre oito');
    exige(/demorou demais/.test(ultimo(n).erro), 'tempo esgotado é tratado como voz atrasada, não como travamento');
    exige(n.falas.length === 1, 'e a frase é dita pela voz do aparelho');
  }

  {
    const n = montarNavegador({ onLine: false });
    n.narracao.iniciar();
    await n.narracao.falar('Dois mais dois');
    exige(n.fetches.length === 0, 'sem conexão o navegador nem tenta a função');
    exige(n.falas.length === 1, 'e fala com a voz local');
    exige(/sem conex/.test(ultimo(n).nota), 'a nota diz que foi por falta de conexão');
  }

  {
    const n = montarNavegador({ bloqueioDeReproducao: true });
    n.narracao.iniciar();
    const falou = await n.narracao.falar('Sete vezes sete');
    exige(falou === true, 'áudio que o celular se recusa a tocar não quebra a jogada');
    void falou;
    await new Promise((r) => setTimeout(r, 0));
    exige(n.falas.length === 1, 'e a voz do aparelho assume a frase');
  }

  {
    const n = montarNavegador({ maximoCaracteres: 40 });
    n.narracao.iniciar();
    await n.narracao.falar('a'.repeat(400));
    exige(JSON.parse(n.fetches[0].opcoes.body).texto.length === 40,
      'o navegador corta pelo limite do config antes de mandar (' + n.narracao.limiteDeTexto() + ' caracteres configurados)');
  }

  {
    const n = montarNavegador({});
    n.narracao.iniciar();
    await n.narracao.falar('Um mais um');
    await n.narracao.falar('Dois mais dois');
    exige(n.cancelou >= 1, 'a frase nova cancela a anterior: duas vozes nunca falam juntas');
    n.narracao.parar();
    exige(ultimo(n).falando === false, 'o botão de parar desliga a fala na hora');
    exige(ultimo(n).carregando === false, 'e cancela o estado de espera');
  }

  {
    const n = montarNavegador({});
    n.narracao.iniciar();
    n.narracao.definirPreferencia('aparelho');
    exige(ultimo(n).preferencia === 'aparelho', 'a preferência escolhida é a que vale');
    const gravado = JSON.parse(n.storage.get('candymath_voz_v1'));
    exige(Object.keys(gravado).sort().join(',') === 'preferencia,voz',
      'no localStorage só vivem preferencia e voz — nenhum dado de quem joga');
    exige(n.storage.size === 1, 'a narração usa uma única chave');
  }

  {
    const n = montarNavegador({});
    n.narracao.iniciar();
    const bruto = '  Dez  mais   quinze\n\té vinte e cinco. <b>confira</b>  ';
    await n.narracao.falar(bruto);
    const texto = JSON.parse(n.fetches[0].opcoes.body).texto;
    exige(texto === 'Dez mais quinze é vinte e cinco. confira',
      'espaços, quebras e tags são limpos antes de subir: ' + JSON.stringify(texto));
  }

  {
    const n = montarNavegador({ semSinteseNativa: true, recusa: 'rede' });
    n.narracao.iniciar();
    const falou = await n.narracao.falar('Oito menos três');
    exige(falou === false, 'navegador sem Web Speech e com falha da função não finge que falou');
    exige(ultimo(n).temAparelho === false, 'e a tela de voz sabe que este aparelho não tem voz nenhuma');
    exige(ultimo(n).falando === false, 'nada fica marcado como "falando" quando nada foi dito');
  }

  {
    const n = montarNavegador({ endpoint: '' , semSinteseNativa: true });
    n.narracao.iniciar();
    exige(n.narracao.podeFalar() === false, 'sem endpoint e sem voz nativa o botão "Ouvir" se desliga');
    const comIA = montarNavegador({ endpoint: '/api/voz', semSinteseNativa: true });
    comIA.narracao.iniciar();
    exige(comIA.narracao.podeFalar() === true, 'com a função publicada dá para ouvir mesmo sem voz no aparelho');
  }

  {
    const n = montarNavegador({});
    n.narracao.iniciar();
    exige(ultimo(n).temEndpoint === true, 'a tela sabe se existe função de voz neste projeto');
    n.narracao.definirPreferencia('desligada');
    exige(ultimo(n).desligada === true, 'o estado exposto diz que está desligada');
    n.narracao.definirPreferencia('peixe');
    exige(n.narracao.__cache().entradas === 0, 'desligar limpa o cache de áudio');
  }

  {
    const n = montarNavegador({ vozes: [] });
    n.narracao.iniciar();
    exige(ultimo(n).vozes.length === 0, 'config sem lista de vozes não faz o jogo inventar uma');
    const falou = await n.narracao.falar('Um mais um');
    exige(n.fetches.length === 0,
      'sem vozes no config nenhuma frase sobe para a função: a tela não tem o que oferecer');
    exige(falou === true && n.falas.length === 1, 'e a narração passa sozinha para a voz do aparelho');
    exige(n.narracao.podeFalar() === true, 'com voz do aparelho disponível, "Ouvir" continua válido');
    const semNada = montarNavegador({ vozes: [], semSinteseNativa: true });
    semNada.narracao.iniciar();
    exige(semNada.narracao.podeFalar() === false,
      'sem vozes listadas e sem voz do aparelho o botão se desliga em vez de prometer voz');
  }

  // ═══ 4. A TELA DE VOZ MONTA NUM DOM FALHO ════════════════════════════
  // Foi aqui que a narração quebrou de verdade no navegador: montarInterface()
  // chamou uma função que só existia no objeto exportado, o ReferenceError caiu
  // no meio do DOMContentLoaded e a tela ficou muda. Os testes de estado, sozinhos,
  // não viam nada — esta seção monta a tela com o DOM falso e confere o resultado.
  {
    const n = montarNavegador({ dom: true });
    n.narracao.iniciar();
    const fichasP = n.dom.documento.querySelectorAll('#vozPreferencias .chip-voz');
    const fichasV = n.dom.documento.querySelectorAll('#vozLista .chip-voz');
    exige(fichasP.length === 3, 'a tela monta as três origens de voz (IA, aparelho, sem narração)');
    exige(fichasV.length === 2, 'uma ficha por voz do config (o navegador falso lista duas, e a tela obedece)');
    exige(fichasV.map((b) => b.textContent).join(',') === 'Sara,Miguel',
      'os rótulos vêm do config, não de texto fixo na tela: ' + fichasV.map((b) => b.textContent).join(','));
    exige(fichasP.every((b) => b.getAttribute('role') === 'radio'), 'cada ficha é um radio para o leitor de tela');
    const marcadas = fichasP.map((b) => b.getAttribute('aria-checked'));
    exige(marcadas.filter((v) => v === 'true').length === 1,
      'exatamente uma origem aparece escolhida no aria: ' + marcadas.join(', '));
    exige(fichasP[0].classList.contains('ativa'), 'a ficha escolhida também muda de cara, não só de aria');
    exige((n.textoDe('vozNotaPreferencia') || '').length > 20, 'a escolha vem explicada em linguagem de gente');
    exige(n.textoDe('vozEstadoModal') === 'Pronto.', 'a linha de estado já nasce preenchida, sem buraco');
    exige(n.dom.porId.get('vozPreferenciasPending').hidden === true,
      'o aviso "carregando as opções" sai de cena quando as opções chegaram');
    exige(n.errosDeTela.length === 0, 'nenhuma tela de voz falhou ao pintar: ' + n.errosDeTela.join(' | '));

    fichasP[2].click();
    exige(n.narracao.estado().preferencia === 'desligada', 'clicar na ficha muda a preferência de verdade');
    exige(fichasP[2].getAttribute('aria-checked') === 'true', 'e o aria acompanha o clique');
    exige(!fichasP[0].classList.contains('ativa'), 'a ficha antiga deixa de estar marcada (não ficam duas ativas)');
    exige(/comment-slash/.test(n.dom.porId.get('vozIcon').className),
      'o botão do hub avisa com ícone que a narração está desligada');
    exige(/volume-xmark/.test(n.dom.porId.get('btnFalarIcone').className),
      'o botão Ouvir do cartão mostra o alto-falante cortado');

    fichasP[1].click();
    exige(n.narracao.estado().preferencia === 'aparelho', 'o caminho do aparelho é escolhível');
    exige(/sintetizador do seu sistema/.test(n.textoDe('vozNotaVoz')),
      'no modo aparelho a nota diz que a voz é a do sistema, sem prometer IA');
    n.clique('vozTestar');
    exige(n.falas.length === 1 && n.fetches.length === 0,
      '"Ouvir uma amostra" fala na hora e sem tocar em rede');
    exige(/fa-stop/.test(n.dom.porId.get('btnFalarIcone').className), 'enquanto fala, o botão vira parada');
    exige(/falando/.test(n.textoDe('vozEstado')), 'o cartão da pergunta diz "falando…" para quem não vê o ícone');
    n.clique('vozParar');
    exige(n.narracao.estado().falando === false && n.cancelou >= 1, 'o botão de parar corta a fala na tela');
    exige(n.textoDe('vozEstado') === '', 'e a linha do cartão volta a ficar limpa');
    exige(n.textoDe('vozEstadoModal') === 'Pronto.', 'o estado do modal também volta');

    await n.narracao.falar('Nove mais quatro são treze.');
    exige(/falando/.test(n.textoDe('vozEstado')), 'a fala pelo aparelho também pinta no cartão');
    exige(n.errosDeTela.length === 0, 'nenhuma tela quebrou durante os cliques: ' + n.errosDeTela.join(' | '));
  }

  {
    const n = montarNavegador({ dom: true, domPronto: false });
    exige(n.dom.porId.size === 0, 'com o documento ainda carregando, a tela não é montada antes da hora');
    n.dispararJanela('DOMContentLoaded');
    exige(n.dom.documento.querySelectorAll('#vozLista .chip-voz').length === 2,
      'o DOMContentLoaded monta a tela de voz pelo caminho do carregamento');
    exige(n.errosDeTela.length === 0, 'nenhum erro no caminho do carregamento: ' + n.errosDeTela.join(' | '));
  }

  {
    const n = montarNavegador({ dom: true, vozes: [] });
    const aviso = n.dom.documento.querySelectorAll('#vozLista .voz-pending');
    exige(aviso.length === 1 && /Nenhuma voz listada/.test(aviso[0].textContent),
      'config sem vozes: a tela diz isso em vez de deixar o espaço em branco');
    exige(n.dom.documento.querySelectorAll('#vozPreferencias .chip-voz')[0].disabled === true,
      'sem vozes no config a ficha "Voz por IA" nasce apagada');
    exige(/nenhuma voz/i.test(n.textoDe('vozPendentes')), 'e a pendência diz exatamente o que falta fazer');
  }

  {
    const n = montarNavegador({ dom: true, endpoint: '' });
    const fichas = n.dom.documento.querySelectorAll('#vozPreferencias .chip-voz');
    exige(fichas.length === 2, 'sem função publicada a tela não oferece a voz por IA');
    exige(fichas.every((b) => b.dataset.valor !== 'peixe'), 'e a ficha de IA nem aparece: nada de botão que só falha');
  }

  // ═══ 5. AS DUAS LISTAS TÊM DE BATER ══════════════════════════════════
  {
    const config = vm.runInNewContext(fs.readFileSync(emRaiz('config.js'), 'utf8') + '\nCM_CONFIG;', {});
    const ids = (config.narracao.vozes || []).map((v) => v.id);
    const servidor = Object.keys(nucleo.VOZES);
    exige(ids.length > 0, 'config.js lista as vozes oferecidas na tela');
    exige(ids.every((id) => servidor.indexOf(id) >= 0),
      'todo id do config existe na lista fechada da função: ' + ids.join(', '));
    exige(servidor.every((id) => ids.indexOf(id) >= 0),
      'e todo id da função é oferecido na tela (sem voz escondida que ninguém escolhe)');
    (config.narracao.vozes || []).forEach((v) => {
      exige(!!nucleo.VOZES[v.id] && nucleo.VOZES[v.id].rotulo === v.rotulo,
        'o rótulo "' + v.rotulo + '" do config é o mesmo da função');
    });
    const textoConfig = fs.readFileSync(emRaiz('config.js'), 'utf8');
    exige(!/\b[0-9a-f]{32}\b/.test(textoConfig),
      'nenhum reference_id de 32 hexes mora no config do navegador: o catálogo é decisão do servidor');
    exige(!/model[ou]?o\s*:/.test(textoConfig),
      'o modelo não é escolhido pelo navegador (nenhum campo de modelo no config)');
    exige(/^\/api\/voz$/.test(String(config.narracao.endpoint)),
      'o endpoint do config é um caminho do próprio projeto (' + config.narracao.endpoint + ')');
    exige(!/^https?:/i.test(String(config.narracao.endpoint)),
      'o endpoint não é um endereço externo absoluto: CSP connect-src \'self\' continua valendo');
    exige(typeof config.narracao.maximoCaracteres === 'number'
      && config.narracao.maximoCaracteres <= 320,
      'o teto do navegador não é maior que o do servidor');
    exige(config.dueloRedeHabilitado === false,
      'e, ao rodar esta suíte, o duelo em rede continua desligado por padrão');
  }

  {
    const fonte = fs.readFileSync(emRaiz('narracao.js'), 'utf8');
    exige(!/Authorization|Bearer/.test(fonte), 'narracao.js não menciona cabeçalho de autorização');
    // O NOME da variável não é segredo (e dizer qual falta é o que resolve a
    // pendência de quem publica o jogo); o que não pode aparecer é um valor.
    exige(!/FISH_AUDIO_API_KEY\s*[:=]/.test(fonte),
      'narracao.js nomeia a variável que falta, mas nunca atribui valor a ela');
    exige(!/\b[0-9a-f]{32}\b/.test(fonte), 'narracao.js não traz nenhum id de voz do catálogo');
    exige(fonte.indexOf(CHAVE_FALSA) < 0, 'nenhum segredo aparece no código do navegador');
    exige(!/api\.fish\.audio/.test(fonte), 'narracao.js não conhece o endereço do serviço de voz');
    exige(/revokeObjectURL/.test(fonte), 'narracao.js revoga as URLs de blob que descarta');
  }

  {
    const pagina = fs.readFileSync(emRaiz('index.html'), 'utf8');
    ['modalNarracao', 'vozPreferencias', 'vozLista', 'vozNotaPreferencia', 'vozNotaVoz',
      'vozEstadoModal', 'vozPendentes', 'vozPreferenciasPending', 'vozTestar', 'vozParar',
      'vozEstado', 'vozIcon', 'btnFalarIcone'].forEach((id) => {
      exige(new RegExp('id="' + id + '"').test(pagina), 'a tela de voz encontra o elemento #' + id);
    });
    exige(new RegExp('id="rotuloPreferenciaVoz"').test(pagina)
      || /aria-label="De onde vem a voz"/.test(pagina)
      || /<legend[^>]*>De onde vem a voz/.test(pagina),
      'o grupo de preferências tem rótulo acessível');
    exige(/<script src="narracao\.js"><\/script>/.test(pagina), 'narracao.js é carregado pelo index.html');
    const css = fs.readFileSync(emRaiz('style.css'), 'utf8');
    ['.narracao-box', '.chip-voz', '.voz-acoes', '.btn-voz-parar', '.voz-privacidade', '.voz-pendentes']
      .forEach((classe) => {
        exige(css.indexOf(classe + ' ') >= 0 || css.indexOf(classe + ' {') >= 0
          || css.indexOf(classe + ',') >= 0 || css.indexOf(classe + '.') >= 0,
          'style.css veste ' + classe);
      });
  }

  {
    const casca = fs.readFileSync(emRaiz('api', 'voz.js'), 'utf8');
    const miolo = fs.readFileSync(emRaiz('api', '_voz-nucleo.js'), 'utf8');
    exige(!/console\.(log|info|warn|error|debug)/.test(casca + miolo),
      'a ponte de voz não escreve nada em log: nem texto, nem IP, nem chave');
    exige(/no-store/.test(miolo), 'toda resposta da função diz "no-store"');
  }

  // ── relatório ─────────────────────────────────────────────────────────
  console.log('\n★ TESTE SIMULADO: ambiente, rede e navegador são falsos. '
    + 'Nada aqui prova a síntese real da Fish Audio.\n');
  ok.forEach((linha) => console.log(linha));
  if (falhas.length) {
    falhas.forEach((linha) => console.log(linha));
    console.log('\n' + falhas.length + ' falha(s) em ' + (ok.length + falhas.length) + ' verificações.');
    console.log('O que FICA POR PROVAR: a fala real depende de FISH_AUDIO_API_KEY publicada e de '
      + 'uma chamada autorizada — ouça uma frase no navegador antes de dizer que a narração funciona.');
    process.exit(1);
  }
  console.log('\n' + ok.length + ' verificações sobre a ponte de voz, todas verdes.');
  console.log('Não executado aqui: a chamada real à API de síntese (pede a chave do dono do projeto).');
}

principal().catch((e) => {
  console.error('o teste quebrou: ' + (e && e.stack || e));
  process.exit(1);
});
