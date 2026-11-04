/* ===================================================
   CANDY MATH — testes/testar-politicas-sql.js
   Não liga em banco nenhum: lê supabase/schema.sql, as migrações e os
   arquivos do navegador e confere as invariantes de autorização que a
   auditoria exige. É o teste que roda aqui; o teste de comportamento real
   (com duas contas) é testar-autorizacao.js e precisa de credenciais.

   Rodar: node testes/testar-politicas-sql.js
   =================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { RAIZ, emRaiz } = require('./_raiz.js');

const schema = fs.readFileSync(emRaiz('supabase', 'schema.sql'), 'utf8');
const migrateDir = emRaiz('supabase', 'migrations');
const migrations = fs.existsSync(migrateDir)
  ? fs.readdirSync(migrateDir).filter((f) => f.endsWith('.sql'))
      .map((f) => ({ nome: f, texto: fs.readFileSync(path.join(migrateDir, f), 'utf8') }))
  : [];

// Ponto e vírgula não quebra linha aqui: trabalhamos por bloco, não por linha.
function semComentarios(texto) {
  return texto.replace(/--[^\n]*/g, '');
}

const sql = semComentarios(schema);
const falhas = [];
const ok = [];

function exige(condicao, descricao) {
  if (condicao) ok.push('✓ ' + descricao);
  else falhas.push('✗ ' + descricao);
}

// ── 1. Toda tabela do schema tem RLS ligado ────────────────
const tabelas = [];
{
  const re = /create table if not exists public\.([a-z_]+)/gi;
  let m;
  while ((m = re.exec(sql))) tabelas.push(m[1]);
}
exige(tabelas.length >= 6, 'schema cria as tabelas de contas, crianças, salas e jogadas (' + tabelas.join(', ') + ')');
tabelas.forEach((t) => {
  exige(new RegExp('alter table public\\.' + t + '\\s+enable row level security', 'i').test(sql),
    'RLS ligado em ' + t);
});

// ── 2. Nenhuma política aberta ─────────────────────────────
exige(!/using\s*\(\s*true\s*\)/i.test(sql), 'nenhuma política com "using (true)"');
exige(!/with check\s*\(\s*true\s*\)/i.test(sql), 'nenhuma política com "with check (true)"');
exige(!/create policy[^;]*for all/i.test(sql), 'nenhuma política "for all" — cada operação tem a sua');

// ── 3. salas e jogadas: o navegador não escreve nelas ─────
['salas', 'jogadas'].forEach((t) => {
  const re = /create policy\s+\w+\s+on public\.\w+[^;]*;/gi;
  let m;
  const escritas = [];
  while ((m = re.exec(sql))) {
    const bloco = m[0];
    if (!new RegExp('on public\\.' + t + '\\b', 'i').test(bloco)) continue;
    if (/\bfor (insert|update|delete|all)\b/i.test(bloco)) escritas.push(bloco.split('\n')[0]);
  }
  exige(escritas.length === 0, t + ': só leitura pelo cliente; escrever passa por função autorizada'
    + (escritas.length ? ' — achado: ' + escritas.join(' | ') : ''));
});

// ── 4. SECURITY DEFINER sempre com search_path preso ──────
{
  const blocos = sql.split(/create or replace function/i).slice(1);
  let semPath = 0;
  blocos.forEach((b) => {
    const marcador = b.indexOf('as $$');
    const cabecalho = b.slice(0, marcador >= 0 ? marcador : 600);
    if (/security definer/i.test(cabecalho) && !/set search_path/i.test(cabecalho)) semPath++;
  });
  exige(semPath === 0, 'toda função SECURITY DEFINER fixa search_path (' + semPath + ' sem)');
  const totalDefiner = (sql.match(/security definer/gi) || []).length;
  exige(totalDefiner >= 10, 'as portas de entrada autorizadas existem como funções DEFINER (' + totalDefiner + ')');
}

// ── 5. A chave pública do navegador não tem privilégio de tabela ──
tabelas.forEach((t) => {
  exige(new RegExp('revoke all on public\\.' + t + '\\s+from[^;]*anon', 'i').test(sql),
    'privilégios de ' + t + ' retirados do papel anon');
});
exige(!/grant\s+[^;]*to\s+anon\b/i.test(sql), 'nenhum grant para o papel anon — nem em tabela, nem em view');

