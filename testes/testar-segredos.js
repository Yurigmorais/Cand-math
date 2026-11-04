/* ===================================================
   CANDY MATH — testes/testar-segredos.js
   Varre a árvore do projeto atrás de segredo que foi parar no lugar errado:
   chave de serviço do Supabase, token JWT, chave do Fish Audio, password em
   linha de comando. O que se procura é o VALOR, não o nome da variável — o
   nome pode (e deve) aparecer em README, .env.example e no próprio código.

   Rodar: node testes/testar-segredos.js
   =================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { RAIZ } = require('./_raiz.js');

// Arquivos que não são código do jogo e que podem, legitimamente, conter uma
// referência a segredo (o schema fala de service_role para explicar que ele
// fica fora do navegador).
const IGNORAR = new Set(['.git', 'node_modules', '.env', '.vercel', 'dist', '.next']);
const EXTENSOES = new Set(['.js', '.mjs', '.cjs', '.html', '.css', '.json', '.sql', '.md', '.txt', '.yaml', '.yml']);

function* caminhar(dir) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR.has(entrada.name)) continue;
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) { yield* caminhar(completo); continue; }
    yield completo;
  }
}

const PADROES = [
  {
    nome: 'chave de serviço do Supabase no código',
    // service_role usado como VALOR atribuído/comparado, não em prosa.
    re: /(service_role|servicekey|service-key)\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}/i,
  },
  {
    nome: 'token JWT embutido',
    re: /['"]eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}['"]/,
  },
  {
    nome: 'chave do Fish Audio no caminho do navegador',
    re: /FISH_AUDIO_API_KEY\s*[:=]\s*['"][A-Za-z0-9]{20,}['"]/,
  },
  {
    nome: 'chave de API no estilo 32+ caracteres aleatórios atribuída a variável de chave',
    re: /(api[_-]?key|apikey|token|secret|password|passwd)\s*[:=]\s*['"][A-Za-z0-9_\-]{32,}['"]/i,
  },
  {
    nome: 'chave pública do Supabase no formato real (eyJ…)',
    re: /\bSB[0-9A-Za-z_\-]{20,}\b/,
  },
  {
    nome: 'chave privada de SSH',
    re: /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/,
  },
];

// O que é "caminho do navegador": tudo que o index.html carrega, mais o que
// mora na raiz e em assets/. A pasta api/ roda no servidor e por definição
// pode ler process.env — ela só não pode ter valor escrito.
const NAVEGADOR = ['index.html', 'config.js', 'script.js', 'duelo.js', 'nuvem.js', 'avaliacao.js',
  'conteudo.js', 'banco-itens.js', 'como-jogar.js', 'guarda-roupa.js', 'style.css'];

const problemas = [];
const avisos = [];
let lidos = 0;

for (const arquivo of caminhar(RAIZ)) {
  const ext = path.extname(arquivo);
  if (!EXTENSOES.has(ext)) continue;
  if (fs.statSync(arquivo).size > 2_000_000) continue;
  const relativo = path.relative(RAIZ, arquivo).split(path.sep).join('/');
  const texto = fs.readFileSync(arquivo, 'utf8');
  lidos++;

  PADROES.forEach((p) => {
    const m = p.re.exec(texto);
    if (!m) return;
    const linha = texto.slice(0, m.index).split('\n').length;
    problemas.push(p.nome + ' → ' + relativo + ':' + linha + ' — ' +
      m[0].slice(0, 48).replace(/\s+/g, ' ') + '…');
  });

  // service_role nunca deve aparecer em arquivo que o navegador baixa.
  if (NAVEGADOR.indexOf(relativo) >= 0 && /service_role/i.test(texto)) {
    problemas.push('a palavra service_role aparece em arquivo do navegador → ' + relativo);
  }
}

// .env existe mas não está no controle de versão?
const envExiste = fs.existsSync(path.join(RAIZ, '.env'));
const gitignore = fs.existsSync(path.join(RAIZ, '.gitignore'))
  ? fs.readFileSync(path.join(RAIZ, '.gitignore'), 'utf8') : '';
if (envExiste && !/^\s*\.env\s*$/m.test(gitignore)) {
  problemas.push('.env existe na raiz e não está coberto pelo .gitignore');
}
if (!fs.existsSync(path.join(RAIZ, '.gitignore'))) {
  problemas.push('não há .gitignore no projeto');
}
if (!fs.existsSync(path.join(RAIZ, '.env.example'))) {
  problemas.push('não há .env.example — quem clona o repo não sabe o que configurar');
}

// .env.example não pode ter valor verdadeiro.
const exemplo = fs.existsSync(path.join(RAIZ, '.env.example'))
  ? fs.readFileSync(path.join(RAIZ, '.env.example'), 'utf8') : '';
exemplo.split('\n').forEach((linha, i) => {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(linha.trim());
  if (!m) return;
  const valor = m[2];
  if (!valor || /^(sua|coloque|exemplo|todo|troque|<|\t)/i.test(valor)) return;
  if (/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(valor) || /^[a-z0-9-]+$/.test(valor)) return;
  if (valor.length >= 24 && /^[A-Za-z0-9_\-]+$/.test(valor)) {
    avisos.push('.env.example:' + (i + 1) + ' tem um valor que parece real (' + m[1] + ')');
  }
});

// Referências de script/folha no HTML: apontam para arquivo que existe?
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const refs = [];
{
  const re = /(?:src|href)=["']([^"'#]+?)["']/g;
  let m;
  while ((m = re.exec(html))) {
    const alvo = m[1];
    if (/^(https?:|mailto:|data:|\/\/)/.test(alvo)) continue;
    refs.push(alvo);
  }
}
refs.forEach((alvo) => {
  const limpo = alvo.replace(/^\.\//, '').split('?')[0];
  if (!fs.existsSync(path.join(RAIZ, limpo))) {
    problemas.push('o index.html chama ' + alvo + ', e esse arquivo não existe na raiz');
  }
});

console.log('caça-segredos — ' + lidos + ' arquivos lidos, ' + refs.length +
  ' referências locais do HTML conferidas');
if (problemas.length) console.log('\n' + problemas.join('\n'));
if (avisos.length) console.log('\navisos:\n' + avisos.join('\n'));
if (!problemas.length) console.log('\nencontrou segredo? nada. referências quebradas? nada.');
console.log('problemas: ' + problemas.length + ' · avisos: ' + avisos.length);
process.exitCode = problemas.length ? 1 : 0;
