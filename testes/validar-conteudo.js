/* Validador do motor de conteúdo: roda todos os geradores em muitas
   combinações, passa por cada item do banco autoral e procura respostas
   erradas, alternativas repetidas (no texto e no valor), NaN, itens fora do
   ano/nível e textos quebrados.
   Rodar da raiz do projeto: node testes/validar-conteudo.js [rodadas] */
const path = require('path');
const { RAIZ } = require('./_raiz.js');
const CM = require(path.join(RAIZ, 'conteudo.js'));
require(path.join(RAIZ, 'banco-itens.js'));

const erros = [];
const amostras = {};
function ptNumero(s) {
  const limpo = String(s).replace(/[^\d,.-]/g, '');
  if (limpo.indexOf(',') >= 0) return parseFloat(limpo.replace(/\./g, '').replace(',', '.'));
  return parseFloat(limpo.indexOf('.') >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(limpo)
    ? limpo.replace(/\./g, '') : limpo);
}
function fail(chave, msg, dump) {
  erros.push(chave + ': ' + msg + '\n   ' + JSON.stringify(dump));
}

function confereItem(chave, it) {
  if (!it) return fail(chave, 'item nulo', it);
  if (!it.alt || it.alt.length !== 4) return fail(chave, 'alt != 4', it);
  if (new Set(it.alt).size !== 4) return fail(chave, 'alternativas repetidas', it.alt);
  // Mesma coisa escrita de dois jeitos: "2/12" e "1/6" são o mesmo número, e só
  // um deles está marcado como certo. A criança que escolhe o outro vê um X sem
  // ter errado a conta. Vale para as erradas também: duas alternativas que dizem
  // o mesmo número desperdiçam uma opção e treinam a dúvida.
  for (let i = 0; i < it.alt.length; i++) {
    for (let j = i + 1; j < it.alt.length; j++) {
      if (!CM.mesmaOpcao(it.alt[i], it.alt[j])) continue;
      fail(chave, (i === 0 || j === 0 ? 'DUAS ALTERNATIVAS CORRETAS (mesmo valor da resposta): ' :
        'alternativas repetem o mesmo número: ') + it.alt[i] + ' ≡ ' + it.alt[j], it.alt);
    }
  }
  // itemTexto() recorre a este sufixo quando faltam alternativas: nunca deve
  // aparecer num item, porque é texto inventado chegando na tela da criança.
  if (it.alt.some((a) => /\(opção \d\)/.test(String(a))))
    return fail(chave, 'alternativa gerada pelo reserva de itemTexto', it.alt);
  if (it.alt.some((a) => a == null || String(a).indexOf('undefined') >= 0 || String(a).indexOf('NaN') >= 0))
    return fail(chave, 'alternativa com NaN/undefined', it.alt);
  if (!it.txt || it.txt.indexOf('undefined') >= 0 || it.txt.indexOf('NaN') >= 0)
    return fail(chave, 'enunciado com NaN/undefined', it.txt);
  if (!it.o) return fail(chave, 'sem objeto de conhecimento', it);
  if (!/^EF\d{2}MA\d{2}$/.test((it.bncc || [])[0] || ''))
    return fail(chave, 'código BNCC ausente ou inválido', it.bncc);
  if (['numeros', 'algebra', 'geometria', 'medidas', 'dados'].indexOf(it.u) < 0)
    return fail(chave, 'unidade temática inválida', it.u);
  if ('valor' in it) {
    if (!isFinite(it.valor)) return fail(chave, 'valor não numérico', it);
    const numerico = ptNumero(it.alt[0]);
    if (!isFinite(numerico) || Math.abs(numerico - it.valor) > 0.011)
      return fail(chave, 'alt[0] (' + it.alt[0] + ' → ' + numerico + ') não bate com valor ' + it.valor, it);
  }
  if (it.alt[0] === it.valor && typeof it.alt[0] === 'number')
    return fail(chave, 'alt[0] não foi formatada', it);
  if (it.alt.some((a) => typeof a !== 'string')) return fail(chave, 'alternativa não é texto', it.alt);
  if (/  /.test(it.txt)) return fail(chave, 'espaço duplo no enunciado', it.txt);
  if (/R\$ R\$/.test(it.txt) || /(?<!\.)\.\.(?!\.)/.test(it.txt) || /[?!]\./.test(it.txt))
    return fail(chave, 'pontuação duplicada', it.txt);
  if (it.visual) confereVisual(chave, it);
}