// ── 6. Toda função usada dentro de política é executável pela conta ──
// Descoberto na revisão: helper sem grant derruba todo SELECT com
// "permission denied" — e o erro aparece como se o banco estivesse vazio.
{
  const usadas = new Set();
  sql.split(/create policy/i).slice(1).forEach((bloco) => {
    const trecho = bloco.slice(0, bloco.indexOf(';'));
    let q; const qre = /public\.(_\w+)\s*\(/g;
    while ((q = qre.exec(trecho))) usadas.add(q[1]);
  });
  exige(usadas.size > 0, 'as políticas de progresso e jogadas delegam a funções de apoio');
  Array.from(usadas).forEach((nome) => {
    exige(new RegExp('grant execute on function public\\.' + nome + '\\([^)]*\\)\\s+to authenticated', 'i').test(sql),
      'helper ' + nome + ' tem grant execute para authenticated (sem isso, toda leitura falha)');
  });
}

// ── 7. As portas do duelo são fechadas para anon ─────────
['criar_sala', 'entrar_na_sala', 'registrar_jogada', 'encerrar_sala', 'sair_da_sala'].forEach((fn) => {
  exige(new RegExp('revoke all on function public\\.' + fn + '\\([^)]*\\)\\s+from[^;]*anon', 'i').test(sql),
    fn + '(): anon não executa');
  exige(new RegExp('grant execute on function public\\.' + fn + '\\([^)]*\\)\\s+to authenticated', 'i').test(sql),
    fn + '(): authenticated executa');
});

// ── 8. Views não herdam privilégio de dono ────────────────
{
  const re = /create or replace view public\.(\w+)([^)]*?)\s+as/is;
  let m; const vistas = [];
  while ((m = re.exec(sql))) vistas.push({ nome: m[1], corpo: sql.slice(m.index, m.index + 400) });
  vistas.forEach((v) => {
    exige(/security_invoker\s*=\s*true/i.test(v.corpo),
      'view ' + v.nome + ' é security_invoker (usa as políticas de quem consulta)');
  });
}

