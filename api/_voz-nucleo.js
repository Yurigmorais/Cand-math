/* ===================================================
   CANDY MATH — api/_voz-nucleo.js
   O miolo da ponte com o Fish Audio, separado da Vercel de propósito:
   assim o mesmo código que atende em produção é o que os testes exercitam,
   com ambiente e rede fornecidos por eles (fetch falso, relógio falso).

   Nada aqui conhece req/res. A porta de entrada do Vercel é api/voz.js.
   Regras de segurança deste arquivo (as mesmas em qualquer chamada):
     · a chave só sai em Authorization, nunca em resposta ou log;
     · texto e voz são conferidos antes de qualquer requisição;
     · a URL de destino é constante — o cliente não escolhe para onde ir;
     · o que sobe para a API é o texto da fala e nada mais.

   Sobre o cache de áudio (narracoes, no Supabase): a frase já sintetizada fica
   guardada para a mesma pergunta não custar duas sínteses. O navegador não vê
   isso acontecer — ele continua recebendo os bytes pelo POST /api/voz. A chave
   de serviço do banco é secreta, como a da Fish, e mora na Vercel; os endereços
   de ida são montados aqui a partir de uma única URL conferida contra o padrão
   canônico do Supabase, e nenhum deles vem de quem chama.
   =================================================== */
'use strict';

const { createHash } = require('crypto');

// Lista fechada de vozes. O rótulo é o que a criança vê; o id é o
// reference_id da Fish Audio, conferido contra o catálogo público em
// 30/10/2026 (as vozes em português com mais usos para cada nome). Voz de
// comunidade muda de nome e pode sair do ar — por isso ela é pinada por id
// aqui, e não por texto livre vindo do navegador.
const VOZES = {
  sara: { rotulo: 'Sara', referenceId: 'a3267483966a42419bce7bae6d52a010' },
  bruna: { rotulo: 'Bruna', referenceId: '33a512796260458abe82de6293f9fbec' },
  miguel: { rotulo: 'Miguel', referenceId: 'b69b3cb9884848cfbedd0c295ac8d90b' },
  evelyn: { rotulo: 'Evelyn', referenceId: '8b8bd346d3484f7ca0485667b2e5b410' },
};

const MODELO_PADRAO = 's2.1-pro-free';
const MAX_TEXTO_PADRAO = 320;
const POR_HORA_PADRAO = 240;
const FIM_DA_JOGADA = 15000;
const ENDERECO_DA_API = 'https://api.fish.audio/v1/tts';
const HORA = 3600000;

// O cache de áudio mora no Supabase (tabela narracoes + bucket privado). Estes
// números são o preço que ele pode cobrar: o cache nunca segura a frase.
const FIM_DO_CACHE = 2500;          // ms por ida ao banco, em cada ponta
const TETO_DO_CACHE_PADRAO = 6000;  // frases guardadas antes de começar a poda
const LOTE_DA_PODA = 50;            // quantas saem de cada vez
const PODA_A_CADA = 100;            // escritas entre uma poda e outra
const BUCKET_DO_CACHE = 'narracoes';
// A url do projeto entra em chamadas de rede feitas por este código: só o
// endereço canônico do Supabase vale. Um valor qualquer transformaria a
// função em um encaminhador para o servidor que o dono da variável escolher.
const ENDERECO_DO_BANCO = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i;

function numero(value, padrao, minimo, maximo) {
  const n = Number(value);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(maximo, Math.max(minimo, Math.floor(n)));
}

// Só o que uma frase de jogo precisa ser: texto legível, sem controle, sem
// marcação. Nada de HTML, nada de caractere de escape.
function limparTexto(bruto, maximo) {
  if (typeof bruto !== 'string') return null;
  const semControle = bruto
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    // A tag sai inteira: apagar só os "<" e ">" deixaria "b Sete /b" na frase,
    // e a criança ouvira "barra b" no meio da conta.
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!semControle.length) return null;
  return semControle.slice(0, maximo);
}