function confereVisual(chave, it) {
  const v = it.visual;
  const nome = chave + ' visual';
  if (['grupos', 'repartir', 'barra', 'malha'].indexOf(v.tipo) < 0)
    return fail(nome, 'tipo de visual desconhecido', v);
  if (v.tipo === 'grupos') {
    if (v.grupos * v.cada !== it.valor) fail(nome, 'grupos × cada não é a resposta', v);
    if (v.grupos > 10 || v.cada > 10) fail(nome, 'desenho grande demais', v);
  }
  if (v.tipo === 'repartir') {
    if (v.total % v.partes !== 0) fail(nome, 'repartição não é exata', v);
    if (v.total / v.partes !== it.valor) fail(nome, 'balas por prato não é a resposta', v);
    if (v.partes > 10 || v.total > 60) fail(nome, 'desenho grande demais', v);
  }
  if (v.tipo === 'barra') {
    if (!(v.numerador > 0 && v.numerador < v.denominador)) fail(nome, 'fração fora de 0 e 1', v);
    if (v.total % v.denominador !== 0) fail(nome, 'total não divide em partes inteiras', v);
    if (v.total / v.denominador * v.numerador !== it.valor) fail(nome, 'barra não bate com a resposta', v);
    if (v.denominador > 12) fail(nome, 'barra com partes demais', v);
  }
  if (v.tipo === 'malha') {
    if (!(v.pct > 0 && v.pct < 100)) fail(nome, 'porcentagem fora da malha', v);
    if (!v.rotulo) fail(nome, 'malha sem rótulo do que está pintado', v);
    if (it.valor > v.total) fail(nome, 'resposta maior que a quantidade toda', v);
  }
}

const chavesTodas = Object.keys(CM.GER).filter((k) => CM.GER[k]);
const rodadas = process.argv[2] ? parseInt(process.argv[2], 10) : 400;

for (const chave of chavesTodas) {
  for (let ano = 1; ano <= 9; ano++) {
    for (let nv = 1; nv <= 4; nv++) {
      for (let i = 0; i < 25; i++) {
        let it;
        try { it = CM.GER[chave](ano, nv); } catch (e) { fail(chave + '/' + ano + nv, 'exceção: ' + e.message, {}); break; }
        confereItem(chave + ' ano ' + ano + ' nv ' + nv, it);
        if (i === 0 && ano >= 3) (amostras[chave] = amostras[chave] || []).push('[' + ano + '-' + nv + '] ' + it.txt + ' → ' + it.alt[0]);
      }
    }
  }
}

// Banco autoral, item por item. Aqui dentro o banco só era conferido de vez em
// quando, quando o sorteio resolvia pescar aquele item — validar-banco.js vê o
// conjunto, mas não enxergava duplicata de valor, que é o que quebra a questão.
const banco = (typeof globalThis !== 'undefined' && globalThis.BANCO_ITENS) || [];
if (!banco.length) fail('banco-itens', 'BANCO_ITENS vazio ou não exposto', {});
banco.forEach((it) => {
  confereItem('banco ' + it.id + ' ano ' + it.ano + ' nv ' + it.nv, it);
  if (it.ano < 1 || it.ano > 9 || it.nv < 1 || it.nv > 4) fail('banco ' + it.id, 'ano/nível fora da faixa', it);
});

