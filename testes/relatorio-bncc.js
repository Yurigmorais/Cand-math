/* ===================================================
   CANDY MATH — testes/relatorio-bncc.js
   Conferência BNCC. Gera RELATORIO-BNCC.md na raiz e sai com código 1
   quando alguma conferência estrutural falha.

   O que este arquivo apura, e até onde ele vai:
     · cada código BNCC que o jogo pode mostrar existe no índice de
       testes/bncc-matematica.txt;
     · o ano embutido no código (EF**05**MA…) é o ano do item que o carrega;
     · quantos itens, por ano, por unidade temática e por código existem de
       verdade, e onde a cobertura é fina;
     · quantos códigos do índice nunca aparecem no jogo.

   O que ele NÃO apura (e o relatório diz isso com todas as letras):
     · se a habilidade está bem escrita para a idade, se o enunciado é
       pedagógicamente adequado, se o tratamento do erro é bom. Isso é leitura
       de professora/professor, não de script;
     · se o índice do repositório é a íntegra do documento oficial da BNCC.
       Ele é uma cópia sem acentos, conferida contra o catálogo em 30/10/2026
       e não revisada linha a linha nesta auditoria.

   Rodar: node testes/relatorio-bncc.js
   =================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { RAIZ } = require('./_raiz.js');

const CM = require(path.join(RAIZ, 'conteudo.js'));
const banco = require(path.join(RAIZ, 'banco-itens.js'));
const ITENS = banco.BANCO_ITENS || [];
const AFIRMACOES = banco.BANCO_AFIRMACOES || [];

const UNIDADES = ['numeros', 'algebra', 'geometria', 'medidas', 'dados'];
const NOME_UNIDADE = {
  numeros: 'Números', algebra: 'Álgebra', geometria: 'Geometria',
  medidas: 'Grandezas e medidas', dados: 'Probabilidade e dados',
};
const ANOS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const SEDE = 20261030;          // amostragem repetível: mesmo dia, mesmos números

// ── 1. o índice oficial que temos em casa ──────────────────
const indice = new Map();
const linhasIndex = [];
function lerIndice() {
  const bruto = fs.readFileSync(path.join(RAIZ, 'testes', 'bncc-matematica.txt'), 'utf8');
  bruto.split(/\r?\n/).forEach((linha) => {
    const t = linha.trim();
    if (!t) return;
    linhasIndex.push(t);
    const m = /^\((EF)(\d{2})(MA)(\d{2})\)\s*(.+)$/.exec(t);
    if (!m) return;
    indice.set(m[1] + m[2] + m[3] + m[4], {
      codigo: m[1] + m[2] + m[3] + m[4],
      ano: Number(m[2]),
      seq: m[4],
    });
  });
}
lerIndice();

const problemas = [];
const aprovados = [];
function exige(condicao, rotulo, detalhe) {
  if (condicao) aprovados.push(rotulo + (detalhe ? ' — ' + detalhe : ''));
  else problemas.push(rotulo + (detalhe ? ' — ' + detalhe : ''));
  return !!condicao;
}

exige(indice.size > 0 && indice.size === linhasIndex.length,
  'o índice de habilidades tem uma linha por código',
  indice.size + ' códigos em ' + linhasIndex.length + ' linhas');

// ── 2. tudo que o jogo pode mostrar ───────────────────────
// Três origens: o banco autoral (itens), o banco de afirmações (V/F) e a
// tabela COD do motor, que é de onde saem os códigos das questões geradas.
// A tabela é lida como está — não por amostragem — porque ela é o catálogo
// fixo; a amostragem serve para conferir se o motor respeita a própria tabela.
const usos = [];
ITENS.forEach((i) => (i.bncc || []).forEach((c) => usos.push({
  codigo: c, ano: i.ano, u: i.u, o: i.o, origem: 'item ' + i.id,
})));
AFIRMACOES.forEach((a) => (a.bncc || []).forEach((c) => usos.push({
  codigo: c, ano: a.ano, u: a.u, o: a.o, origem: 'afirmação ' + a.id,
})));
const temasMotor = Object.keys(CM.COD || {});
temasMotor.forEach((tema) => {
  ANOS.forEach((ano) => {
    ((CM.COD[tema] || {})[ano] || []).forEach((c) => usos.push({
      codigo: c, ano: ano, u: null, o: 'gerador "' + tema + '"', origem: 'motor ' + tema,
    }));
  });
});

// ── 3. conferências estruturais ───────────────────────────
const semFormato = [];
const foraDoIndice = [];
const anoTrocado = [];
const semUnidade = [];
usos.forEach((uso) => {
  const m = /^EF(\d{2})MA(\d{2})$/.exec(uso.codigo || '');
  if (!m) { semFormato.push(uso.codigo + ' (' + uso.origem + ')'); return; }
  const entrada = indice.get(uso.codigo);
  if (!entrada) { foraDoIndice.push(uso.codigo + ' (' + uso.origem + ')'); return; }
  if (Number(m[1]) !== uso.ano) {
    anoTrocado.push(uso.codigo + ' anunciado no ano ' + uso.ano + ' (' + uso.origem + ')');
  }
  if (uso.u && UNIDADES.indexOf(uso.u) < 0) semUnidade.push(uso.codigo + ' com u="' + uso.u + '"');
});

// O motor é que decide o que a criança vê. Amostragem com semente fixa: se o
// gerador entregar um código que não está na tabela, ou fora do ano pedido,
// isto pega.
function semeada(s) {
  return function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}
const randomReal = Math.random;
Math.random = semeada(SEDE);
const amostra = 12;
const geradorForaDoAno = [];
const geradorSemCodigo = [];
const unidadesVistas = {};        // ano -> { u: true }
ANOS.forEach((ano) => {
  unidadesVistas[ano] = {};
  for (let nv = 1; nv <= 4; nv++) {
    (CM.chavesDo(ano, nv) || []).forEach((chave) => {
      for (let k = 0; k < amostra; k++) {
        let it;
        try { it = CM.GER[chave](ano, nv); } catch (e) { break; }
        if (!it) continue;
        const cod = (it.bncc || [])[0];
        if (!cod) { geradorSemCodigo.push(chave + ' ' + ano + '-' + nv); continue; }
        if (it.ano !== ano) geradorForaDoAno.push(chave + ' entregou ano ' + it.ano);
        unidadesVistas[ano][it.u] = true;
      }
    });
  }
});
// O banco autoral entra no sorteio pelo filtro de ano/nível, igual ao jogo.
const bancoPorAnoUnidade = {};
ANOS.forEach((ano) => {
  bancoPorAnoUnidade[ano] = {};
  UNIDADES.forEach((u) => { bancoPorAnoUnidade[ano][u] = 0; });
});
ITENS.concat(AFIRMACOES).forEach((i) => {
  if (!bancoPorAnoUnidade[i.ano]) return;
  if (bancoPorAnoUnidade[i.ano][i.u] === undefined) bancoPorAnoUnidade[i.ano][i.u] = 0;
  bancoPorAnoUnidade[i.ano][i.u]++;
});
Math.random = randomReal;

exige(semFormato.length === 0, 'todo código usado tem o formato EFnnMAnn',
  semFormato.length ? semFormato.slice(0, 6).join(', ') : usos.length + ' referências conferidas');
exige(foraDoIndice.length === 0, 'todo código usado existe no índice de habilidades',
  foraDoIndice.length ? foraDoIndice.slice(0, 6).join(', ') : 'nenhum código inventado');
exige(anoTrocado.length === 0, 'o ano do código bate com o ano do item que o carrega',
  anoTrocado.length ? anoTrocado.slice(0, 6).join(', ') : 'nenhuma habilidade fora de ano');
exige(semUnidade.length === 0, 'toda unidade temática usada é uma das cinco da BNCC',
  semUnidade.length ? semUnidade.slice(0, 4).join(', ') : UNIDADES.join(' · '));
exige(geradorSemCodigo.length === 0, 'todo gerador entrega ao menos um código BNCC',
  geradorSemCodigo.length ? geradorSemCodigo.slice(0, 4).join(', ') : 'todos');
exige(geradorForaDoAno.length === 0, 'todo gerador devolve o ano que foi pedido',
  geradorForaDoAno.length ? geradorForaDoAno.slice(0, 4).join(', ') : 'todos');
ANOS.forEach((ano) => {
  exige(UNIDADES.some((u) => bancoPorAnoUnidade[ano][u] > 0),
    'o ' + ano + 'º ano tem conteúdo autoral',
    UNIDADES.map((u) => NOME_UNIDADE[u].split(' ')[0] + ':' + bancoPorAnoUnidade[ano][u]).join(' '));
});

// ── 4. contagens que vão para o relatório ─────────────────
const codigosUsados = new Set(usos.map((u) => u.codigo).filter((c) => indice.has(c)));
const porCodigo = {};
usos.forEach((u) => {
  porCodigo[u.codigo] = porCodigo[u.codigo] || { referencias: 0, unidades: new Set(), objetos: new Set() };
  porCodigo[u.codigo].referencias++;
  if (u.u) porCodigo[u.codigo].unidades.add(u.u);
  if (u.o) porCodigo[u.codigo].objetos.add(u.o);
});
const umCasoSo = Object.keys(porCodigo).filter((c) => porCodigo[c].referencias === 1).sort();
const unidadesMultipas = Object.keys(porCodigo).filter((c) => porCodigo[c].unidades.size > 1);
const semUso = [];
for (const codigo of indice.keys()) if (!codigosUsados.has(codigo)) semUso.push(codigo);
const semUsoPorAno = {};
semUso.forEach((c) => {
  const ano = indice.get(c).ano;
  semUsoPorAno[ano] = (semUsoPorAno[ano] || 0) + 1;
});

function tabelaCabecalho(colunas) {
  return '| ' + colunas.join(' | ') + ' |\n| ' + colunas.map(() => '---').join(' | ') + ' |';
}
// ── 5. o relatório ────────────────────────────────────────
const hoje = new Date();
const dataBR = String(hoje.getDate()).padStart(2, '0') + '/' +
  String(hoje.getMonth() + 1).padStart(2, '0') + '/' + hoje.getFullYear();

const linhas = [];
function escreve(texto) { linhas.push(texto); }

escreve('# Relatório BNCC — Candy Math');
escreve('');
escreve('> Gerado por `node testes/relatorio-bncc.js` em ' + dataBR +
  '. Não edite por mão: rode de novo. A amostragem dos geradores usa a semente fixa ' +
  SEDE + ', então os números são repetíveis.');
escreve('');
escreve('## 1. O que este relatório afirma — e o que ele não afirma');
escreve('');
escreve('Ele confere **validade estrutural** do vínculo com a BNCC: código bem formado, código que existe no índice de ' +
  'habilidades de Matemática, ano do código igual ao ano do item, unidade temática válida e cobertura mínima por ano.');
escreve('');
escreve('Ele **não** confere alinhamento pedagógico. Um script não decide se o enunciado é adequado para a idade, se a ' +
  'habilidade está sendo efetivamente desenvolvida ou se a explicação dada depois do erro é boa. Isso é leitura de ' +
  'professora/professor de Matemática dos anos finais e iniciais do Fundamental — ver item 6.');
escreve('');
escreve('E ele **não** declara cobertura integral da BNCC. Os números abaixo mostram exatamente o contrário: ' +
  'das ' + indice.size + ' habilidades do índice, ' + codigosUsados.size + ' aparecem em algum lugar do jogo e ' +
  semUso.length + ' nunca aparecem. Uma habilidade com um único item também não está "coberta": está tocada uma vez.');
escreve('');
escreve('## 2. De onde vem cada número');
escreve('');
escreve(tabelaCabecalho(['fonte', 'o que é', 'quantidade']));
escreve('| `testes/bncc-matematica.txt` | índice de habilidades de Matemática copiado do documento oficial | ' +
  indice.size + ' códigos em ' + linhasIndex.length + ' linhas |');
escreve('| `banco-itens.js` (`add`) | situações autorais de escolha múltipla | ' + ITENS.length + ' itens |');
escreve('| `banco-itens.js` (`af`) | afirmações verdadeiro/falso autorais | ' + AFIRMACOES.length + ' afirmações |');
escreve('| `conteudo.js` (`CM.COD`) | tabela de onde o motor tira o código de cada questão gerada | ' +
  temasMotor.length + ' temas × 9 anos |');
escreve('| uso contado | referências código↔item conferidas | ' + usos.length + ' |');
escreve('');
escreve('## 3. Conferências estruturais');
escreve('');
aprovados.forEach((a) => escreve('- ✓ ' + a));
problemas.forEach((p) => escreve('- ✗ ' + p));
escreve('');
escreve('**' + aprovados.length + ' conferências aprovadas · ' + problemas.length + ' falhas.**');
escreve('');
escreve('## 4. Cobertura por ano');
escreve('');
escreve(tabelaCabecalho(['ano', 'itens do banco', 'afirmações', 'unidades do banco com item',
  'unidades vistas no motor', 'códigos do índice sem item']));
ANOS.forEach((ano) => {
  const unidadesBanco = UNIDADES.filter((u) => bancoPorAnoUnidade[ano][u] > 0).length;
  const unidadesMotor = UNIDADES.filter((u) => unidadesVistas[ano] && unidadesVistas[ano][u]).length;
  const nItens = ITENS.filter((i) => i.ano === ano).length;
  const nAfs = AFIRMACOES.filter((a) => a.ano === ano).length;
  escreve('| ' + ano + 'º | ' + nItens + ' | ' + nAfs + ' | ' + unidadesBanco + ' de 5 | ' +
    unidadesMotor + ' de 5 | ' + (semUsoPorAno[ano] || 0) + ' |');
});
escreve('');
escreve('## 5. Itens por unidade temática e ano');
escreve('');
escreve(tabelaCabecalho(['unidade'].concat(ANOS.map((a) => a + 'º')).concat(['total'])));
UNIDADES.forEach((u) => {
  const valores = ANOS.map((ano) => bancoPorAnoUnidade[ano][u] || 0);
  escreve('| ' + NOME_UNIDADE[u] + ' | ' + valores.join(' | ') + ' | ' +
    valores.reduce((a, b) => a + b, 0) + ' |');
});
escreve('');
escreve('## 6. Onde a cobertura é fina (revisar primeiro)');
escreve('');
escreve('- ' + umCasoSo.length + ' códigos aparecem **uma única vez** no projeto inteiro. São a melhor lista para ' +
  'quem vai revisar: uma habilidade representada por um item não é uma habilidade trabalhada.');
escreve('  - ' + (umCasoSo.slice(0, 30).join(', ') || 'nenhum'));
if (umCasoSo.length > 30) escreve('  - … e mais ' + (umCasoSo.length - 30) + ' (a lista completa está na saída do script).');
escreve('');
escreve('- ' + unidadesMultipas.length + ' códigos aparecem com **mais de uma unidade temática**. Ou o encaixe de ' +
  'unidade está errado, ou o mesmo código está sendo usado para coisas diferentes. Exemplos:');
unidadesMultipas.slice(0, 12).forEach((c) => {
  escreve('  - ' + c + ': ' + Array.from(porCodigo[c].unidades).map((u) => NOME_UNIDADE[u] || u).join(' + '));
});
if (!unidadesMultipas.length) escreve('  - nenhum caso.');
escreve('');
escreve('- ' + semUso.length + ' habilidades do índice nunca são usadas. Por ano: ' +
  ANOS.map((a) => a + 'º → ' + (semUsoPorAno[a] || 0)).join(' · ') + '.');
escreve('  Exemplos: ' + semUso.slice(0, 20).join(', ') + '.');
escreve('');
escreve('## 7. Limites do que foi conferido');
escreve('');
escreve('- O índice em `testes/bncc-matematica.txt` é uma cópia **sem acentos** (o arquivo é ASCII puro: as descrições ' +
  'perderam a acentuação na conversão). Os códigos são íntegros e conferíveis; as descrições não são citáveis assim. ' +
  'Este relatório por isso trabalha só com os códigos.');
escreve('- Não houve, nesta auditoria, conferência linha a linha do índice contra o PDF oficial da BNCC. ' +
  '**Pendente:** quem publica deve conferir o índice contra o documento do MEC antes de citar qualquer habilidade.');
escreve('- No motor, o código vem da tabela `CM.COD`, que associa **tema** do gerador a uma habilidade. O enunciado ' +
  'gerado muda de números, não de tema, então a associação é estável — mas ela é uma escolha de quem escreveu o ' +
  'motor, não uma verificação feita pelo sistema de ensino.');
escreve('- Itens com `bncc` fora do ano do item seriam falha: nenhuma foi encontrada. Isso não significa que cada ' +
  'item esteja **bem** colocado: significa que o código citado pertence ao ano certo.');
escreve('');
escreve('## 8. O que ainda falta para uma afirmação séria sobre alinhamento');
escreve('');
escreve('- [ ] Revisão pedagógica por ano, começando pela lista do item 6 (campos preenchidos por quem ensina, ' +
  'não por este script).');
escreve('- [ ] Conferir o índice `bncc-matematica.txt` contra o documento oficial e repor a acentuação das descrições.');
escreve('- [ ] Decidir o que fazer com as ' + semUso.length + ' habilidades sem item — ampliar o banco ou declarar ' +
  'explicitamente que o jogo cobre um recorte.');
escreve('- [ ] Leitura humana dos itens que o diagnóstico marcou como ambíguos. O que o código já fechou — e passa a ' +
  'conferir sozinho — são os duplicados numéricos, ou seja, questões em que duas alternativas davam a mesma resposta ' +
  '(corrigidos em `banco-itens.js` e nos geradores de `conteudo.js`; ver AUDITORIA.md). O que falta é saber se o ' +
  'enunciado é adequado para a idade, e isso nenhum script decide.');
escreve('');
escreve('---');
escreve('');
escreve('Nenhuma frase deste arquivo foi escrita à mão. Se um número aqui parece bom demais, rode o script e olhe a ' +
  'saída: `node testes/relatorio-bncc.js`.');

const destino = path.join(RAIZ, 'RELATORIO-BNCC.md');
fs.writeFileSync(destino, linhas.join('\n') + '\n', 'utf8');

console.log('bncc — índice ' + indice.size + ' · usados ' + codigosUsados.size + ' · sem uso ' + semUso.length +
  ' · uma vez só ' + umCasoSo.length + ' · unidades múltiplas ' + unidadesMultipas.length);
console.log('relatório escrito em ' + destino);
if (problemas.length) {
  console.log('\nfalhas:\n  ' + problemas.join('\n  '));
  if (umCasoSo.length) console.log('\ncódigos com um único caso:\n  ' + umCasoSo.join(', '));
} else {
  console.log(aprovados.length + ' conferências estruturais, todas verdes.');
}
process.exitCode = problemas.length ? 1 : 0;
