/* Confere o banco autoral: ids únicos, 4 alternativas sem repetição,
   valor numérico batendo com alt[0], código BNCC do ano certo e
   cobertura por ano/nível.
   Rodar da raiz do projeto: node testes/validar-banco.js */
const path = require('path');
const fs = require('fs');
const { RAIZ } = require('./_raiz.js');
const CM = require(path.join(RAIZ, 'conteudo.js'));
const banco = require(path.join(RAIZ, 'banco-itens.js'));

const erros = [];
function ptNumero(s) {
  const limpo = String(s).replace(/[^\d,.-]/g, '');
  if (limpo.indexOf(',') >= 0) return parseFloat(limpo.replace(/\./g, '').replace(',', '.'));
  return parseFloat(/^-?\d{1,3}(\.\d{3})+$/.test(limpo) ? limpo.replace(/\./g, '') : limpo);
}
function fail(onde, msg, dump) {
  erros.push(onde + ': ' + msg + '\n   ' + JSON.stringify(dump));
}

const itens = banco.BANCO_ITENS || [];
const afs = banco.BANCO_AFIRMACOES || [];
console.log('itens autorais: ' + itens.length + ' | afirmações: ' + afs.length);

const EXTRATO = path.join(__dirname, 'bncc-matematica.txt');
const CODIGOS = new Set();
if (fs.existsSync(EXTRATO)) {
  (fs.readFileSync(EXTRATO, 'utf8').match(/EF\d\dMA\d\d/g) || []).forEach((c) => CODIGOS.add(c));
}
console.log('códigos BNCC conhecidos: ' + CODIGOS.size);

const ids = {};
itens.forEach((it) => {
  const onde = it.id + ' (' + it.ano + '-' + it.nv + ')';
  if (ids[it.id]) fail(onde, 'id repetido', it.id);
  ids[it.id] = 1;
  if (!it.alt || it.alt.length !== 4) return fail(onde, 'alt != 4', it.alt);
  if (new Set(it.alt).size !== 4) fail(onde, 'alternativas repetidas', it.alt);
  if (it.alt.some((a) => typeof a !== 'string' || /undefined|NaN/.test(a))) fail(onde, 'alternativa quebrada', it.alt);
  if (!it.txt || /undefined|NaN/.test(it.txt)) fail(onde, 'texto quebrado', it.txt);
  if (/  /.test(it.txt)) fail(onde, 'espaço duplo', it.txt);
  if (!/^(numeros|algebra|geometria|medidas|dados)$/.test(it.u)) fail(onde, 'unidade inválida', it.u);
  if (!it.o) fail(onde, 'sem objeto de conhecimento', it);
  const cod = (it.bncc || [])[0] || '';
  if (!/^EF\d{2}MA\d{2}$/.test(cod)) fail(onde, 'código BNCC inválido', it.bncc);
  else {
    const anoDoCode = parseInt(cod.slice(2, 4), 10);
    if (Math.abs(anoDoCode - it.ano) > 1) fail(onde, 'BNCC de outro ano (' + cod + ')', it.ano + 'º');
    if (CODIGOS.size && !CODIGOS.has(cod)) fail(onde, 'código BNCC fora da lista oficial', cod);
  }
  if ('valor' in it) {
    const v = ptNumero(it.alt[0]);
    if (!isFinite(it.valor) || !isFinite(v) || Math.abs(v - it.valor) > 0.011)
      fail(onde, 'valor ' + it.valor + ' não bate com alt[0] "' + it.alt[0] + '" → ' + v, it.alt);
  }
});

const aid = {};
afs.forEach((a) => {
  const onde = a.id + ' (' + a.ano + '-' + a.nv + ')';
  if (aid[a.id]) fail(onde, 'id repetido', a.id);
  aid[a.id] = 1;
  if (typeof a.certa !== 'boolean') fail(onde, 'certa não é boolean', a);
  if (!a.txt || /undefined|NaN/.test(a.txt) || /  /.test(a.txt)) fail(onde, 'texto quebrado', a.txt);
  if (!a.why) fail(onde, 'sem justificativa', a.txt);
  if (!/^(numeros|algebra|geometria|medidas|dados)$/.test(a.u)) fail(onde, 'unidade inválida', a.u);
  const cod = (a.bncc || [])[0] || '';
  if (!/^EF\d{2}MA\d{2}$/.test(cod)) fail(onde, 'BNCC inválido', a.bncc);
  else {
    if (Math.abs(parseInt(cod.slice(2, 4), 10) - a.ano) > 1) fail(onde, 'BNCC de outro ano (' + cod + ')', a.ano + 'º');
    if (CODIGOS.size && !CODIGOS.has(cod)) fail(onde, 'código BNCC fora da lista oficial', cod);
  }
});

// cobertura por ano/nível
console.log('\n=== cobertura do banco autoral ===');
for (let ano = 1; ano <= 9; ano++) {
  for (let nv = 1; nv <= 4; nv++) {
    const doNivel = itens.filter((i) => i.ano === ano && i.nv === nv);
    const uni = {};
    doNivel.forEach((i) => { uni[i.u] = (uni[i.u] || 0) + 1; });
    const afN = afs.filter((a) => a.ano === ano && a.nv === nv).length;
    console.log(ano + 'º nv' + nv + ' | itens ' + doNivel.length + ' ' + JSON.stringify(uni) + ' | V/F ' + afN);
  }
}

// o motor enxerga o banco?
const alvos = [[3, 2], [6, 3], [8, 2], [9, 4]];
alvos.forEach((alvo) => {
  const amostras = [];
  for (let i = 0; i < 120; i++) {
    const it = CM.sortear({ ano: alvo[0], nv: alvo[1], usadas: [] });
    if (String(it.ref).charAt(0) === 'B') amostras.push('[' + it.u + '] ' + it.txt + ' → ' + it.alt[0]);
  }
  console.log('\n=== itens do banco sorteados pelo motor (' + alvo[0] + 'º ano nv' + alvo[1] + ') ===');
  console.log(amostras.slice(0, 4).join('\n') || '   nenhum item autoral veio');
});

console.log('\n=== resultado ===');
console.log('erros: ' + erros.length);
erros.slice(0, 40).forEach((e) => console.log(' - ' + e));
process.exitCode = erros.length ? 1 : 0;
