/* ===================================================
   CANDY MATH — api/voz.js  (função serverless da Vercel)
   Casca fina sobre api/_voz-nucleo.js. Existe por um motivo: a chave de
   síntese de voz é secreta, e segredo não entra em navegador.

   Este arquivo só conversa com a Vercel (req/res). Toda a decisão — o que é
   voz válida, o que é texto válido, para onde a requisição vai, o que acontece
   quando a upstream falha — mora em _voz-nucleo.js, que é o mesmo código que
   testes/testar-narracao.js exercita com fetch e relógio falsos.

   O que entra aqui:  { texto: "...", voz: "sara" }
   O que sai daqui:   audio/mpeg, ou um erro genérico em JSON.

   Variáveis (Vercel → Settings → Environment Variables, como "Sensitive"):
     FISH_AUDIO_API_KEY      obrigatória para a rota em modo peixe
     FISH_AUDIO_MODELO       opcional, default s2.1-pro-free (rota de custo zero)
     FISH_AUDIO_MAX          opcional, teto de caracteres por frase (default 320)
     FISH_AUDIO_POR_HORA     opcional, teto de requisições por IP por hora (240)
     CM_ORIGENS              opcional, origens separadas por vírgula que podem
                             chamar esta função de outro lugar
     SUPABASE_URL            opcional, junto com a de baixo: liga o cache de
                             áudio. Endereço do projeto, sem barra no fim.
     SUPABASE_SERVICE_ROLE_KEY opcional, secreta: a chave que escreve na tabela
                             narracoes e no bucket privado. Sem ela o cache fica
                             desligado e a função fala direto com a Fish Audio.
     CM_CACHE_TETO           opcional, frases guardadas antes da poda (6000)
     CM_CACHE                opcional, "off" desliga o cache com as chaves no ar

   O que sai daqui é sempre a mesma coisa, vindo do cache ou da síntese:
   audio/mpeg com no-store. Quem chama não precisa saber de qual memória veio.
   =================================================== */
'use strict';

const { criarServico } = require('./_voz-nucleo.js');

const servico = criarServico();

function ipDe(req) {
  const xf = String(req.headers['x-forwarded-for'] || '');
  const primeiro = xf.split(',')[0].trim();
  return primeiro || String(req.headers['x-real-ip'] || 'sem-ip');
}

function despejar(res, resultado) {
  const cabecalhos = resultado.headers || {};
  Object.keys(cabecalhos).forEach((nome) => res.setHeader(nome, cabecalhos[nome]));
  res.statusCode = resultado.status;
  if (resultado.audio) return res.end(resultado.audio);
  res.end(JSON.stringify(resultado.corpo || { erro: 'falha' }));
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST');
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return despejar(res, { status: 405, headers: { 'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store' }, corpo: { erro: 'use POST' } });
  }

  if (!servico.origemAceita(req.headers.origin)) {
    return despejar(res, { status: 403, headers: { 'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store' }, corpo: { erro: 'origem não permitida' } });
  }
  const origem = String(req.headers.origin || '').trim();
  const permitidas = String(process.env.CM_ORIGENS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (origem && permitidas.indexOf(origem) >= 0) {
    res.setHeader('Access-Control-Allow-Origin', origem);
    res.setHeader('Vary', 'Origin');
  }

  let corpo = req.body;
  if (typeof corpo === 'string') {
    try { corpo = JSON.parse(corpo); } catch (e) { corpo = null; }
  }

  return despejar(res, await servico.processar({ corpo: corpo, ip: ipDe(req) }));
};