// ── 9. Vinculação por código tem trava de enumeração ──────
exige(/tentativas_vinculo/i.test(sql), 'existe registro de tentativas de vínculo');
exige(/char_length\([^)]*\)\s*(>=|between)\s*\d+/i.test(sql) || /format\(p_codigo/i.test(sql) || /p_codigo !~ /i.test(sql)
  || /~ '\^\[A-Z/i.test(sql), 'vincular_por_codigo valida o formato do código antes de procurar');

// ── 10. O navegador não escreve direto em salas/jogadas ──
['nuvem.js', 'duelo.js'].forEach((arquivo) => {
  const codigo = fs.readFileSync(emRaiz(arquivo), 'utf8');
  const re = /\.from\(\s*['"](?:salas|jogadas)['"]\s*\)[\s\S]{0,80}?\.(insert|update|delete|upsert)\s*\(/g;
  exige(!re.test(codigo), arquivo + ': nenhuma escrita direta em salas/jogadas');
  // Ler jogadas pelo cliente é o atalho da varredura quando o realtime cai, e é
  // legítimo: a política de SELECT só devolve a linha a quem está na mesa. Já
  // salas não tem leitura livre — se ela existisse, um código serviria para
  // saber quem joga com quem.
  exige(!/\.from\(\s*['"]salas['"]\s*\)[\s\S]{0,80}?\.select\s*\(/.test(codigo),
    arquivo + ': nenhuma leitura direta da tabela salas');
  const leJogadas = /\.from\(\s*['"]jogadas['"]\s*\)[\s\S]{0,80}?\.select\s*\(/.test(codigo);
  if (leJogadas) {
    exige(/create policy\s+\w+\s+on public\.jogadas\s+[\s\S]{0,200}?for select/i.test(sql),
      arquivo + ': lê jogadas direto, e existe política de SELECT restrita aos membros da mesa');
  }
});

// ── 10b. O campo de código comporta o código que sai do banco ──
// Um maxlength menor que o comprimento gerado tranca a porta de entrada da sala
// por um motivo que nenhum usuário entende: a pessoa digita o código inteiro e as
// últimas letras somem. E alfabeto diferente entre os dois lados rejeita um
// código perfeitamente válido. Os dois casos estiveram presentes nesta base.
{
  const nuvem = fs.readFileSync(emRaiz('nuvem.js'), 'utf8');
  const duelo = fs.readFileSync(emRaiz('duelo.js'), 'utf8');
  const html = fs.readFileSync(emRaiz('index.html'), 'utf8');
  // Código da SALA: quem emite é o banco, dentro de criar_sala().
  const sala = Number((sql.match(/public\._novo_codigo\(\s*(\d+)\s*\)/) || [])[1] || 0);
  // Código de VÍNCULO da criança: quem emite é o aparelho.
  const vinculo = Number((nuvem.match(/const TAMANHO_CODIGO\s*=\s*(\d+)/) || [])[1] || 0);
  const faixa = (nuvem.match(/const CODE_MINIMO\s*=\s*(\d+)/) || [])[1];
  const teto = (nuvem.match(/const CODE_MAXIMO\s*=\s*(\d+)/) || [])[1];
  const campo = /id="dueloCodigo"[^>]*maxlength="(\d+)"/.exec(html);
  const limites = (duelo.match(/FORMA_CODIGO_SALA\s*=\s*\/\^\[[^\]]+\]\{(\d+),(\d+)\}\//i) || []);

  exige(sala >= 6, 'criar_sala() emite um código de sala com pelo menos 6 caracteres (' + sala + ')');
  exige(vinculo >= 6, 'nuvem.js emite um código de vínculo com pelo menos 6 caracteres (' + vinculo + ')');
  exige(!!campo, 'index.html declara o campo #dueloCodigo com maxlength');
  if (campo) {
    const comporta = Number(campo[1]) >= Math.max(sala, vinculo);
    exige(comporta, 'index.html: o campo aceita o código inteiro (maxlength ' + campo[1] +
      '; o banco emite ' + sala + ' para sala e o aparelho ' + vinculo + ' para vínculo)');
  }
  exige(sala >= Number(faixa) && sala <= Number(teto) &&
        vinculo >= Number(faixa) && vinculo <= Number(teto),
    'os dois comprimentos caem dentro da faixa que o banco aceita (' + sala + ' e ' + vinculo +
    ' em ' + faixa + '–' + teto + ')');
  if (limites[1]) {
    exige(sala >= Number(limites[1]) && sala <= Number(limites[2]),
      'duelo.js aceita o comprimento que criar_sala() emite (' + sala + ' dentro de ' +
      limites[1] + '–' + limites[2] + ')');
  }
  const alfabeto = (nuvem.match(/const ALFABETO\s*=\s*'([A-Z2-9]+)'/) || [])[1] || '';
  const classe = (duelo.match(/const FORMA_CODIGO_SALA\s*=\s*\/\^\[([^\]]+)\]\{/) || [])[1] || '';
  const aceita = (corpo, caractere) => new RegExp('^[' + corpo + ']$', 'i').test(caractere);
  const deFora = alfabeto.split('').filter((c) => !aceita(classe, c));
  exige(alfabeto.length > 0 && classe.length > 0,
    'os dois lados declaram o alfabeto do código (nuvem.js ' + alfabeto.length + ' caracteres)');
  exige(deFora.length === 0, 'todo caractere que o banco emite passa na checagem de formato do duelo' +
    (deFora.length ? ' — ficam de fora: ' + deFora.join('') : ''));
}

// ── 11. Migrações não revive política permissiva ─────────
migrations.forEach((mig) => {
  const corpo = semComentarios(mig.texto);
  exige(!/create policy[^;]*using\s*\(\s*true\s*\)/i.test(corpo),
    'migração ' + mig.nome + ': não recria política aberta');
});
{
  const antigos = ['salas_usar', 'jogadas_inserir', 'jogadas_ler', 'jogadas_apagar'];
  antigos.forEach((nome) => {
    const re = new RegExp('create policy\\s+' + nome + '\\b', 'i');
    exige(!re.test(sql), 'política antiga ' + nome + ' não volta no schema');
  });
}

// ── 12. Nada de chave secreta no caminho do navegador ────
const naTela = ['index.html', 'config.js', 'script.js', 'duelo.js', 'nuvem.js', 'avaliacao.js',
  'conteudo.js', 'banco-itens.js', 'como-jogar.js', 'guarda-roupa.js', 'style.css'];
naTela.forEach((arquivo) => {
  const texto = fs.readFileSync(emRaiz(arquivo), 'utf8');
  exige(!/service_role/i.test(texto), arquivo + ': sem service_role');
  exige(!/FISH_AUDIO_API_KEY\s*[:=]\s*['"][A-Za-z0-9_-]{10,}/.test(texto), arquivo + ': sem chave do Fish Audio embutida');
});

// ── 13. O arquivo aplica de uma ponta a outra ────────────
// Em 04/11/2026 a primeira aplicação real no Supabase morreu no meio, com
// "function public._e_cuidador(text) does not exist": as políticas chamavam
// auxiliares que só eram criados depois delas. O Postgres resolve o nome da
// função no instante do CREATE POLICY / CREATE VIEW / CREATE TRIGGER / GRANT,
// então a ORDEM do arquivo é parte da correção, não estilo — e este bloco é o
// que impede a gente de voltar a entregar um schema que não aplica.
function referenciasAdiantadas(texto, nome) {
  const linhas = texto.split('\n');
  const defs = {};
  linhas.forEach((l, i) => {
    const m = /^\s*create or replace function (?:if not exists )?public\.([a-z_0-9]+)/i.exec(l);
    if (m) defs[m[1].toLowerCase()] = i + 1;
  });
  const eager = /^\s*(create policy|create or replace view|create view|create trigger|grant |revoke |alter table|create index)/i;
  const problemas = [];
  let bloco = '';
  let inicio = 0;
  linhas.forEach((l, i) => {
    if (!bloco.trim()) inicio = i + 1;
    bloco += l + '\n';
    if (/;\s*$/.test(l)) {
      if (eager.test(bloco.split('\n')[0] || '')) {
        const re = /public\.([a-z_0-9]+)\s*\(/gi;
        let m;
        while ((m = re.exec(bloco))) {
          const f = m[1].toLowerCase();
          if (defs[f] && inicio < defs[f]) {
            problemas.push(nome + ':' + inicio + ' chama ' + f + '(), definida só na linha ' + defs[f]);
          }
        }
      }
      bloco = '';
    }
  });
  return problemas;
}
{
  const adiantadas = referenciasAdiantadas(sql, 'schema.sql')
    .concat(migrations.map((m) => referenciasAdiantadas(semComentarios(m.texto), m.nome))
      .reduce((a, b) => a.concat(b), []));
  exige(adiantadas.length === 0,
    'nenhuma função chamada antes de existir — o schema aplica sem morrer no meio'
    + (adiantadas.length ? ' (' + adiantadas.join('; ') + ')' : ''));

  // a regressão específica, conferida pelo nome e não só pela regra geral
  const linhasSql = sql.split('\n');
  const primeiraPolitica = linhasSql.findIndex((l) => /^\s*create policy/i.test(l)) + 1;
  ['_membro_de', '_e_membro', '_e_cuidador', '_e_dono'].forEach((f) => {
    const linha = linhasSql.findIndex((l) =>
      new RegExp('create or replace function public\\.' + f + '\\(', 'i').test(l)) + 1;
    exige(linha > 0 && linha < primeiraPolitica,
      f + '() existe antes da primeira política (linha ' + linha + ' < ' + primeiraPolitica + ')');
  });
  // o grant que as políticas precisam tem de vir junto das funções, não depois
  const antesDasPoliticas = sql.split('\n').slice(0, primeiraPolitica - 1).join('\n').length;
  const grant = sql.toLowerCase().indexOf('grant execute on function public._e_cuidador');
  exige(grant > 0 && grant < antesDasPoliticas,
    'o grant de _e_cuidador também precede as políticas (sem ele, leitura vira "permission denied")');
}

// ── Resultado ─────────────────────────────────────────────
console.log('políticas de autorização — ' + path.relative(RAIZ, emRaiz('supabase', 'schema.sql'))
  + (migrations.length ? ' + ' + migrations.length + ' migração(ões)' : ''));
console.log(falhas.length ? '\n' + falhas.join('\n') + '\n' : '\ntodas as invariantes passaram.');
console.log('verificações feitas: ' + (ok.length + falhas.length) + ' · falhas: ' + falhas.length);
process.exitCode = falhas.length ? 1 : 0;
