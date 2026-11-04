/* Acha a raiz do projeto subindo a partir da pasta deste teste, até encontrar
   index.html + style.css + script.js juntos. Assim o teste funciona do mesmo
   jeito com `node testes/x.js`, `cd testes && node x.js` ou de um clone limpo —
   e falha cedo, com mensagem legível, se a estrutura estiver errada. */
'use strict';
const fs = require('fs');
const path = require('path');

const MARCADORES = ['index.html', 'style.css', 'script.js', 'conteudo.js'];

function achar(deOnde) {
  let dir = path.resolve(deOnde);
  for (let i = 0; i < 6; i++) {
    if (MARCADORES.every((m) => fs.existsSync(path.join(dir, m)))) return dir;
    const pai = path.dirname(dir);
    if (pai === dir) break;
    dir = pai;
  }
  return null;
}

const RAIZ = achar(__dirname);
if (!RAIZ) {
  throw new Error(
    'Raiz do Candy Math não encontrada a partir de ' + __dirname +
    '. Esperava index.html, style.css, script.js e conteudo.js na mesma pasta ' +
    '(ou na pasta acima deste teste).'
  );
}

module.exports = { RAIZ: RAIZ, emRaiz: (...p) => path.join(RAIZ, ...p) };