// sorteio, incluindo o caminho do banco autoral quando existir
const usadas = [];
for (let i = 0; i < rodadas; i++) {
  const ano = CM.ri(1, 9), nv = CM.ri(1, 4);
  let it;
  try { it = CM.sortear({ ano, nv, usadas }); } catch (e) { fail('sortear', 'exceção: ' + e.message, { ano, nv }); continue; }
  if (!it.alt || it.alt.length !== 4) fail('sortear', 'item sem 4 alternativas', it);
  else confereItem('sortear', it);
  if (it.ano !== ano || it.nv !== nv) fail('sortear', 'item fora do ano/nível pedido', it);
  if (it.ref) usadas.push(it.ref);
  if (usadas.length > 12) usadas.length = 0;
}

// V/F
const familias = {};
for (let i = 0; i < 900; i++) {
  const ano = CM.ri(1, 9);
  const nv = CM.ri(1, 4);
  const a = CM.afirmacao(ano, nv, []);
  if (typeof a.certa !== 'boolean') fail('afirmacao', 'certa não é boolean', a);
  if (!a.txt || a.txt.indexOf('undefined') >= 0 || a.txt.indexOf('NaN') >= 0) fail('afirmacao', 'texto quebrado', a);
  if (/  /.test(a.txt)) fail('afirmacao', 'espaço duplo', a.txt);
  if (!a.explicacao) fail('afirmacao', 'sem explicação', a);
  if (['numeros', 'algebra', 'geometria', 'medidas', 'dados'].indexOf(a.u) < 0) fail('afirmacao', 'unidade inválida', a);
  if (!/^EF\d{2}MA\d{2}$/.test((a.bncc || [])[0] || '')) fail('afirmacao ' + ano, 'bncc inválido', a);
  if (a.ano !== ano || a.nv !== nv) fail('afirmacao', 'ano/nível trocados', a);
  const fam = String(a.id).split(':')[1] + '/' + ano;
  familias[fam] = (familias[fam] || 0) + 1;
  if (familias[fam] === 1) (amostras['__af'] = amostras['__af'] || []).push('[' + ano + 'º] ' + a.txt + '  →  ' + (a.certa ? 'V' : 'F') + '  | ' + a.explicacao);
}