function chaveDeVoz(nome) {
  const k = String(nome || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(VOZES, k) ? k : null;
}

// A chave do cache. Resumo, não texto: é o que vai no nome do arquivo e no
// índice da tabela, e assim uma frase nunca vira endereço legível para a
// resposta dela.
function sha256De(texto) {
  return createHash('sha256').update(String(texto), 'utf8').digest('hex');
}

// Mesmo caminho, sempre: derivar de voz + chave é o que permite reescrever por
// cima de um arquivo que a poda já tinha levado.
function caminhoDoObjeto(voz, chave) {
  return String(voz) + '/' + String(chave) + '.mp3';
}

/* Contador em memória. Cada instância da função conta as próprias visitas:
   isto segura varredura acidental e um celular travado no botão, mas não é
   muralha contra alguém disposto a distribuir o tráfego entre instâncias. A
   proteção de verdade é a rota de custo zero e o teto de caracteres.
   Registrado em SEGURANCA.md como proteção parcial, de propósito. */
function criarContador() {
  const visitas = new Map();
  return {
    visitas: visitas,
    permitido(ip, porHora, relogio) {
      const agoraMs = relogio();
      const vivos = (visitas.get(ip) || []).filter((t) => agoraMs - t < HORA);
      if (vivos.length >= porHora) { visitas.set(ip, vivos); return false; }
      vivos.push(agoraMs);
      visitas.set(ip, vivos);
      if (visitas.size > 5000) {
        const velhos = [];
        visitas.forEach((lista, chave) => { if (agoraMs - lista[lista.length - 1] >= HORA) velhos.push(chave); });
        velhos.forEach((chave) => visitas.delete(chave));
      }
      return true;
    },
  };
}

function cabecalhosBase() {
  return {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
}

function erro(status, mensagem, extras) {
  return Object.assign({ status: status, headers: Object.assign({}, cabecalhosBase(),
    { 'Content-Type': 'application/json; charset=utf-8' }), corpo: { erro: mensagem } },
  extras || {});
}

/* ── CACHE DE ÁUDIO NO SUPABASE ──────────────────────────────────────────
   A segunda memória da narração. A primeira é a da aba (narracao.js, oito
   frases); esta é do projeto, e serve a todos: a frase que uma criança ouviu
   hoje não volta à Fish Audio amanhã, para nenhuma outra criança, em nenhum
   outro aparelho.

   Como o resto do arquivo, não conhece a Vercel: fala com o banco pelo mesmo
   `buscar` que recebe, com a chave de serviço no cabeçalho. Daí vêm três
   consequências que importam:

     · o navegador não participa. Ele continua mandando POST /api/voz e
       recebendo bytes. Nenhuma URL de bucket, nenhuma chave nova, nenhum
       dado a mais na tela — e o CSP do jogo fica como está;
     · o bucket é privado justamente por isso. Um bucket público permitiria
       ouvir qualquer pergunta pelo endereço, e o endereço é um resumo do
       texto: quem adivinha a pergunta adivinha a resposta;
     · o cache é uma conveniência, nunca uma dependência. Toda ida tem
       timeout próprio e todo erro devolve null: banco fora do ar, resposta
       torta, objeto apagado entre a listagem e a descida — em qualquer um
       desses casos a frase sai da Fish Audio como saía antes.

   Sem SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY válidas este objeto nem nasce,
   e a função tem exatamente o comportamento de sempre.
   --------------------------------------------------------------- */
function enderecoDoBancoAceitavel(url) {
  return ENDERECO_DO_BANCO.test(String(url || '').trim().replace(/\/+$/, ''));
}

function criarCacheSupabase(o) {
  const base = String(o.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const chaveServico = String(o.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!enderecoDoBancoAceitavel(base) || chaveServico.length < 20) return null;

  const teto = numero(o.env.CM_CACHE_TETO, TETO_DO_CACHE_PADRAO, 1, 500000);
  const autorizacao = { 'Authorization': 'Bearer ' + chaveServico, 'apikey': chaveServico };

  function pedido(parcial) {
    const p = Object.assign({}, parcial);
    p.headers = Object.assign({}, autorizacao, parcial && parcial.headers);
    const s = o.sinal ? o.sinal(FIM_DO_CACHE) : undefined;
    if (s) p.signal = s;
    return p;
  }

  function rotaDoObjeto(caminho) {
    return base + '/storage/v1/object/' + BUCKET_DO_CACHE + '/' +
      String(caminho).split('/').map(encodeURIComponent).join('/');
  }

  async function buscarJson(url, parcial) {
    const r = await o.buscar(url, pedido(parcial));
    if (!r || !r.ok) return null;
    const texto = Buffer.from(await r.arrayBuffer()).toString('utf8');
    if (!texto) return null;
    try { return JSON.parse(texto); } catch (e) { return null; }
  }

  async function onlyOk(url, parcial) {
    const r = await o.buscar(url, pedido(parcial));
    return !!(r && r.ok);
  }

  return {
    base: base,
    teto: teto,

    // A frase já foi dita? Devolve o caminho do objeto, ou null.
    async procurar(chave, voz, modelo) {
      const url = base + '/rest/v1/narracoes?select=caminho' +
        '&chave=eq.' + encodeURIComponent(chave) +
        '&voz=eq.' + encodeURIComponent(voz) +
        '&modelo=eq.' + encodeURIComponent(modelo) +
        '&limit=1';
      const linhas = await buscarJson(url, { method: 'GET', headers: { Accept: 'application/json' } });
      if (!Array.isArray(linhas) || !linhas.length) return null;
      const caminho = String(linhas[0].caminho || '');
      return caminho && caminho.indexOf('\n') < 0 ? caminho : null;
    },

    async baixar(caminho) {
      const r = await o.buscar(rotaDoObjeto(caminho), pedido({ method: 'GET' }));
      if (!r || !r.ok) return null;
      const bytes = Buffer.from(await r.arrayBuffer());
      return bytes.length ? bytes : null;
    },

    // Guarda o áudio e a ficha dele. As duas pontas têm de sair: objeto sem
    // linha nunca é encontrado, linha sem objeto é uma promessa furada — e
    // nesse caso a descida falha, a função chama a Fish de novo e reescreve
    // no mesmo caminho. Nada emperra por causa disso.
    async gravar(caminho, audio, ficha) {
      const subiu = await onlyOk(rotaDoObjeto(caminho), {
        method: 'POST',
        headers: { 'Content-Type': 'audio/mpeg', 'x-upsert': 'true' },
        body: audio,
      });
      if (!subiu) return false;
      return onlyOk(base + '/rest/v1/narracoes?on_conflict=chave,voz,modelo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
          'Prefer': 'return=minimal, resolution=merge-duplicates' },
        body: JSON.stringify([{
          chave: ficha.chave, voz: ficha.voz, modelo: ficha.modelo,
          texto: ficha.texto, bytes: audio.length, usos: 1,
        }]),
      });
    },

    // "Esta frase foi ouvida outra vez" — alimenta a poda. Melhor sorte que
    // esforço: se não passar, o cache continua correto, só um pouco mais
    // velho do que o ideal.
    async usada(chave, voz, modelo) {
      return onlyOk(base + '/rest/v1/rpc/narracao_usada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_chave: chave, p_voz: voz, p_modelo: modelo }),
      });
    },

    // Devolve os caminhos podados para que o arquivo siga a linha. O nome é
    // derivado da chave, então uma frase que volta reescreve no mesmo lugar:
    // não sobra objeto órfão no bucket.
    async podar() {
      const caminhos = await buscarJson(base + '/rest/v1/rpc/purgar_narracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_teto: teto, p_lote: LOTE_DA_PODA }),
      });
      if (!Array.isArray(caminhos) || !caminhos.length) return 0;
      let removidos = 0;
      for (let i = 0; i < caminhos.length; i++) {
        const caminho = String(caminhos[i] || '');
        if (!caminho || caminho.indexOf('\n') >= 0) continue;
        if (await onlyOk(rotaDoObjeto(caminho), { method: 'DELETE' })) removidos++;
      }
      return removidos;
    },
  };
}

