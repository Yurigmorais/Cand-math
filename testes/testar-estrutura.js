/* ===================================================
   CANDY MATH — testes/testar-estrutura.js
   Confere a promessa do README: uma raiz só, caminhos previsíveis e todo
   comando documentado aponta para um arquivo que existe. Foi exatamente aqui
   que o projeto quebrou na última vez (validadores na raiz procurando arquivo
   em ../), então isto fica como guarda.

   Rodar: node testes/testar-estrutura.js
   =================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { RAIZ } = require('./_raiz.js');

const problemas = [];
let checagens = 0;

function existe(relativo) {
  checagens++;
  const alvo = path.join(RAIZ, relativo);
  const tem = fs.existsSync(alvo);
  if (!tem) problemas.push('falta ' + relativo);
  return tem;
}

// ── 1. arquivos obrigatórios na raiz ──────────────────────
['index.html', 'privacidade.html', 'style.css', 'script.js', 'conteudo.js', 'banco-itens.js', 'config.js',
  'nuvem.js', 'duelo.js', 'avaliacao.js', 'como-jogar.js', 'guarda-roupa.js',
  'package.json', 'vercel.json', 'README.md', '.env.example', '.gitignore',
  'supabase/schema.sql', 'testes/_raiz.js',
].forEach(existe);

// ── 2. nenhuma cópia duplicada da árvore ──────────────────
{
  const entradas = fs.readdirSync(RAIZ, { withFileTypes: true });
  const nominho = entradas.filter((e) => e.isDirectory() && /candy-?math/i.test(e.name));
  checagens++;
  if (nominho.length) problemas.push('há pasta(s) com o nome do projeto dentro da raiz, '
    + 'o que cria duas árvores: ' + nominho.map((e) => e.name).join(', '));

  const sql = entradas.filter((e) => e.isFile() && /\.sql$/i.test(e.name));
  checagens++;
  if (sql.length) problemas.push('schema solto na raiz (deve morar em supabase/): ' +
    sql.map((e) => e.name).join(', '));
}

// ── 3. o index.html só chama arquivo que existe ───────────
{
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const alvos = [];
  const re = /<(script|link)\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const attr = /(?:src|href)=["']([^"']+)["']/i.exec(tag);
    if (!attr) continue;
    if (/^(https?:)?\/\//i.test(attr[1])) continue;      // CDN fica para testar-segredos
    if (attr[1].startsWith('#') || attr[1].startsWith('data:')) continue;
    alvos.push({ tipo: m[1], ref: attr[1], ordem: m.index });
  }
  alvos.forEach((a) => {
    const limpo = a.ref.replace(/^\.\//, '').split('?')[0].split('#')[0];
    checagens++;
    if (!fs.existsSync(path.join(RAIZ, limpo))) {
      problemas.push('o index.html carrega ' + a.ref + ' e esse arquivo não existe');
    }
  });

  // Ordem de verdade: script.js é quem amarra tudo e tem de ser o último, e o
  // config tem de estar no ar antes de quem o lê (nuvem.js, duelo.js).
  const posicao = (nome) => {
    const alvo = alvos.find((a) => a.ref.replace(/^\.\//, '').endsWith(nome));
    return alvo ? alvo.ordem : -1;
  };
  const ultima = posicao('script.js');
  checagens++;
  if (ultima < 0) problemas.push('o index.html não carrega script.js');
  if (ultima >= 0) {
    alvos.forEach((a) => {
      if (a.tipo !== 'script') return;
      if (a.ref.endsWith('script.js')) return;
      checagens++;
      if (a.ordem > ultima) problemas.push('o index.html carrega ' + a.ref + ' depois de script.js');
    });
  }
  ['config.js', 'conteudo.js', 'banco-itens.js', 'nuvem.js', 'duelo.js'].forEach((nome) => {
    checagens++;
    if (posicao(nome) < 0) problemas.push('o index.html não carrega ' + nome);
  });
}

// ── 4. os scripts do package.json apontam para arquivo real ──
{
  const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  Object.keys(pkg.scripts || {}).forEach((nome) => {
    const comando = pkg.scripts[nome];
    const re = /((?:testes|supabase)\/[\w./-]+\.(?:js|sql))/g;
    let m;
    while ((m = re.exec(comando))) {
      checagens++;
      if (!fs.existsSync(path.join(RAIZ, m[1]))) {
        problemas.push('o script "' + nome + '" chama ' + m[1] + ', que não existe');
      }
    }
  });
}

// ── 5. os comandos de teste escritos no README existem ────
{
  const readme = fs.readFileSync(path.join(RAIZ, 'README.md'), 'utf8');
  const re = /node\s+((?:testes|supabase)\/[\w./-]+\.(?:js|sql))/g;
  let m;
  while ((m = re.exec(readme))) {
    checagens++;
    if (!fs.existsSync(path.join(RAIZ, m[1]))) {
      problemas.push('o README manda rodar ' + m[1] + ' e esse arquivo não existe');
    }
  }
}

// ── 6. todo .js do projeto passa na análise de sintaxe ────
function* js(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) { yield* js(completo); continue; }
    if (/\.(js|mjs|cjs)$/.test(e.name)) yield completo;
  }
}
{
  const quebrados = [];
  for (const arquivo of js(RAIZ)) {
    checagens++;
    try { execFileSync(process.execPath, ['--check', arquivo], { stdio: 'pipe' }); }
    catch (e) { quebrados.push(path.relative(RAIZ, arquivo) + ': ' +
      String(e.stderr || e.message).split('\n').slice(0, 3).join(' ')); }
  }
  if (quebrados.length) problemas.push('sintaxe ruim:\n    ' + quebrados.join('\n    '));
}

// ── 7. as ações delegadas e a lista permitida batem ───────
// O CSP manda script-src 'self'. Isso só vale enquanto não houver script nem
// handler inline; os botões passaram a usar data-acao, despachados por uma
// lista fechada em script.js. Ficha trocada fora da lista = botão morto.
{
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(RAIZ, 'script.js'), 'utf8');

  const inline = [];
  (html.match(/<script\b[^>]*>[^<]*<\/script>/gi) || []).forEach((tag) => {
    if (/\bsrc=/i.test(tag)) return;
    const corpo = tag.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    if (corpo) inline.push(corpo.slice(0, 40));
  });
  checagens++;
  if (inline.length) problemas.push('há ' + inline.length + ' bloco(s) de script inline no index.html, '
    + 'o que obriga o CSP a liberar unsafe-inline: ' + inline.join(' | '));

  const handlers = (html.match(/\son\w+\s*=/gi) || []);
  checagens++;
  if (handlers.length) problemas.push('atributos de evento inline no index.html (' + handlers.length +
    'x): ' + handlers.join(', ') + ' — script-src \'self\' não sobrevive a isso');

  const javascriptHref = (html.match(/href\s*=\s*["']javascript:/gi) || []).length;
  checagens++;
  if (javascriptHref) problemas.push(javascriptHref + ' link(s) javascript: no index.html');

  const chaves = script.slice(script.indexOf('const ACOES_DOS_BOTOES'));
  const bloco = chaves.slice(chaves.indexOf('{') + 1, chaves.indexOf('\n};'));
  const permitidas = new Set((bloco.match(/^\s*([\w$]+)\s*:/gm) || []).map((s) => /^\s*([\w$]+)\s*:/.exec(s)[1]));
  checagens++;
  if (permitidas.size < 15) problemas.push('a lista de ações permitidas não foi encontrada em script.js');

  const usadas = new Set();
  const arquivosDeInterface = ['index.html', 'script.js', 'duelo.js', 'avaliacao.js', 'como-jogar.js',
    'guarda-roupa.js', 'nuvem.js', 'narracao.js'];
  arquivosDeInterface.forEach((nome) => {
    const fonte = fs.readFileSync(path.join(RAIZ, nome), 'utf8');
    (fonte.match(/data-acao\s*=\s*["']?([\w-]+)/g) || []).forEach((s) => {
      usadas.add(/([\w-]+)$/.exec(s)[1]);
    });
    (fonte.match(/setAttribute\(\s*'data-acao'\s*,\s*'([\w-]+)'/g) || []).forEach((s) => {
      usadas.add(/'([\w-]+)'$/.exec(s)[1]);
    });
  });
  Array.from(usadas).forEach((nome) => {
    checagens++;
    if (!permitidas.has(nome)) {
      problemas.push('o markup chama data-acao="' + nome + '" mas essa ação não está na lista de script.js '
        + '— o botão fica sem efeito');
    }
  });
  Array.from(permitidas).forEach((nome) => {
    checagens++;
    if (!usadas.has(nome)) problemas.push('a lista de script.js tem "' + nome + '" e ninguém usa — '
      + 'superfície sem uso sai da lista');
  });
}

// ── 8. nenhuma chamada a função que não existe no arquivo ─
// O ReferenceError mais caro deste projeto veio daqui: uma função chamada por
// nome dentro do IIFE, que só existia como propriedade do objeto exportado. Em
// 'use strict' isso arrebenta o DOMContentLoaded inteiro, e a tela fica muda
// sem nenhum aviso. Isto confere nome por nome.
{
  const PERMISSOES = new Set([
    // palavras-chave e construtores
    'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'new', 'do', 'else', 'function',
    'await', 'void', 'delete', 'in', 'of', 'instanceof', 'yield', 'async',
    // intrínsecos e APIs que existem no navegador
    'JSON', 'Math', 'Object', 'Array', 'Number', 'String', 'Boolean', 'Date', 'RegExp', 'Error',
    'Map', 'Set', 'WeakMap', 'Promise', 'Symbol', 'Proxy', 'Reflect', 'BigInt',
    'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
    'encodeURI', 'decodeURI', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    'requestAnimationFrame', 'cancelAnimationFrame', 'fetch', 'Blob', 'File', 'FileReader', 'URL',
    'Audio', 'Image', 'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'Node', 'Element',
    'MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'AbortController', 'AbortSignal',
    'SpeechSynthesisUtterance', 'TextEncoder', 'TextDecoder', 'structuredClone', 'queueMicrotask',
    'getComputedStyle', 'matchMedia', 'print', 'alert', 'confirm', 'prompt', 'btoa', 'atob',
    'require', 'Buffer', 'Float32Array', 'Uint8Array', 'ArrayBuffer', 'DataView', 'Intl', 'eval',
  ]);

  function nomesDeclarados(fonte) {
    const nomes = new Set();
    const adicionarLista = (texto) => String(texto || '')
      .replace(/[{}[\]]/g, '')
      .split(',')
      .map((parte) => parte.trim().split(':')[0].trim())
      .filter((s) => /^[\w$]+$/.test(s))
      .forEach((s) => nomes.add(s));
    let m;
    // function nome(params) — o nome e cada param
    const reFunc = /function\s*([\w$]*)\s*\(([^)]*)\)/g;
    while ((m = reFunc.exec(fonte))) {
      if (m[1]) nomes.add(m[1]);
      adicionarLista(m[2]);
    }
    // método de objeto: nome(params) {
    const reMetodo = /^\s*([\w$]+)\s*\(([^)]*)\)\s*\{/gm;
    while ((m = reMetodo.exec(fonte))) { nomes.add(m[1]); adicionarLista(m[2]); }
    // setas: (a, b) => e x =>
    const reSetaParent = /\(([^()]*)\)\s*=>/g;
    while ((m = reSetaParent.exec(fonte))) adicionarLista(m[1]);
    const reSetaSolta = /[^\w$)\]]\s*([\w$]+)\s*=>/g;
    while ((m = reSetaSolta.exec(fonte))) adicionarLista(m[1]);
    // declarações e destruturamentos
    const reVar = /(?:const|let|var)\s+([\w$]+|[{[][^}\]]*[}\]])/g;
    while ((m = reVar.exec(fonte))) {
      if (/^[{[]/.test(m[1])) adicionarLista(m[1]); else nomes.add(m[1]);
    }
    const reFor = /for\s*\(\s*(?:const|let|var)\s+([\w$]+|[{[][^}\]]*[}\]])/g;
    while ((m = reFor.exec(fonte))) adicionarLista(m[1]);
    // catch (erro)
    const reCatch = /\bcatch\s*\(\s*([\w$]+)/g;
    while ((m = reCatch.exec(fonte))) nomes.add(m[1]);
    // rotulo de módulo: root.CM_NARRACAO = {...} não declara nome chamável, então
    // fica fora de propósito — foi exatamente um desses que quebrou a tela.
    return nomes;
  }

  function semStringsEComentarios(fonte) {
    // Primeiro as strings (um "https://..." dentro delas não é comentário),
    // depois os comentários. E o "\B" de uma expressão regular não é chamada.
    return fonte
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
      .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
      .replace(/`(?:[^`\\]|\\[\s\S])*`/g, '""')
      .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1 ');
  }

  const alvos = ['script.js', 'narracao.js', 'nuvem.js', 'duelo.js', 'avaliacao.js',
    'como-jogar.js', 'guarda-roupa.js', 'conteudo.js', 'banco-itens.js', 'config.js'];
  // Script clássico shared: o que um arquivo declara, os outros enxergam.
  const uniao = new Set(PERMISSOES);
  const fontes = {};
  alvos.forEach((nome) => {
    fontes[nome] = fs.readFileSync(path.join(RAIZ, nome), 'utf8');
    nomesDeclarados(fontes[nome]).forEach((n) => uniao.add(n));
  });
  alvos.forEach((nome) => {
    const corpo = semStringsEComentarios(fontes[nome]);
    const re = /(^|[^\w$.'"\\])([\w$]+)\s*\(/g;
    const vistas = new Set();
    let m;
    while ((m = re.exec(corpo))) {
      const alvo = m[2];
      if (/^\d/.test(alvo) || vistas.has(alvo)) continue;
      vistas.add(alvo);
      checagens++;
      if (!uniao.has(alvo)) {
        problemas.push(nome + ': chama ' + alvo + '() e nenhum arquivo do projeto declara essa função — '
          + 'em strict mode é ReferenceError no momento em que o caminho roda');
      }
    }
  });
}

// ── 9. toda página da raiz se apresenta e não esconde script ───
// A página de privacidade nasceu de uma referência órfã: o vercel.json prometia
// privacidade.html e o arquivo não existia. Aqui a promessa e o arquivo têm de
// bater, e nenhum HTML pode carregar script por baixo do CSP.
{
  const paginas = fs.readdirSync(RAIZ).filter((n) => /\.html$/i.test(n));
  checagens++;
  if (paginas.indexOf('index.html') < 0) problemas.push('não há index.html na raiz');

  paginas.forEach((nome) => {
    const html = fs.readFileSync(path.join(RAIZ, nome), 'utf8');

    checagens++;
    if (!/<html\s+lang=["']pt-BR["']/i.test(html)) problemas.push(nome + ': falta lang="pt-BR" no <html>');
    checagens++;
    if (!/charset=["']?utf-8/i.test(html)) problemas.push(nome + ': falta <meta charset="UTF-8">');

    const refs = [];
    const re = /<(script|link|img)\b[^>]*>/gi;
    let m;
    while ((m = re.exec(html))) {
      const attr = /(?:src|href)=["']([^"']+)["']/i.exec(m[0]);
      if (!attr) continue;
      if (/^(https?:)?\/\//i.test(attr[1]) || attr[1].startsWith('data:') || attr[1].startsWith('#')) continue;
      refs.push(attr[1]);
    }
    refs.forEach((ref) => {
      checagens++;
      const limpo = ref.replace(/^\.\//, '').split('?')[0].split('#')[0];
      if (limpo && !fs.existsSync(path.join(RAIZ, limpo))) {
        problemas.push(nome + ': chama ' + ref + ' e esse arquivo não existe');
      }
    });

    const inline = (html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi) || [])
      .filter((tag) => !/^<script\b[^>]*\bsrc=/i.test(tag))
      .map((tag) => /<script\b[^>]*>([\s\S]*?)<\/script>/i.exec(tag)[1].trim())
      .filter((corpo) => corpo.length);
    checagens++;
    if (inline.length) problemas.push(nome + ': ' + inline.length +
      ' bloco(s) de script inline — o CSP não pode liberar unsafe-inline por causa de página de texto');

    checagens++;
    const handlers = html.match(/\son\w+\s*=\s*["']/gi) || [];
    if (handlers.length) problemas.push(nome + ': handler de evento inline (' + handlers.length + 'x) — ' +
      handlers.slice(0, 4).join(', '));

    checagens++;
    if (/href\s*=\s*["']javascript:/i.test(html)) problemas.push(nome + ': link javascript:');
  });

  const vercel = fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8');
  const prometidas = new Set((vercel.match(/[\w.-]+\.html/g) || []));
  Array.from(prometidas).forEach((nome) => {
    checagens++;
    if (!fs.existsSync(path.join(RAIZ, nome))) {
      problemas.push('o vercel.json fala em ' + nome + ' e esse arquivo não existe na raiz');
    }
  });

  const index = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  checagens++;
  if (prometidas.has('privacidade.html') && !/privacidade\.html/.test(index)) {
    problemas.push('nada no index.html leva à página de privacidade: ela existe, mas ninguém acha');
  }
}

console.log('estrutura — raiz ' + RAIZ);
if (problemas.length) console.log('\n' + problemas.join('\n'));
else console.log('tudo no lugar: uma raiz só, referências inteiras, sintaxe limpa.');
console.log('checagens: ' + checagens + ' · problemas: ' + problemas.length);
process.exitCode = problemas.length ? 1 : 0;