// jogos não-múltipla-escolha
for (let ano = 1; ano <= 9; ano++) {
  for (let nv = 1; nv <= 4; nv++) {
    for (let i = 0; i < 30; i++) {
      const s = CM.sequencia(ano, nv);
      if (!s.seq || s.seq.length < 4 || s.seq.length > 6) fail('sequencia ' + ano + nv, 'seq fora de 4 a 6', s);
      if (!s.resposta || s.erradas.length !== 3) fail('sequencia ' + ano + nv, 'resposta/erradas', s);
      if (new Set([s.resposta].concat(s.erradas)).size !== 4) fail('sequencia ' + ano + nv, 'alternativas repetidas', s);

      const o = CM.ordenar(ano, nv);
      if (o.pecas.length < 4) fail('ordenar ' + ano + nv, 'poucas peças', o);
      const vals = o.correta.map((p) => p.v);
      for (let k = 1; k < vals.length; k++) {
        if (o.ordem === 'crescente' && !(vals[k] > vals[k - 1])) fail('ordenar ' + ano + nv, 'ordem crescente errado', o);
        if (o.ordem === 'decrescente' && !(vals[k] < vals[k - 1])) fail('ordenar ' + ano + nv, 'ordem decrescente errado', o);
      }
      if (o.pecas.map((p) => p.txt).join('|') === o.correta.map((p) => p.txt).join('|'))
        fail('ordenar ' + ano + nv, 'já veio ordenado', o);

      const m = CM.memoria(ano, nv);
      if (m.pares.length !== 6) fail('memoria ' + ano + nv, 'pares != 6', m);
      const vs = m.pares.map((p) => p.v);
      if (new Set(vs).size !== vs.length) fail('memoria ' + ano + nv, 'valores repetidos', m);

      const c = CM.cruzadinha(ano, nv);
      for (let r = 0; r < c.size; r++) {
        if (c.grid[r].reduce((a, b) => a + b, 0) !== c.rowSums[r]) fail('cruzadinha ' + ano + nv, 'soma de linha errada', c);
      }
      for (let col = 0; col < c.size; col++) {
        let s2 = 0;
        for (let r = 0; r < c.size; r++) s2 += c.grid[r][col];
        if (s2 !== c.colSums[col]) fail('cruzadinha ' + ano + nv, 'soma de coluna errada', c);
      }
      const lacunas = Object.keys(c.respostas);
      if (!lacunas.length || lacunas.length >= c.size * c.size) fail('cruzadinha ' + ano + nv, 'lacunas', c);
      lacunas.forEach((p) => {
        const parts = p.split('-');
        if (c.respostas[p] !== c.grid[+parts[0]][+parts[1]]) fail('cruzadinha ' + ano + nv, 'resposta ≠ grid', c);
      });

      const b = CM.balanca(ano, nv);
      if (!b.frase || !b.alternativas || b.alternativas.length !== 4) fail('balanca ' + ano + nv, 'formato', b);
      const esquerda = b.frase.replace('___', String(b.valor));
      const semX = esquerda.replace(/[0-9.,]+$/, '').trim();
      void semX;
      if (new Set(b.alternativas).size !== 4) fail('balanca ' + ano + nv, 'alternativas repetidas', b);
      if (b.alternativas[0] !== b.resposta) fail('balanca ' + ano + nv, 'resposta não é alt[0]', b);

      if (i === 0 && ano >= 4) amostras['__jogos'] = amostras['__jogos'] || [];
      if (i === 0 && amostras['__jogos']) amostras['__jogos'].push(
        ano + '-' + nv + ' | seq ' + s.seq.join(', ') + ' → ' + s.resposta +
        ' | ord ' + o.pecas.map((p) => p.txt).join(',') +
        ' | bal ' + b.frase + ' → ' + b.resposta);
    }
  }
}

console.log('=== amostras por gerador ===');
Object.keys(amostras).forEach((k) => {
  if (k === '__jogos') return;
  console.log('\n## ' + k);
  amostras[k].slice(0, 3).forEach((l) => console.log('   ' + l));
});
console.log('\n=== jogos ===');
(amostras.__jogos || []).slice(0, 12).forEach((l) => console.log(l));
console.log('\n=== afirmações por família ===');
(amostras.__af || []).forEach((l) => console.log(l));

console.log('\n=== cobertura por ano e nível ===');
for (let ano = 1; ano <= 9; ano++) {
  for (let nv = 1; nv <= 4; nv++) {
    const chaves = CM.chavesDo(ano, nv);
    const uni = {};
    chaves.forEach((c) => {
      const it = CM.GER[c](ano, nv);
      if (it) uni[it.u] = (uni[it.u] || 0) + 1;
    });
    const nUni = Object.keys(uni).length;
    console.log(ano + 'º nv' + nv + ' | ' + chaves.join(', ') + ' | unidades: ' + nUni + ' ' + JSON.stringify(uni));
  }
}

console.log('\n=== resultado ===');
console.log('erros encontrados: ' + erros.length);
const grupos = {};
for (const e of erros) {
  const tipo = e.split('\n')[0].replace(/ ano \d+ nv \d+/, '');
  if (!grupos[tipo]) grupos[tipo] = { n: 0, exemplo: e.split('\n')[1] || '' };
  grupos[tipo].n++;
}
Object.keys(grupos)
  .sort((a, b) => grupos[b].n - grupos[a].n)
  .slice(0, 25)
  .forEach((g) => console.log(' - [' + grupos[g].n + 'x] ' + g + '\n     ' + grupos[g].exemplo));
process.exitCode = erros.length ? 1 : 0;