function respostaAudio(bytes) {
  return {
    status: 200,
    headers: Object.assign({}, cabecalhosBase(),
      { 'Content-Type': 'audio/mpeg', 'Content-Length': String(bytes.length) }),
    audio: bytes,
  };
}

function criarServico(opcoes) {
  const o = opcoes || {};
  const env = o.env || process.env || {};
  const buscar = o.fetch || (typeof fetch === 'function' ? fetch : null);
  const relogio = o.agora || (typeof Date.now === 'function' ? () => Date.now() : null);
  const contador = o.contador || criarContador();
  const sinal = o.sinal || ((ms) => (AbortSignal && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined));

  const porHora = numero(env.FISH_AUDIO_POR_HORA, POR_HORA_PADRAO, 1, 100000);
  const maxTexto = numero(env.FISH_AUDIO_MAX, MAX_TEXTO_PADRAO, 8, 2000);
  const modeloUsado = String(env.FISH_AUDIO_MODELO || '').trim() || MODELO_PADRAO;
  const permitidas = String(env.CM_ORIGENS || '').split(',').map((s) => s.trim()).filter(Boolean);

  // CM_CACHE=off desliga o cache mesmo com as duas variáveis no ar — é o
  // interruptor de quem quer medir a diferença ou conter um problema no banco
  // sem tocar na chave de síntese.
  let cache = null;
  if (String(env.CM_CACHE || '').trim().toLowerCase() !== 'off') {
    try {
      cache = criarCacheSupabase({ env: env, buscar: buscar, sinal: sinal });
    } catch (e) {
      cache = null;
    }
  }
  let escritas = 0;

  return {
    vozes: VOZES,
    limites: { porHora: porHora, maxTexto: maxTexto, modelo: modeloUsado },
    // O que a tela de diagnóstico e os testes conferem: o cache está de pé
    // ou não. Nunca expõe a chave, o endereço do banco nem o teto em texto.
    cacheLigado: function () { return !!cache; },

    // Origem: sem `CM_ORIGENS` definida a função não bloqueia origem no POST — a
    // resposta cross-origin continua protegida pelo CORS (o cabeçalho de acesso só
    // sai para as origens listadas), mas a chamada chega até aqui e gasta cota.
    // Com lista, só ela — e nunca um "*" solto. Na produção, liste a sua origem.
    origemAceita(origem) {
      const cab = String(origem || '').trim();
      if (!cab) return true;
      if (!permitidas.length) return true;
      return permitidas.indexOf(cab) >= 0;
    },

    async processar(pedido) {
      const p = pedido || {};

      const chave = String(env.FISH_AUDIO_API_KEY || '').trim();
      if (!chave) {
        // Sem chave, o jogo cai para a voz do aparelho sozinho. Este erro é o
        // aviso de que falta configuração, não uma falha de quem joga.
        return erro(503, 'narração por IA não configurada neste projeto');
      }
      if (!buscar) return erro(500, 'sem meio de falar com a API de voz');

      if (!p.corpo || typeof p.corpo !== 'object' || Array.isArray(p.corpo)) {
        return erro(400, 'requisição em JSON');
      }

      const voz = chaveDeVoz(p.corpo.voz);
      if (!voz) return erro(400, 'voz não faz parte da lista deste jogo');

      const texto = limparTexto(p.corpo.texto, maxTexto);
      if (!texto) return erro(400, 'diga alguma coisa para eu ler');

      if (!contador.permitido(String(p.ip || 'sem-ip'), porHora, relogio)) {
        return erro(429, 'muitas frases seguidas. Espere um pouco.',
          { headers: Object.assign({}, cabecalhosBase(),
            { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': '60' }) });
      }

      // A chave é o texto exatamente como vai subir para a síntese: o que foi
      // gerado é o que fica guardado, sem normalização criativa no meio do
      // caminho. Voz e modelo entram na conta porque o mesmo problema de
      // Matemática soa diferente em cada um deles.
      const hash = cache ? sha256De(texto + '|' + voz + '|' + modeloUsado) : '';

      if (cache) {
        let achado = null;
        let audio = null;
        try {
          achado = await cache.procurar(hash, voz, modeloUsado);
          if (achado) audio = await cache.baixar(achado);
        } catch (e) {
          achado = null;
          audio = null;
        }
        if (audio) {
          // O acerto é a resposta inteira: nenhuma chamada à API de síntese.
          // O contador de uso é o único trabalho depois disso, e ele não atrasa
          // quem ouve — nem segura a resposta se o banco demorar.
          Promise.resolve()
            .then(() => cache.usada(hash, voz, modeloUsado))
            .catch(() => {});
          return respostaAudio(audio);
        }
      }

      // A URL é constante deste arquivo. O cliente não escolhe destino: com
      // essa liberdade, a função viraria um encaminhador para qualquer
      // servidor da internet.
      const corpoUpstream = {
        text: texto,
        reference_id: VOZES[voz].referenceId,
        format: 'mp3',
        latency: 'normal',
        prosody: { speed: 1, volume: 0, normalize_loudness: true },
        language: 'pt',
        chunk_length: 200,
        normalize: true,
      };

      let resposta;
      try {
        resposta = await buscar(ENDERECO_DA_API, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + chave,
            'Content-Type': 'application/json',
            // Na Fish Audio o modelo vai no cabeçalho, não no corpo.
            'model': modeloUsado,
          },
          body: JSON.stringify(corpoUpstream),
          signal: sinal(FIM_DA_JOGADA),
        });
      } catch (e) {
        // Timeout e queda de rede têm a mesma cara para quem joga: voz do
        // aparelho, sem drama, sem detalhe interno na resposta.
        return erro(502, 'a voz não respondeu a tempo');
      }

      if (!resposta || !resposta.ok) {
        const codigo = resposta && resposta.status === 429 ? 429 : 502;
        const extras = codigo === 429
          ? { headers: Object.assign({}, cabecalhosBase(),
              { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': '30' }) }
          : null;
        // 401/402/403/404 da upstream são problema deste projeto (chave,
        // crédito, voz fora do ar). Quem joga não precisa saber disso, e um
        // navegador não deve receber informação sobre a conta.
        return erro(codigo, 'não deu para gerar a voz agora', extras);
      }

      const bytes = Buffer.from(await resposta.arrayBuffer());
      if (!bytes.length) return erro(502, 'a voz voltou vazia');

      if (cache) {
        // Guardar é a única coisa feita depois da síntese que o navegador
        // espera: uma ida e volta a mais, de ordem de grandeza menor que a
        // própria síntese, e com a garantia de que a frase entrou antes de
        // alguém receber o áudio. Falhou? A frase vai ser dita de novo na
        // próxima vez, e só.
        try {
          await cache.gravar(caminhoDoObjeto(voz, hash), bytes,
            { chave: hash, voz: voz, modelo: modeloUsado, texto: texto });
        } catch (e) {
          /* cache não é caminho de falha do jogo */
        }
        escritas++;
        if (escritas >= PODA_A_CADA) {
          escritas = 0;
          // A poda não segura resposta nenhuma: é varredura de quintal, e se a
          // instância dormir antes de terminar, a próxima escrita retoma de
          // onde parou. Caminho derivado da chave = nada fica órfão para sempre.
          Promise.resolve()
            .then(() => cache.podar())
            .catch(() => {});
        }
      }

      return respostaAudio(bytes);
    },
  };
}

module.exports = {
  criarServico: criarServico,
  criarContador: criarContador,
  limparTexto: limparTexto,
  chaveDeVoz: chaveDeVoz,
  numero: numero,
  sha256De: sha256De,
  caminhoDoObjeto: caminhoDoObjeto,
  enderecoDoBancoAceitavel: enderecoDoBancoAceitavel,
  VOZES: VOZES,
  MODELO_PADRAO: MODELO_PADRAO,
  ENDERECO_DA_API: ENDERECO_DA_API,
  BUCKET_DO_CACHE: BUCKET_DO_CACHE,
  TETO_DO_CACHE_PADRAO: TETO_DO_CACHE_PADRAO,
};
