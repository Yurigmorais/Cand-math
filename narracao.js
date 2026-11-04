/* ===================================================
   CANDY MATH — narracao.js
   A voz do Juba Candy. Dois caminhos, um único botão de parada:

     · 'peixe'    → pede o áudio à função api/voz.js e, se ela não vier
                    (sem chave, sem rede, sem hospedagem), cai para a voz do
                    aparelho no mesmo instante;
     · 'aparelho' → nunca sai deste navegador (Web Speech API);
     · 'desligada'→ silêncio. Tem criança que não quer ouvir nada, e isso é
                    escolha dela.

   O que NÃO acontece aqui:
     · o texto enviado para /api/voz é só a frase a ser lida. Nem nome, nem
       e-mail, nem código de vínculo, nem estrelas, nem histórico;
     · nada é gravado em disco: o único cache é o de memória desta aba, com
       teto de entradas e sem dado pessoal na chave;
     · duas vozes nunca falam juntas: a frase nova cancela a anterior antes;
     · falha não trava o jogo: quem clica em "Ouvir" e a API não responde ouve
       a voz do aparelho e uma nota discreta, nunca uma tela quebrada.
   =================================================== */
(function (root) {
  'use strict';

  const CHAVE_LOCAL = 'candymath_voz_v1';
  const TETO_DO_CACHE = 8;          // frases repetidas na mesma sessão
  const FIM_DA_JOGADA = 12000;      // ms esperando a função de voz
  const PREFERENCIAS = ['peixe', 'aparelho', 'desligada'];

  let preferencia = 'peixe';
  let voz = 'sara';
  let carregando = false;
  let nota = '';
  let ultimoErro = '';
  const ouvintes = [];
  const cache = new Map();          // 'voz|texto' → { url, bytes }
  let atual = null;                 // { audio?, fala? } em reprodução

  function config() {
    const c = (root.CM_CONFIG && root.CM_CONFIG.narracao) || {};
    return {
      endpoint: typeof c.endpoint === 'string' ? c.endpoint.trim() : '',
      preferencia: PREFERENCIAS.indexOf(c.preferencia) >= 0 ? c.preferencia : 'peixe',
      vozes: Array.isArray(c.vozes) && c.vozes.length ? c.vozes : [],
      maximo: typeof c.maximoCaracteres === 'number' ? c.maximoCaracteres : 320,
    };
  }

  function vozValida(id) {
    const lista = config().vozes;
    if (!lista.length) return id === 'sara' ? 'sara' : null;
    const achada = lista.filter((v) => v && v.id).find((v) => v.id === id);
    return achada ? achada.id : (lista[0].id || null);
  }

  // A voz que está em uso hoje é, de fato, uma das vozes que este config lista.
  // Sem isso, um config sem vozes continuaria pedindo "sara" à função por inércia.
  function temVozListada() {
    return config().vozes.some((v) => v && v.id === voz);
  }

  /* A Web Speech API existe em todo navegador moderno de celular e desktop,
     mas não em todo WebView. Sem ela, o modo aparelho vira "não há voz" e a
     interface diz isso em vez de fingir. */
  function temVozDoAparelho() {
    return typeof root.speechSynthesis !== 'undefined' &&
      typeof root.SpeechSynthesisUtterance !== 'undefined';
  }

  function textoSeguro(bruto) {
    if (typeof bruto !== 'string') return '';
    return bruto
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
      // A tag vai inteira embora: sobrar "b" e "/b" soltos na frase é ouvir
      // a voz lendo lixo no meio da conta.
      .replace(/<[^>]*>/g, ' ')
      .replace(/[<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, config().maximo);
  }

  function avisar() {
    ouvintes.forEach((f) => {
      try {
        f(resumo());
      } catch (e) {
        // A tela não pode derrubar a voz — mas engolir a exceção em silêncio
        // apagaria junto o sintoma que levou até ela.
        avisarErro(e);
      }
    });
  }

  function avisarErro(e) {
    if (root.console && root.console.warn) root.console.warn('CM_NARRACAO: a tela de voz falhou ao pintar', e);
  }

  function aoMudar(f) {
    if (typeof f !== 'function') return;
    ouvintes.push(f);
    try {
      f(resumo());
    } catch (e) {
      avisarErro(e);
    }
  }

  function resumo() {
    const c = config();
    const id = c.vozes.find((v) => v.id === voz);
    return {
      preferencia: preferencia,
      voz: voz,
      rotulo: id ? id.rotulo : voz,
      vozes: c.vozes,
      carregando: carregando,
      falando: !!atual,
      nota: nota,
      erro: ultimoErro,
      temAparelho: temVozDoAparelho(),
      temEndpoint: !!c.endpoint,
      desligada: preferencia === 'desligada',
    };
  }

  function salvar() {
    try {
      root.localStorage.setItem(CHAVE_LOCAL, JSON.stringify({ preferencia: preferencia, voz: voz }));
    } catch (e) {
      // Modo privado com cota cheia: a escolha só não pega na próxima vez.
    }
  }

  function carregar() {
    let lido = null;
    try { lido = JSON.parse(root.localStorage.getItem(CHAVE_LOCAL) || 'null'); } catch (e) { lido = null; }
    const c = config();
    preferencia = (lido && PREFERENCIAS.indexOf(lido.preferencia) >= 0)
      ? lido.preferencia : c.preferencia;
    voz = (lido && vozValida(lido.voz)) || vozValida('sara') || (c.vozes[0] && c.vozes[0].id) || 'sara';
  }

  // ── reprodução ───────────────────────────────────────────
  function calar() {
    if (atual) {
      if (atual.audio) { try { atual.audio.pause(); } catch (e) { /* já era */ } }
      atual = null;
    }
    if (temVozDoAparelho()) { try { root.speechSynthesis.cancel(); } catch (e) { /* sem voz nativa */ } }
    carregando = false;
    nota = '';
  }

  function peloAparelho(texto) {
    if (!temVozDoAparelho()) {
      ultimoErro = 'este navegador não traz voz nenhuma';
      avisar();
      return false;
    }
    const fala = new root.SpeechSynthesisUtterance(texto);
    fala.lang = 'pt-BR';
    fala.rate = 0.92;
    const id = config().vozes.find((v) => v.id === voz);
    fala.pitch = /miguel/i.test((id && id.rotulo) || '') ? 0.85 : 1.1;
    fala.onend = function () { if (atual && atual.fala === fala) { atual = null; avisar(); } };
    fala.onerror = function () { if (atual && atual.fala === fala) { atual = null; avisar(); } };
    atual = { fala: fala };
    try { root.speechSynthesis.speak(fala); } catch (e) { atual = null; return false; }
    avisar();
    return true;
  }

  function guardarNoCache(chave, url, bytes) {
    cache.set(chave, { url: url, bytes: bytes });
    while (cache.size > TETO_DO_CACHE) {
      const maisVelha = cache.keys().next().value;
      const sobra = cache.get(maisVelha);
      cache.delete(maisVelha);
      // A URL de blob aponta para memória desta aba: sem revogar, fica presa
      // até o navegador fechar.
      if (sobra && sobra.url) { try { root.URL.revokeObjectURL(sobra.url); } catch (e) { /* nada a fazer */ } }
    }
  }

  function tocarUrl(chave, url) {
    const audio = new root.Audio(url);
    audio.onended = function () { if (atual && atual.audio === audio) { atual = null; avisar(); } };
    audio.onerror = function () {
      if (atual && atual.audio === audio) atual = null;
      cache.delete(chave);
      ultimoErro = 'o áudio chegou mas este aparelho não soube tocar';
      peloAparelho(textoDaChave(chave));
    };
    atual = { audio: audio };
    avisar();
    audio.play().catch(function () {
      // Celular que exige gesto do usuário: o clique já é o gesto, mas se
      // mesmo assim bloquear, a voz do aparelho costuma passar.
      if (atual && atual.audio === audio) atual = null;
      peloAparelho(textoDaChave(chave));
    });
  }

  function textoDaChave(chave) { return String(chave).split('|').slice(1).join('|'); }

  function apagarCache() {
    cache.forEach((item) => {
      if (item && item.url) { try { root.URL.revokeObjectURL(item.url); } catch (e) { /* nada */ } }
    });
    cache.clear();
  }

  async function falar(bruto) {
    const texto = textoSeguro(bruto);
    if (!texto) return false;
    if (preferencia === 'desligada') return false;
    const c = config();

    calar();                       // nunca duas vozes ao mesmo tempo

    if (preferencia === 'aparelho' || !c.endpoint || !temVozListada()) return peloAparelho(texto);
    if (root.navigator && root.navigator.onLine === false) {
      nota = 'sem conexão agora: usei a voz deste aparelho';
      return peloAparelho(texto);
    }

    const chave = voz + '|' + texto;
    const guardado = cache.get(chave);
    if (guardado && guardado.url) { tocarUrl(chave, guardado.url); return true; }

    carregando = true;
    nota = '';
    avisar();

    const ctrl = root.AbortController ? new root.AbortController() : null;
    const relogio = ctrl
      ? root.setTimeout(function () { try { ctrl.abort(); } catch (e) { /* acabou */ } }, FIM_DA_JOGADA)
      : 0;
    let bytes = null;
    try {
      const resposta = await fetch(c.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Só duas coisas sobem: o que dizer e qual voz da lista usar.
        body: JSON.stringify({ texto: texto, voz: voz }),
        signal: ctrl ? ctrl.signal : undefined,
      });
      if (resposta.ok) {
        const buffer = await resposta.arrayBuffer();
        if (buffer && buffer.byteLength) bytes = buffer;
        else ultimoErro = 'a função de voz voltou vazia';
      } else {
        ultimoErro = 'a função de voz respondeu ' + resposta.status;
      }
    } catch (e) {
      ultimoErro = (e && e.name === 'AbortError') ? 'a voz demorou demais' : 'a voz não chegou';
    } finally {
      if (relogio) root.clearTimeout(relogio);
      carregando = false;
    }

    if (!bytes) {
      // Sem drama: cai para o aparelho e segue o jogo. A nota é para quem
      // abriu a tela de voz, não para a criança no meio da conta.
      nota = 'a voz por IA não veio; usei a voz deste aparelho';
      return peloAparelho(texto);
    }

    const url = root.URL.createObjectURL(new root.Blob([bytes], { type: 'audio/mpeg' }));
    guardarNoCache(chave, url, bytes.byteLength);
    tocarUrl(chave, url);
    return true;
  }

  function definirPreferencia(nova) {
    if (PREFERENCIAS.indexOf(nova) < 0) return false;
    preferencia = nova;
    if (nova === 'desligada') { calar(); apagarCache(); }
    ultimoErro = '';
    salvar();
    avisar();
    return true;
  }

  function definirVoz(id) {
    // A tela só oferece as vozes do config. Um id de fora é recusado em vez de
    // ser "ajeitado" para a primeira da lista: assim um erro aparece como erro.
    const lista = config().vozes;
    const aceita = lista.some((v) => v && v.id === id) ? id : null;
    if (!aceita) return false;
    if (aceita === voz) return true;
    voz = aceita;
    calar();                       // trocar de voz no meio da fala para a antiga
    apagarCache();                 // o áudio em memória é da voz anterior
    salvar();
    avisar();
    return true;
  }

  // ── interface ────────────────────────────────────────────
  // A tela de voz mora junto da voz: o HTML só traz os containers, e este
  // módulo pinta as opções a partir do config. Assim trocar as quatro vozes é
  // mexer em config.js, não em dois lugares.
  const ROTULO_PREFERENCIA = {
    peixe: 'Voz por IA',
    aparelho: 'Voz deste aparelho',
    desligada: 'Sem narração',
  };
  const EXPLICACAO_PREFERENCIA = {
    peixe: 'Manda o texto da pergunta para a função /api/voz deste projeto e toca o áudio que '
      + 'ela devolver. Se a função não estiver publicada ou a internet cair, o jogo vira sozinho '
      + 'para a voz deste aparelho — a pergunta nunca fica muda.',
    aparelho: 'Nada sai deste navegador. A qualidade é a voz que o seu aparelho já tem, e funciona '
      + 'sem internet.',
    desligada: 'Nenhuma fala. O botão "Ouvir" fica silencioso.',
  };

  function chip(pai, { valor, rotulo, grupo, descricao }) {
    const b = doc().createElement('button');
    b.type = 'button';
    b.className = 'chip-voz';
    b.dataset.valor = valor;
    b.dataset.grupo = grupo;
    b.setAttribute('role', 'radio');
    b.textContent = rotulo;
    if (descricao) b.title = descricao;
    b.addEventListener('click', function () {
      if (grupo === 'preferencia') definirPreferencia(valor);
      else definirVoz(valor);
    });
    pai.appendChild(b);
    return b;
  }

  function doc() { return root.document; }

  function pintar(s) {
    const d = doc();
    if (!d) return;
    d.querySelectorAll('#vozPreferencias .chip-voz').forEach(function (b) {
      const ativa = b.dataset.valor === s.preferencia;
      b.classList.toggle('ativa', ativa);
      b.setAttribute('aria-checked', String(ativa));
      b.disabled = b.dataset.valor === 'peixe' && !(s.temEndpoint && s.vozes.length);
    });
    d.querySelectorAll('#vozLista .chip-voz').forEach(function (b) {
      const ativa = b.dataset.valor === s.voz;
      b.classList.toggle('ativa', ativa);
      b.setAttribute('aria-checked', String(ativa));
    });
    const notaP = d.getElementById('vozNotaPreferencia');
    if (notaP) notaP.textContent = EXPLICACAO_PREFERENCIA[s.preferencia] || '';
    const notaV = d.getElementById('vozNotaVoz');
    if (notaV) {
      notaV.textContent = s.preferencia === 'aparelho'
        ? 'No modo aparelho a voz escolhida só muda o tom: quem fala é o sintetizador do seu sistema.'
        : (s.vozes.length > 0 ? 'Amostra: ' + s.rotulo + '. São vozes da comunidade Fish Audio, conferidas no catálogo público; se uma delas não servir, o dono do projeto troca o id no config.js.' : '');
    }
    const estado = d.getElementById('vozEstadoModal');
    if (estado) {
      estado.textContent = s.carregando ? 'Buscando a voz por IA…'
        : s.falando ? 'Falando…'
        : s.nota ? s.nota
        : s.erro ? 'Última falha: ' + s.erro
        : 'Pronto.';
      estado.classList.toggle('voz-ativa', !!(s.carregando || s.falando));
    }
    const pendentes = d.getElementById('vozPendentes');
    if (pendentes) {
      let texto = '';
      if (!s.temEndpoint) {
        texto = 'Pendente: a narração por IA só existe depois de publicar a função api/voz.js na '
          + 'hospedagem e de preencher a variável secreta FISH_AUDIO_API_KEY. Enquanto isso, use a '
          + 'voz deste aparelho.';
      } else if (!s.vozes.length) {
        texto = 'Pendente: nenhuma voz está listada em config.js, então a narração por IA fica '
          + 'apagada aqui. O dono do projeto escolhe as vozes na lista "narracao.vozes".';
      }
      pendentes.textContent = texto;
      pendentes.hidden = !texto;
    }
    const pending = d.getElementById('vozPreferenciasPending');
    if (pending) pending.hidden = true;

    // Os dois ícones que a criança aperta.
    const icone = d.getElementById('btnFalarIcone');
    if (icone) icone.className = s.carregando ? 'fa-solid fa-spinner fa-spin'
      : s.falando ? 'fa-solid fa-stop'
      : s.desligada ? 'fa-solid fa-volume-xmark'
      : 'fa-solid fa-volume-high';
    const hub = d.getElementById('vozIcon');
    if (hub) hub.className = s.desligada ? 'fa-solid fa-comment-slash' : 'fa-solid fa-comment-dots';
    // Uma palavra ao lado do botão do cartão, para quem não vê o ícone girar.
    const sopro = d.getElementById('vozEstado');
    if (sopro) sopro.textContent = s.carregando ? 'ouvindo…' : s.falando ? 'falando…' : '';
  }

  function montarInterface() {
    const d = doc();
    if (!d) return;
    const grupoP = d.getElementById('vozPreferencias');
    const grupoV = d.getElementById('vozLista');
    if (grupoP && !grupoP.querySelector('.chip-voz')) {
      preferenciasParaMostrar().forEach(function (p) {
        chip(grupoP, { valor: p, rotulo: ROTULO_PREFERENCIA[p] || p, grupo: 'preferencia',
          descricao: EXPLICACAO_PREFERENCIA[p] || '' });
      });
    }
    if (grupoV && !grupoV.querySelector('.chip-voz')) {
      config().vozes.forEach(function (v) {
        chip(grupoV, { valor: v.id, rotulo: v.rotulo, grupo: 'voz' });
      });
      if (!config().vozes.length) {
        const aviso = d.createElement('p');
        aviso.className = 'voz-pending';
        aviso.textContent = 'Nenhuma voz listada no config.js.';
        grupoV.appendChild(aviso);
      }
    }
    const amostra = d.getElementById('vozTestar');
    if (amostra) amostra.addEventListener('click', function () {
      falar('Sete mais cinco são doze. Você acertou!');
    });
    const pararBotao = d.getElementById('vozParar');
    if (pararBotao) pararBotao.addEventListener('click', function () { calar(); avisar(); });
    aoMudar(pintar);
  }

  function preferenciasParaMostrar() {
    // O modo IA só aparece se houver para onde mandar; sem hospedagem, a tela
    // não oferece um botão que não faz nada.
    if (config().endpoint) return PREFERENCIAS.slice();
    return PREFERENCIAS.filter(function (p) { return p !== 'peixe'; });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      root.addEventListener('DOMContentLoaded', montarInterface);
    } else {
      montarInterface();
    }
  }

  root.CM_NARRACAO = {
    iniciar: function () { carregar(); avisar(); return resumo(); },
    falar: function (texto) { return falar(texto); },
    parar: function () { calar(); avisar(); return resumo(); },
    vozes: function () { return config().vozes; },
    preferencias: function () { return PREFERENCIAS.slice(); },
    definirPreferencia: definirPreferencia,
    definirVoz: definirVoz,
    estado: function () { return resumo(); },
    aoMudar: aoMudar,
    podeFalar: function () {
      if (preferencia === 'desligada') return false;
      if (preferencia === 'aparelho') return temVozDoAparelho();
      // Modo IA: só faz sentido haver para onde mandar E uma voz da lista do
      // projeto para mandar. Fora isso, é a voz do aparelho ou silêncio.
      return temVozDoAparelho() || (!!config().endpoint && temVozListada());
    },
    limiteDeTexto: function () { return config().maximo; },
    // Só para os testes: tamanho e chaves do cache de memória. As chaves
    // aparecem truncadas — o texto da pergunta não sai do arquivo de teste.
    __cache: function () {
      return {
        entradas: cache.size,
        teto: TETO_DO_CACHE,
        chaves: Array.from(cache.keys()).map((k) => (k.length > 30 ? k.slice(0, 30) + '…' : k)),
      };
    },
  };
})(typeof window !== 'undefined' ? window : this);
