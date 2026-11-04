#!/usr/bin/env node
/* Servidor de arquivos mínimo, sem dependências, para desenvolver e auditar
   o jogo localmente:

     node testes/servidor-estatico.js            # http://127.0.0.1:8765
     node testes/servidor-estatico.js 3000       # outra porta

   Existe porque o auditor de layout (testes/auditar-layout.js) fala com um
   endereço http:// e porque abrir o index.html pelo disco (file://) não
   exercita as mesmas regras de MIME e de cache da hospedagem.

   Serve somente arquivos de dentro da raiz do projeto: qualquer tentativa de
   sair da raiz (../, caminho absoluto) devolve 404. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { RAIZ } = require('./_raiz.js');

const PORTA = Number(process.argv[2]) || 8765;
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/* Os cabeçalhos de segurança vêm do vercel.json, não de uma cópia aqui: assim
   o teste local exercita exatamente a mesma política que a hospedagem vai
   mandar. Se o arquivo não existir ou estiver quebrado, o servidor sigue e
   avisa — sem CSP local é um dado, não um erro escondido. */
function cabecalhosDeSeguranca() {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8'));
    const regra = (config.headers || []).find((h) => h.source === '/(.*)');
    const saida = {};
    ((regra && regra.headers) || []).forEach((h) => { saida[h.key] = h.value; });
    if (!saida['Content-Security-Policy']) {
      console.log('aviso: o vercel.json não traz Content-Security-Policy; o navegador vai');
      console.log('       aceitar script inline local, que é justamente o que não queremos.');
    }
    return saida;
  } catch (e) {
    console.log('aviso: não consegui ler vercel.json (' + e.message + '); servindo sem CSP.');
    return {};
  }
}
const SEGURANCA = cabecalhosDeSeguranca();

const servidor = http.createServer((req, res) => {
  let alvo;
  try {
    alvo = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  } catch (e) {
    res.writeHead(400).end('requisição inválida');
    return;
  }
  if (alvo === '/') alvo = '/index.html';
  const arquivo = path.resolve(RAIZ, '.' + alvo);
  if (arquivo !== RAIZ && !arquivo.startsWith(RAIZ + path.sep)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('fora da raiz');
    return;
  }
  if (/^\/api\//.test(alvo)) {
    // Função serverless não roda aqui: o jogo tem de cair para a voz do
    // aparelho sozinho, e é isto que este 501 simula.
    res.writeHead(501, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, SEGURANCA));
    return res.end(JSON.stringify({ erro: 'função serverless só existe na hospedagem' }));
  }
  fs.readFile(arquivo, (erro, dados) => {
    if (erro) {
      res.writeHead(404, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, SEGURANCA))
        .end('não encontrado');
      return;
    }
    res.writeHead(200, Object.assign({
      'Content-Type': TIPOS[path.extname(arquivo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    }, SEGURANCA));
    res.end(dados);
  });
});

servidor.listen(PORTA, '127.0.0.1', () => {
  console.log('Candy Math servido em http://127.0.0.1:' + PORTA + '/index.html');
  console.log('Raiz: ' + RAIZ);
  console.log('Ctrl+C para parar.');
});
