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
    // O anon key LEGADO do Supabase tem exatamente essa cara — e ele é público
    // por desenho, mora em config.js (SEGURANCA.md §1). A isenção é estreita:
    // só o arquivo config.js, só a linha `supabaseAnonKey: '<valor>'`.
    isencao: 'anon',
  },
  {
    nome: 'chave do Fish Audio no caminho do navegador',
    // O traço é obrigatório na classe: a chave real vem com prefixo e hífens.
    re: /FISH_AUDIO_API_KEY\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]/,
  },
  {
    nome: 'chave do Fish Audio pelo prefixo (sk-fish-…)',
    // Mesmo caso da chave secreta do Supabase: o prefixo denuncia o papel sem
    // depender do nome da variável, então quem colar a chave num campo com nome
    // criativo continua pego. Sem isenção nenhuma.
    re: /['"]sk-fish-[A-Za-z0-9_\-]{8,}['"]/,
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
    nome: 'chave secreta nova do Supabase (sb_secret_… = papel service_role)',
    // Desde a troca de chaves do painel, o que antes era `service_role` passou a
    // ser `sb_secret_`. O prefixo denuncia o papel sozinho, então este padrão não
    // precisa do nome da variável — e não tem isenção nenhuma: onde aparecer, é
    // segredo no lugar errado. A irmã pública (`sb_publishable_`) é o anon key e
    // pode morar em config.js.
    re: /['"]sb_secret_[A-Za-z0-9_\-]{8,}['"]/,
  },
  {
    nome: 'chave privada de SSH',
    re: /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/,
  },
];

// Só a linha legítima da anon key está isenta: config.js, campo supabaseAnonKey,
// valor entre aspas e nada mais na linha. service_role, sb_secret_ e a chave do
// Fish Audio nunca passam por aqui — os padrões deles não têm isenção.
function ehLinhaDaAnonKey(texto, indice) {
  const inicio = texto.lastIndexOf('\n', indice) + 1;
  const fim = texto.indexOf('\n', indice);
  const linha = texto.slice(inicio, fim < 0 ? texto.length : fim);
  return /^\s*supabaseAnonKey\s*:\s*['"][^'"\n]+['"],?\s*$/.test(linha);
}

function varrer(texto, relativo, linhaBase) {
  const achados = [];
  // 'g' é obrigatório aqui: sem ele, exec() sempre devolve a primeira ocorrência
  // e o laço abaixo não anda.
  PADROES.forEach((p) => {
    const flags = p.re.flags.indexOf('g') >= 0 ? p.re.flags : p.re.flags + 'g';
    const re = new RegExp(p.re.source, flags);
    let m;
    while ((m = re.exec(texto))) {
      const isento = p.isencao === 'anon' && relativo === 'config.js' &&
        ehLinhaDaAnonKey(texto, m.index);
      if (!isento) {
        const linha = texto.slice(0, m.index).split('\n').length + (linhaBase || 0) - 1;
        achados.push(p.nome + ' → ' + relativo + ':' + linha + ' — ' +
          m[0].slice(0, 48).replace(/\s+/g, ' ') + '…');
      }
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  });
  return achados;
}

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

  varrer(texto, relativo).forEach((p) => problemas.push(p));

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

// ── Autoconferência do próprio detector ────────────────────
// Um detector de segredos que ninguém testa é um detector que ninguém sabe se
// funciona. Os sete casos abaixo correm sobre texto sintético — nada é escrito
// em disco — e cada um diz se o caça-segredos acusou o que devia acusar.
// Os valores falsos são montados por partes. Escrito de uma vez, cada um deles
// seria um segredo verdadeiro no próprio detector — e o caça-segredos acusaria a
// si mesmo, que é exatamente o tipo de ruído que faz alguém desligar um teste.
const JWT_LEGADO = ['eyJhbGciOiJIUzI1NiJ9.', 'cG9zdGdyZXN0LnN1cGFiYXNlLmNv', '.r0kK0-jLegaciaDeExemploAAA'].join('');
const PUBLICAVEL = ['sb_', 'publishable_A1b2C3d4E5f6G7h8I9j0K1l2M3n4'].join('');
const SUPERSECRETA = ['sb_', 'secret_UmaChaveDeServicoFalsa01'].join('');
const DO_PEIXE = ['abcdefghij', 'klmnopqrstuvwxyz'].join('');
const DO_PEIXE_NOVA = ['sk-fish-', 'ExemploFalsoDeTeste', '0123456789abcdef'].join('');
const DE_SERVICO = ['um-valor-de-20-', 'caracteres-aqui'].join('');
const linhaDe = (campo, valor) => "  " + campo + ": '" + valor + "',";
const CASOS = [
  { nome: 'anon key legada (eyJ…) na linha certa de config.js é pública',
    texto: linhaDe('supabaseAnonKey', JWT_LEGADO), arquivo: 'config.js', espera: 0 },
  { nome: 'anon key nova (o prefixo publicável) idem',
    texto: linhaDe('supabaseAnonKey', PUBLICAVEL), arquivo: 'config.js', espera: 0 },
  { nome: 'o MESMO valor eyJ sob outro campo continua sendo segredo',
    texto: linhaDe('chaveAdministrador', JWT_LEGADO), arquivo: 'config.js', espera: 1 },
  { nome: 'a isenção não viaja para outro arquivo',
    texto: linhaDe('supabaseAnonKey', JWT_LEGADO), arquivo: 'script.js', espera: 1 },
  { nome: 'a chave secreta nova é pega, até na linha isenta',
    texto: linhaDe('supabaseAnonKey', SUPERSECRETA), arquivo: 'config.js', espera: 1 },
  { nome: 'service_role atribuída é pega',
    texto: linhaDe('service_role', DE_SERVICO), arquivo: 'config.js', espera: 1 },
  { nome: 'chave do Fish Audio no caminho do navegador é pega',
    texto: linhaDe('FISH_AUDIO_API_KEY', DO_PEIXE), arquivo: 'config.js', espera: 1 },
  { nome: 'a chave do Fish com prefixo e hífens, no campo oficial, é pega',
    texto: linhaDe('FISH_AUDIO_API_KEY', DO_PEIXE_NOVA), arquivo: 'config.js', espera: 1 },
  { nome: 'a mesma chave do Fish num campo com nome criativo também é pega',
    texto: linhaDe('chaveDeVoz', DO_PEIXE_NOVA), arquivo: 'config.js', espera: 1 },
];
let casosRuins = 0;
CASOS.forEach((c) => {
  const achados = varrer(c.texto, c.arquivo).length;
  const bom = c.espera === 0 ? achados === 0 : achados >= 1;
  if (!bom) {
    casosRuins++;
    problemas.push('autoconferência do caça-segredos falhou: ' + c.nome +
      ' (esperava ' + c.espera + ' acusação(ões), veio ' + achados + ')');
  }
});

console.log('caça-segredos — ' + lidos + ' arquivos lidos, ' + refs.length +
  ' referências locais do HTML conferidas, ' + CASOS.length +
  ' casos de autoconferência (' + casosRuins + ' ruins)');
if (problemas.length) console.log('\n' + problemas.join('\n'));
if (avisos.length) console.log('\navisos:\n' + avisos.join('\n'));
if (!problemas.length) console.log('\nencontrou segredo? nada. referências quebradas? nada.');
console.log('problemas: ' + problemas.length + ' · avisos: ' + avisos.length);
process.exitCode = problemas.length ? 1 : 0;
