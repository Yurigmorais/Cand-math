/* =========================================================
   CONTEÚDO — motor de itens do Candy Math
   Monta as questões a partir do ano (1º ao 9º) e do nível
   (1 a 4), seguindo as unidades temáticas e os objetos de
   conhecimento da BNCC. Não usa DOM: o mesmo arquivo serve ao
   jogo e à validação automática em Node.
   ========================================================= */
(function (root) {
'use strict';

// ── aleatoriedade ────────────────────────────────────────
const ri = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const rf = (min, max) => Math.random() * (max - min) + min;
const d1 = (arr) => arr[ri(0, arr.length - 1)];

function embaralhar(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = ri(0, i);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function arred(v, casas) {
  const f = Math.pow(10, casas || 0);
  return Math.round(v * f) / f;
}
function mdc(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = b; b = a % b; a = t; }
  return a;
}
function mmc(a, b) { return Math.abs(a) / mdc(a, b) * Math.abs(b); }
function divisores(n) {
  const out = [];
  for (let i = 1; i <= n; i++) if (n % i === 0) out.push(i);
  return out;
}
function irredutivel(n, d) {
  const k = mdc(n, d) || 1;
  return [n / k, d / k];
}

// ── escrita numérica em português ────────────────────────
const fmt = {
  int(v) {
    const s = Math.abs(Math.trunc(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (v < 0 ? '-' : '') + s;
  },
  dec(v, casas) {
    casas = casas == null ? 2 : casas;
    const sinal = v < 0 ? '-' : '';
    let s = Math.abs(v).toFixed(casas);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return sinal + s.replace('.', ',');
  },
  num(v, casas) {
    casas = casas == null ? 2 : casas;
    const r = arred(v, casas);
    return Number.isInteger(r) ? fmt.int(r) : fmt.dec(r, casas);
  },
  moeda(v) { return 'R$ ' + arred(v, 2).toFixed(2).replace('.', ','); },
  pct(v) { return fmt.num(v, 1) + '%'; },
  frac(n, d) { return n + '/' + d; },
  un(v, unid, casas) { return fmt.num(v, casas) + ' ' + unid; },
  ang(v) { return fmt.num(v, 1) + '°'; }
};

// ── códigos da BNCC por tema e ano ───────────────────────
const COD = {
  'adi':      { 1: ['EF01MA08'], 2: ['EF02MA06'], 3: ['EF03MA06'], 4: ['EF04MA03'], 5: ['EF05MA07'], 6: ['EF06MA10'], 7: ['EF07MA12'], 8: ['EF08MA06'], 9: ['EF09MA03'] },
  'sub':      { 1: ['EF01MA08'], 2: ['EF02MA06'], 3: ['EF03MA06'], 4: ['EF04MA03'], 5: ['EF05MA07'], 6: ['EF06MA10'], 7: ['EF07MA12'], 8: ['EF08MA06'], 9: ['EF09MA03'] },
  'mist':     { 1: ['EF01MA08'], 2: ['EF02MA06'], 3: ['EF03MA06'], 4: ['EF04MA03'], 5: ['EF05MA07'], 6: ['EF06MA03'], 7: ['EF07MA12'], 8: ['EF08MA06'], 9: ['EF09MA03'] },
  'inverso':  { 1: ['EF01MA06'], 2: ['EF02MA05'], 3: ['EF03MA11'], 4: ['EF04MA04'], 5: ['EF05MA10'], 6: ['EF06MA14'], 7: ['EF07MA18'], 8: ['EF08MA08'], 9: ['EF09MA09'] },
  'mult':     { 1: ['EF01MA06'], 2: ['EF02MA07'], 3: ['EF03MA07'], 4: ['EF04MA06'], 5: ['EF05MA08'], 6: ['EF06MA11'], 7: ['EF07MA11'], 8: ['EF08MA06'], 9: ['EF09MA03'] },
  'div':      { 1: ['EF01MA06'], 2: ['EF02MA07'], 3: ['EF03MA08'], 4: ['EF04MA07'], 5: ['EF05MA08'], 6: ['EF06MA11'], 7: ['EF07MA11'], 8: ['EF08MA06'], 9: ['EF09MA03'] },
  'dobro':    { 1: ['EF01MA02'], 2: ['EF02MA08'], 3: ['EF03MA07'], 4: ['EF04MA06'], 5: ['EF05MA06'], 6: ['EF06MA09'], 7: ['EF07MA09'], 8: ['EF08MA04'], 9: ['EF09MA05'] },
  'posic':    { 1: ['EF01MA07'], 2: ['EF02MA04'], 3: ['EF03MA02'], 4: ['EF04MA02'], 5: ['EF05MA01'], 6: ['EF06MA02'], 7: ['EF07MA10'], 8: ['EF08MA01'], 9: ['EF09MA04'] },
  'comparar': { 1: ['EF01MA05'], 2: ['EF02MA01'], 3: ['EF03MA01'], 4: ['EF04MA01'], 5: ['EF05MA01'], 6: ['EF06MA01'], 7: ['EF07MA03'], 8: ['EF08MA05'], 9: ['EF09MA02'] },
  'estim':    { 1: ['EF01MA03'], 2: ['EF02MA02'], 3: ['EF03MA01'], 4: ['EF04MA01'], 5: ['EF05MA01'], 6: ['EF06MA12'], 7: ['EF07MA10'], 8: ['EF08MA01'], 9: ['EF09MA04'] },
  'dinheiro': { 1: ['EF01MA19'], 2: ['EF02MA20'], 3: ['EF03MA24'], 4: ['EF04MA25'], 5: ['EF05MA07'], 6: ['EF06MA11'], 7: ['EF07MA02'], 8: ['EF08MA04'], 9: ['EF09MA05'] },
  'dec':      { 1: ['EF01MA06'], 2: ['EF02MA05'], 3: ['EF03MA05'], 4: ['EF04MA10'], 5: ['EF05MA02'], 6: ['EF06MA10'], 7: ['EF07MA12'], 8: ['EF08MA05'], 9: ['EF09MA03'] },
  'frac':     { 1: ['EF01MA07'], 2: ['EF02MA08'], 3: ['EF03MA11'], 4: ['EF04MA09'], 5: ['EF05MA03'], 6: ['EF06MA07'], 7: ['EF07MA08'], 8: ['EF08MA05'], 9: ['EF09MA03'] },
  'porct':    { 1: ['EF01MA19'], 2: ['EF02MA20'], 3: ['EF03MA24'], 4: ['EF04MA25'], 5: ['EF05MA06'], 6: ['EF06MA13'], 7: ['EF07MA02'], 8: ['EF08MA04'], 9: ['EF09MA05'] },
  'neg':      { 1: ['EF01MA05'], 2: ['EF02MA01'], 3: ['EF03MA04'], 4: ['EF04MA12'], 5: ['EF05MA11'], 6: ['EF06MA01'], 7: ['EF07MA04'], 8: ['EF08MA06'], 9: ['EF09MA03'] },
  'expr':     { 1: ['EF01MA06'], 2: ['EF02MA05'], 3: ['EF03MA05'], 4: ['EF04MA05'], 5: ['EF05MA11'], 6: ['EF06MA03'], 7: ['EF07MA05'], 8: ['EF08MA06'], 9: ['EF09MA09'] },
  'iguald':   { 1: ['EF01MA06'], 2: ['EF02MA05'], 3: ['EF03MA11'], 4: ['EF04MA15'], 5: ['EF05MA11'], 6: ['EF06MA14'], 7: ['EF07MA18'], 8: ['EF08MA08'], 9: ['EF09MA09'] },
  'eq':       { 7: ['EF07MA18'], 8: ['EF08MA08'], 9: ['EF09MA09'] },
  'sistema':  { 8: ['EF08MA09'], 9: ['EF09MA09'] },
  'razao':    { 5: ['EF05MA12'], 6: ['EF06MA13'], 7: ['EF07MA17'], 8: ['EF08MA13'], 9: ['EF09MA08'] },
  'pot':      { 6: ['EF06MA11'], 7: ['EF07MA11'], 8: ['EF08MA01'], 9: ['EF09MA03'] },
  'rad':      { 8: ['EF08MA02'], 9: ['EF09MA03'] },
  'cient':    { 8: ['EF08MA01'], 9: ['EF09MA04'] },
  'primos':   { 4: ['EF04MA12'], 5: ['EF05MA08'], 6: ['EF06MA05'], 7: ['EF07MA01'], 8: ['EF08MA01'], 9: ['EF09MA03'] },
  'mdcmmc':   { 7: ['EF07MA01'], 8: ['EF08MA09'], 9: ['EF09MA09'] },
  'perim':    { 3: ['EF03MA21'], 4: ['EF04MA20'], 5: ['EF05MA20'], 6: ['EF06MA29'], 7: ['EF07MA32'], 8: ['EF08MA19'], 9: ['EF09MA19'] },
  'area':     { 4: ['EF04MA21'], 5: ['EF05MA19'], 6: ['EF06MA29'], 7: ['EF07MA31'], 8: ['EF08MA19'], 9: ['EF09MA19'] },
  'vol':      { 5: ['EF05MA21'], 6: ['EF06MA24'], 7: ['EF07MA30'], 8: ['EF08MA21'], 9: ['EF09MA19'] },
  'unid':     { 2: ['EF02MA16'], 3: ['EF03MA19'], 4: ['EF04MA20'], 5: ['EF05MA19'], 6: ['EF06MA24'], 7: ['EF07MA29'], 8: ['EF08MA20'], 9: ['EF09MA18'] },
  'tempo':    { 2: ['EF02MA19'], 3: ['EF03MA23'], 4: ['EF04MA22'], 5: ['EF05MA19'], 6: ['EF06MA24'], 7: ['EF07MA29'], 8: ['EF08MA20'], 9: ['EF09MA18'] },
  'temp':     { 4: ['EF04MA23'], 5: ['EF05MA19'], 6: ['EF06MA24'], 7: ['EF07MA29'], 8: ['EF08MA20'], 9: ['EF09MA02'] },
  'angul':    { 4: ['EF04MA18'], 5: ['EF05MA17'], 6: ['EF06MA26'], 7: ['EF07MA23'], 8: ['EF08MA17'], 9: ['EF09MA10'] },
  'triang':   { 3: ['EF03MA15'], 5: ['EF05MA17'], 6: ['EF06MA19'], 7: ['EF07MA24'], 8: ['EF08MA14'], 9: ['EF09MA12'] },
  'polig':    { 5: ['EF05MA17'], 6: ['EF06MA18'], 7: ['EF07MA27'], 8: ['EF08MA14'], 9: ['EF09MA11'] },
  'plano':    { 5: ['EF05MA14'], 6: ['EF06MA16'], 7: ['EF07MA20'], 8: ['EF08MA07'], 9: ['EF09MA16'] },
  'media':    { 5: ['EF05MA24'], 6: ['EF06MA31'], 7: ['EF07MA35'], 8: ['EF08MA25'], 9: ['EF09MA21'] },
  'moda':     { 5: ['EF05MA24'], 6: ['EF06MA31'], 7: ['EF07MA36'], 8: ['EF08MA25'], 9: ['EF09MA22'] },
  'prob':     { 1: ['EF01MA20'], 2: ['EF02MA21'], 3: ['EF03MA25'], 4: ['EF04MA26'], 5: ['EF05MA22'], 6: ['EF06MA30'], 7: ['EF07MA34'], 8: ['EF08MA22'], 9: ['EF09MA20'] },
  'pitag':    { 8: ['EF08MA19'], 9: ['EF09MA13'] },
  'trig':     { 9: ['EF09MA14'] },
  'func':     { 7: ['EF07MA13'], 8: ['EF08MA07'], 9: ['EF09MA06'] },
  'seq':      { 1: ['EF01MA10'], 2: ['EF02MA09'], 3: ['EF03MA10'], 4: ['EF04MA11'], 5: ['EF05MA02'], 6: ['EF06MA06'], 7: ['EF07MA15'], 8: ['EF08MA10'], 9: ['EF09MA06'] },
  'ordem':    { 1: ['EF01MA05'], 2: ['EF02MA01'], 3: ['EF03MA01'], 4: ['EF04MA01'], 5: ['EF05MA05'], 6: ['EF06MA01'], 7: ['EF07MA03'], 8: ['EF08MA05'], 9: ['EF09MA02'] },
  'memoria':  { 1: ['EF01MA06'], 2: ['EF02MA05'], 3: ['EF03MA03'], 4: ['EF04MA05'], 5: ['EF05MA07'], 6: ['EF06MA03'], 7: ['EF07MA05'], 8: ['EF08MA06'], 9: ['EF09MA03'] },
  'cruz':     { 1: ['EF01MA07'], 2: ['EF02MA04'], 3: ['EF03MA11'], 4: ['EF04MA15'], 5: ['EF05MA10'], 6: ['EF06MA14'], 7: ['EF07MA13'], 8: ['EF08MA06'], 9: ['EF09MA09'] }
};
function cod(tema, ano) {
  const t = COD[tema];
  if (!t) return [];
  return t[clampAno(ano)] || t[9] || t[1] || [];
}

// ── textos de apoio ──────────────────────────────────────
const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabriela', 'Helena', 'Igor',
               'Joana', 'Larissa', 'Marcos', 'Nina', 'Otávio', 'Paula', 'Rafael', 'Sofia', 'Tiago',
               'Vera', 'Wesley'];
const nome = () => d1(NOMES);
const NOMES_F = ['Ana', 'Carla', 'Elisa', 'Gabriela', 'Helena', 'Joana', 'Larissa', 'Nina', 'Paula', 'Sofia', 'Vera', 'Lúcia'];
const NOMES_M = ['Bruno', 'Diego', 'Fábio', 'Igor', 'Marcos', 'Otávio', 'Rafael', 'Tiago', 'Wesley', 'Léo', 'Vitor', 'André'];
// nome + pronome concordando, para os enunciados que usam "ele/ela"
function alguem() {
  const f = Math.random() < 0.5;
  return { n: d1(f ? NOMES_F : NOMES_M), p: f ? 'ela' : 'ele' };
}

// erros de cálculo que as crianças realmente cometem
function erroSemLevar(a, b) {
  const sa = String(a), sb = String(b).padStart(String(a).length, '0');
  let out = '';
  for (let i = 0; i < sa.length; i++) out += String((+sa[i] + +sb[i]) % 10);
  return +out;
}
function erroMaiorMenor(a, b) {
  const sa = String(a), sb = String(b).padStart(String(a).length, '0');
  let out = '';
  for (let i = 0; i < sa.length; i++) out += String(Math.abs(+sa[i] - +sb[i]));
  return +out;
}
// evita divisão "4 ÷ 2" em ano que já trabalha dividendo maior
function divisorQuociente(f, totalMin) {
  let d = ri(f[0][0], f[0][1]);
  let q = ri(f[1][0], f[1][1]);
  for (let t = 0; t < 14 && d * q < totalMin; t++) {
    d = ri(Math.max(3, f[0][0]), Math.max(4, f[0][1]));
    q = ri(Math.max(4, f[1][0]), Math.max(5, f[1][1]));
  }
  return [d, q];
}

// ── quanto vale uma alternativa? ─────────────────────────
// Duas alternativas que dizem o mesmo número — 2/12 e 1/6, 45 × 10⁶ e
// 4,5 × 10⁷ — viram pegadinha: a criança acertou o valor e mesmo assim
// leva "errado", porque só uma delas está marcada como certa. Por isso a
// comparação de alternativas olha o número, não o texto. Quando a opção não
// é um número puro (ordenações, "x = 7 e x = -7"), volta null e quem decide
// é a comparação literal.
const SUPERSCRIPTO = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
const RE_SUPER = /[⁰¹²³⁴⁵⁶⁷⁸⁹]/g;
const semSuper = (txt) => txt.replace(RE_SUPER, (c) => SUPERSCRIPTO[c]);

// Unidade escrita sem espaço e sem acento: "m²" vira "m2", "  kg " vira "kg".
// Sequência que não é letra, número, %, ° ou º não é unidade: é texto solto.
function unidadeDe(txt) {
  const un = txt.replace(/[\s.]/g, '').replace(RE_SUPER, (c) => SUPERSCRIPTO[c]).toLowerCase();
  return /^[a-z0-9%ªº°/]*$/.test(un) ? un : null;
}

/* Lê "3/4", "25%", "R$ 12,50", "40 m²", "2,5 × 10⁴" e devolve {v, un}. */
function valorOpcao(txt) {
  let s = String(txt).trim().replace(/\s+/g, ' ');
  const moeda = /^R\$\s*/.test(s);
  s = s.replace(/^R\$\s*/, '').replace(/\s*R\$$/, '').trim();
  if (!s) return null;

  let m = /^(-?\d+(?:,\d+)?)\s*(?:×|x|\*)\s*10\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/.exec(s);
  if (m) return { v: parseFloat(m[1].replace(',', '.')) * Math.pow(10, parseInt(semSuper(m[2]), 10)), un: moeda ? 'rs' : '' };
  m = /^10\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/.exec(s);
  if (m) return { v: Math.pow(10, parseInt(semSuper(m[1]), 10)), un: moeda ? 'rs' : '' };
  m = /^(-?\d+)\s*\/\s*(\d+)$/.exec(s);
  if (m) return { v: Number(m[1]) / Number(m[2]), un: moeda ? 'rs' : '' };
  if (moeda) {
    m = /^(-?\d+(?:,\d{1,2})?)$/.exec(s);
    return m ? { v: parseFloat(m[1].replace(',', '.')), un: 'rs' } : null;
  }

  m = /^(-?\d+(?:[.,]\d+)*)\s*(.*)$/.exec(s);
  if (!m) return null;
  const un = unidadeDe(m[2] || '');
  if (un === null) return null;
  const num = m[1];
  let bruto = num;
  if (num.indexOf(',') >= 0) bruto = num.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(num)) bruto = num.replace(/\./g, '');
  else if ((num.match(/\./g) || []).length > 1) return null;
  const v = parseFloat(bruto);
  if (!isFinite(v)) return null;
  return un === '%' ? { v: v / 100, un: '%' } : { v: v, un: un };
}

function mesmaOpcao(a, b) {
  const va = valorOpcao(a), vb = valorOpcao(b);
  if (!va || !vb) return String(a).trim() === String(b).trim();
  return va.un === vb.un && Math.abs(va.v - vb.v) < 1e-9;
}

// Monta as 4 alternativas: alt[0] é sempre a resposta certa.
function opcoes(info, r, candidatos, texto, cfg) {
  cfg = cfg || {};
  const casas = cfg.casas == null ? 0 : cfg.casas;
  const tol = Math.pow(10, -casas) / 2;
  const aceitos = [];
  const pode = (v) => {
    if (v == null || !isFinite(v)) return false;
    if (Math.abs(v - r) <= tol) return false;
    if (cfg.inteiro && Math.abs(v - Math.round(v)) > 1e-9) return false;
    if (cfg.min != null && v < cfg.min) return false;
    if (cfg.max != null && v > cfg.max) return false;
    return aceitos.every((x) => Math.abs(x - v) > tol);
  };
  for (let i = 0; i < candidatos.length && aceitos.length < 3; i++) {
    if (pode(candidatos[i])) aceitos.push(candidatos[i]);
  }
  const passo = Math.pow(10, -casas);
  const mag = Math.max(1, Math.pow(10, Math.floor(Math.log10(Math.abs(r) || 1))));
  const reserva = [passo, -passo, 2 * passo, -2 * passo, mag / 10, -mag / 10, mag / 2, -mag / 2, mag, -mag, 3 * passo, -3 * passo];
  for (let i = 0; i < reserva.length && aceitos.length < 3; i++) {
    const v = arred(r + reserva[i], Math.max(casas, 2));
    if (pode(v)) aceitos.push(v);
  }
  return Object.assign({}, info, { alt: [texto(r)].concat(embaralhar(aceitos.map(texto))), valor: r });
}

// Alguns geradores conhecem a estrutura dos números que criaram e podem
// oferecer uma representação em doces. É dado, não desenho: a interface
// decide como desenhar. Quando os números são grandes demais para o desenho
// fazer sentido, o item simplesmente vem sem visual.
function comVisual(item, visual) {
  if (visual) item.visual = visual;
  return item;
}

// Item cuja resposta já é texto (fração, par ordenado, classificação).
// Os candidatos vêm embaralhados: sem isso, um gerador com oito candidatos
// mostraria sempre os três primeiros e o resto da lista seria enfeite.
function itemTexto(info, certa, erradas) {
  const unicas = [];
  for (const e of embaralhar(erradas)) {
    if (mesmaOpcao(e, certa)) continue;
    if (unicas.some((u) => mesmaOpcao(u, e))) continue;
    unicas.push(e);
  }
  let k = 1;
  while (unicas.length < 3) { unicas.push(certa + ' (opção ' + k + ')'); k++; }
  return Object.assign({}, info, { alt: [certa].concat(embaralhar(unicas.slice(0, 3))) });
}

// ── perfis de dificuldade: 4 faixas por ano ──────────────
const PERFIS = {
  1: {
    nome: '1º ano',
    adicao:    [[2, 6], [2, 10], [3, 15], [4, 20]],
    subtracao: [[4, 8], [5, 12], [6, 17], [10, 20]],
    mult:  [[[1, 3], [1, 3]], [[2, 4], [1, 4]], [[2, 5], [2, 5]], [[2, 5], [3, 5]]],
    divis: null,
    casas: [0, 0, 0, 0],
    chaves: [
      ['adi', 'sub', 'comparar', 'dobro'],
      ['adi', 'sub', 'comparar', 'posicional'],
      ['adi', 'sub', 'dobro', 'estimativa'],
      ['adi', 'sub', 'inverso', 'posicional', 'comparar']
    ]
  },
  2: {
    nome: '2º ano',
    adicao:    [[5, 40], [10, 60], [20, 80], [30, 99]],
    subtracao: [[10, 50], [20, 70], [30, 90], [40, 99]],
    mult:  [[[2, 5], [2, 5]], [[2, 5], [2, 9]], [[3, 10], [2, 10]], [[4, 10], [3, 10]]],
    divis: null,
    casas: [0, 0, 0, 0],
    chaves: [
      ['adi', 'sub', 'comparar', 'mult'],
      ['adi', 'sub', 'mult', 'posicional'],
      ['mist', 'mult', 'dinheiro', 'estimativa'],
      ['mist', 'mult', 'inverso', 'dinheiro', 'tempo']
    ]
  },
  3: {
    nome: '3º ano',
    adicao:    [[10, 300], [20, 600], [50, 999], [100, 999]],
    subtracao: [[20, 400], [50, 700], [80, 999], [100, 999]],
    mult:  [[[2, 10], [2, 10]], [[3, 10], [2, 12]], [[4, 12], [3, 15]], [[6, 20], [4, 25]]],
    divis: [[[2, 5], [2, 10]], [[2, 8], [2, 12]], [[2, 10], [4, 20]], [[3, 10], [5, 30]]],
    casas: [0, 0, 0, 2],
    chaves: [
      ['adi', 'sub', 'mult', 'div'],
      ['mist', 'mult', 'divResto', 'perim'],
      ['adi', 'sub', 'div', 'dinheiro', 'dobro'],
      ['mist', 'divResto', 'inverso', 'iguald', 'tempo']
    ]
  },
  4: {
    nome: '4º ano',
    adicao:    [[50, 2000], [100, 5000], [200, 9000], [500, 10000]],
    subtracao: [[100, 3000], [200, 6000], [400, 9000], [500, 10000]],
    mult:  [[[10, 30], [2, 9]], [[10, 40], [3, 12]], [[20, 90], [4, 15]], [[100, 400], [2, 9]]],
    divis: [[[2, 9], [10, 60]], [[2, 12], [10, 90]], [[10, 25], [3, 20]], [[11, 30], [5, 40]]],
    casas: [2, 2, 2, 2],
    chaves: [
      ['adi', 'sub', 'mult', 'div'],
      ['mist', 'divResto', 'decAdi', 'area'],
      ['expr', 'decAdi', 'fracQuant', 'tempo'],
      ['mist', 'expr', 'iguald', 'tipoAngulo', 'fracEquiv', 'temperatura']
    ]
  },
  5: {
    nome: '5º ano',
    adicao:    [[100, 20000], [200, 50000], [500, 99000], [1000, 99000]],
    subtracao: [[200, 30000], [400, 60000], [500, 90000], [1000, 99000]],
    mult:  [[[10, 60], [10, 30]], [[20, 90], [10, 40]], [[100, 300], [3, 25]], [[100, 500], [10, 45]]],
    divis: [[[10, 30], [10, 90]], [[12, 45], [10, 120]], [[15, 60], [8, 90]], [[21, 90], [12, 150]]],
    casas: [2, 2, 2, 3],
    chaves: [
      ['adi', 'sub', 'mult', 'div', 'perim'],
      ['decOps', 'fracEquiv', 'porct', 'area'],
      ['mist', 'decOps', 'fracQuant', 'vol', 'unid', 'tipoAngulo'],
      ['expr', 'porct', 'fracComp', 'prob', 'tempo', 'media', 'primos']
    ]
  },
  6: {
    nome: '6º ano',
    adicao:    [[100, 50000], [500, 90000], [1000, 99000], [2000, 999000]],
    subtracao: [[200, 60000], [500, 90000], [1000, 500000], [2000, 999000]],
    mult:  [[[20, 90], [10, 60]], [[100, 400], [10, 50]], [[150, 800], [6, 40]], [[250, 999], [12, 60]]],
    divis: [[[12, 60], [12, 200]], [[15, 90], [10, 250]], [[21, 120], [12, 300]], [[25, 240], [16, 400]]],
    casas: [2, 2, 3, 3],
    chaves: [
      ['mult', 'div', 'porct', 'primos'],
      ['decOps', 'fracQuant', 'porct', 'plano', 'perim'],
      ['mist', 'expr', 'unid', 'tipoAngulo', 'prob', 'vol'],
      ['expr', 'fracSoma', 'razao', 'pot10', 'mediaMediana', 'areaTri']
    ]
  },
  7: {
    nome: '7º ano',
    adicao:    [[1000, 90000], [2000, 300000], [5000, 800000], [10000, 999000]],
    subtracao: [[1000, 90000], [2000, 300000], [5000, 800000], [10000, 999000]],
    mult:  [[[12, 60], [11, 45]], [[25, 150], [12, 60]], [[120, 600], [25, 90]], [[250, 999], [45, 250]]],
    divis: [[[18, 120], [24, 480]], [[25, 240], [16, 600]], [[125, 1728], [12, 96]], [[250, 9999], [24, 375]]],
    casas: [2, 2, 3, 3],
    chaves: [
      ['neg', 'fracSoma', 'porct', 'mdcmmc'],
      ['eq', 'neg', 'decOps', 'areaTri', 'tipoAngulo'],
      ['mist', 'razao', 'mdcmmc', 'vol', 'media'],
      ['expr', 'porctVaria', 'angul', 'triang', 'prob', 'mediaMediana']
    ]
  },
  8: {
    nome: '8º ano',
    adicao:    [[1000, 300000], [2000, 600000], [5000, 900000], [10000, 999000]],
    subtracao: [[1000, 300000], [2000, 600000], [5000, 900000], [10000, 999000]],
    mult:  [[[25, 150], [12, 60]], [[45, 300], [25, 90]], [[120, 800], [36, 125]], [[250, 999], [125, 400]]],
    divis: [[[24, 240], [16, 625]], [[36, 625], [24, 900]], [[144, 3600], [16, 250]], [[256, 9999], [32, 375]]],
    casas: [2, 2, 3, 3],
    chaves: [
      ['potencia', 'raiz', 'eq', 'porct'],
      ['sistema', 'potencia', 'dizima', 'areaTri', 'neg'],
      ['exprAlg', 'razao', 'notCient', 'mediaMediana', 'unid', 'polig'],
      ['eq', 'sistema', 'porctVaria', 'prob', 'volCilindro', 'moda', 'angul']
    ]
  },
  9: {
    nome: '9º ano',
    adicao:    [[1000, 500000], [2000, 800000], [5000, 990000], [10000, 999000]],
    subtracao: [[1000, 500000], [2000, 800000], [5000, 990000], [10000, 999000]],
    mult:  [[[45, 300], [25, 90]], [[120, 800], [36, 125]], [[250, 999], [125, 400]], [[1250, 9999], [36, 250]]],
    divis: [[[36, 625], [24, 900]], [[144, 3600], [16, 250]], [[256, 9999], [32, 375]], [[2401, 9999], [49, 225]]],
    casas: [2, 2, 3, 3],
    chaves: [
      ['potencia', 'pitag', 'eq', 'porctVaria'],
      ['func', 'pitag', 'dizima', 'notCient', 'raiz'],
      ['sistema', 'razao', 'trig', 'volCilindro', 'mediaMediana', 'polig'],
      ['exprAlg', 'porctVaria', 'pitag', 'prob', 'trig', 'irr', 'func']
    ]
  }
};

const NIVEIS = ['Base', 'Prática', 'Desafio', 'Domínio'];
const UNIDADES = {
  numeros: 'Números',
  algebra: 'Álgebra',
  geometria: 'Geometria',
  medidas: 'Grandezas e Medidas',
  dados: 'Probabilidade e Estatística'
};

function clampAno(a) { a = parseInt(a, 10); return isNaN(a) ? 5 : Math.min(9, Math.max(1, a)); }
function clampNv(n) { n = parseInt(n, 10); return isNaN(n) ? 1 : Math.min(4, Math.max(1, n)); }
function faixaDe(ano, nv, campo) {
  const f = PERFIS[clampAno(ano)][campo];
  return Array.isArray(f) ? f[clampNv(nv) - 1] : f;
}
function chavesDo(ano, nv) { return PERFIS[clampAno(ano)].chaves[clampNv(nv) - 1]; }
function escala(ano, nv) { return faixaDe(ano, nv, 'adicao')[1]; }
function escalaMax(ano, nv) {
  return Math.max(6, Math.min(30, Math.round(Math.sqrt(escala(ano, nv)))));
}

function info(ano, nv, u, o, tema, txt) {
  return { ano: clampAno(ano), nv: clampNv(nv), u: u, o: o, bncc: cod(tema, ano), txt: txt };
}

// ── geradores ────────────────────────────────────────────
const GER = {};

GER.adi = function (ano, nv) {
  const [minT, maxT] = faixaDe(ano, nv, 'adicao');
  let a = ri(Math.max(1, minT), maxT - 2);
  let b = ri(Math.max(1, minT - a > 0 ? minT - a : 1), Math.max(1, maxT - a));
  while (a + b < minT) { b++; }
  const r = a + b;
  const txt = d1([
    nome() + ' tinha ' + fmt.int(a) + ' figurinhas e colou mais ' + fmt.int(b) + ' no álbum. Com quantas figurinhas ficou?',
    'Uma padaria assou ' + fmt.int(a) + ' pães pela manhã e ' + fmt.int(b) + ' à tarde. Quantos pães foram assados no dia?',
    'Um ônibus saiu do ponto com ' + fmt.int(a) + ' passageiros e embarcou mais ' + fmt.int(b) + '. Quantos passageiros seguiram viagem?',
    'Na estante de uma biblioteca havia ' + fmt.int(a) + ' livros e chegaram mais ' + fmt.int(b) + ' doações. Quantos livros há agora?',
    'Duca juntou ' + fmt.int(a) + ' tampinhas em uma semana e ' + fmt.int(b) + ' na outra. Quantas tampinhas ele juntou?'
  ]);
  return opcoes(info(ano, nv, 'numeros', 'Adição com números naturais', 'adi', txt),
    r, [erroSemLevar(a, b), a - b, r + 1, r - 1, r + 10, r - 10],
    (v) => fmt.int(v), { inteiro: true, min: 0, max: maxT * 12 });
};

GER.sub = function (ano, nv) {
  const [minM, maxM] = faixaDe(ano, nv, 'subtracao');
  const a = ri(minM, maxM);
  const b = ri(Math.max(1, Math.floor(a * 0.2)), Math.max(1, Math.floor(a * 0.9)));
  const r = a - b;
  const q = alguem();
  const txt = d1([
    'Um tanque tinha ' + fmt.int(a) + ' litros de água. ' + fmt.int(b) + ' litros foram usados na limpeza do pátio. Quantos litros restaram?',
    q.n + ' tinha ' + fmt.int(a) + ' bolinhas de gude e perdeu ' + fmt.int(b) + ' em uma partida. Com quantas ' + q.p + ' ficou?',
    'Uma escola tem ' + fmt.int(a) + ' alunos matriculados e ' + fmt.int(b) + ' faltaram na segunda-feira. Quantos alunos compareceram?',
    'Um livro tem ' + fmt.int(a) + ' páginas e Lúcia já leu ' + fmt.int(b) + '. Quantas páginas faltam para ela terminar a leitura?',
    'Em um estacionamento havia ' + fmt.int(a) + ' carros e ' + fmt.int(b) + ' saíram ao meio-dia. Quantos carros permaneceram?'
  ]);
  return opcoes(info(ano, nv, 'numeros', 'Subtração com números naturais', 'sub', txt),
    r, [erroMaiorMenor(a, b), a + b, r + 1, r - 1, r + 10, a - b - 10],
    (v) => fmt.int(v), { inteiro: true, min: 0, max: maxM * 12 });
};

GER.mist = function (ano, nv) {
  const [, maxT] = faixaDe(ano, nv, 'adicao');
  const a = ri(Math.max(12, Math.floor(maxT * 0.2)), Math.floor(maxT * 0.6));
  const b = ri(Math.max(2, Math.floor(a * 0.2)), Math.max(3, Math.floor(a * 0.7)));
  const c = ri(Math.max(2, Math.floor((a - b) * 0.2)), Math.max(3, Math.floor((a - b) * 0.8)));
  const r = a - b + c;
  const quem = nome();
  const txt = d1([
    quem + ' tinha ' + fmt.int(a) + ' figurinhas, deu ' + fmt.int(b) + ' para o irmão e ganhou mais ' + fmt.int(c) + '. Com quantas ficou?',
    'Um ônibus saiu com ' + fmt.int(a) + ' passageiros. Desembarcaram ' + fmt.int(b) + ' e embarcaram ' + fmt.int(c) + '. Quantos passageiros seguiram no ônibus?',
    'Na loja havia ' + fmt.int(a) + ' camisetas. Foram vendidas ' + fmt.int(b) + ' e chegaram ' + fmt.int(c) + ' novas. Quantas camisetas há na loja agora?'
  ]);
  return opcoes(info(ano, nv, 'numeros', 'Problemas de adição e subtração em duas etapas', 'mist', txt),
    r, [a - b - c, a + b + c, a + b - c, r + c, r - c, r + 1],
    (v) => fmt.int(v), { inteiro: true, min: 0, max: maxT * 6 });
};

GER.inverso = function (ano, nv) {
  const [, maxT] = faixaDe(ano, nv, 'adicao');
  const r = ri(Math.max(6, Math.floor(maxT * 0.3)), maxT);
  const a = ri(2, r - 2);
  const b = r - a;
  const escondeA = Math.random() < 0.5;
  const txt = 'A soma de dois números é ' + fmt.int(r) + '. Um deles é ' + fmt.int(escondeA ? b : a) + '. Qual é o outro número?';
  return opcoes(info(ano, nv, 'numeros', 'Relação entre adição e subtração', 'inverso', txt),
    escondeA ? a : b, [r + a, r - a, r + 1, a + b + 1],
    (v) => fmt.int(v), { inteiro: true, min: 1, max: r * 4 });
};

GER.mult = function (ano, nv) {
  const f = faixaDe(ano, nv, 'mult');
  const a = ri(f[0][0], f[0][1]);
  const b = ri(f[1][0], f[1][1]);
  const r = a * b;
  const q = alguem();
  const txt = d1([
    'Em ' + fmt.int(a) + ' caixas há ' + fmt.int(b) + ' bombons em cada uma. Quantos bombons há no total?',
    'Um prédio tem ' + fmt.int(a) + ' andares com ' + fmt.int(b) + ' apartamentos em cada andar. Quantos apartamentos tem o prédio?',
    q.n + ' comprou ' + fmt.int(a) + ' pacotes com ' + fmt.int(b) + ' lápis de cor cada um. Quantos lápis ' + q.p + ' comprou?',
    'O salão da escola tem ' + fmt.int(a) + ' fileiras de ' + fmt.int(b) + ' cadeiras. Quantas cadeiras há no salão?',
    'Cada garrafa leva ' + fmt.int(b) + ' litros de suco concentrado. Quantos litros são necessários para encher ' + fmt.int(a) + ' garrafas?'
  ]);
  return comVisual(opcoes(info(ano, nv, 'numeros', 'Multiplicação com números naturais', 'mult', txt),
    r, [a + b, a * (b - 1), (a + 1) * b, r + a, r - b, r + b],
    (v) => fmt.int(v), { inteiro: true, min: 1, max: Math.max(r * 8, 100) }),
    a <= 10 && b <= 10 ? { tipo: 'grupos', grupos: a, cada: b } : null);
};

GER.div = function (ano, nv) {
  const f = faixaDe(ano, nv, 'divis');
  if (!f) return GER.mult(ano, nv);
  const par = divisorQuociente(f, ano >= 4 ? 120 : 24);
  const d = par[0], q = par[1], total = d * q;
  const txt = d1([
    fmt.int(total) + ' balas serão divididas igualmente entre ' + d + ' crianças. Quantas balas cada criança recebe?',
    'Um professor corrigiu ' + fmt.int(total) + ' provas em ' + d + ' horas, sempre a mesma quantidade por hora. Quantas provas ele corrigiu em cada hora?',
    fmt.int(total) + ' figurinhas foram distribuídas em ' + d + ' álbuns, com a mesma quantidade em cada um. Quantas figurinhas ficaram por álbum?',
    'A escola separou ' + fmt.int(total) + ' cadernos em ' + d + ' cestas iguais para doação. Quantos cadernos vão em cada cesta?'
  ]);
  return comVisual(opcoes(info(ano, nv, 'numeros', 'Divisão exata com números naturais', 'div', txt),
    q, [total - d, total + d, q + 1, q - 1, d, q * 2],
    (v) => fmt.int(v), { inteiro: true, min: 1, max: total + d }),
    d <= 10 && total <= 60 ? { tipo: 'repartir', total: total, partes: d } : null);
};

GER.divResto = function (ano, nv) {
  const f = faixaDe(ano, nv, 'divis');
  if (!f) return GER.div(ano, nv);
  const par = divisorQuociente(f, ano >= 4 ? 120 : 24);
  const d = Math.max(2, par[0]);
  const q = par[1];
  const resto = ri(1, d - 1);
  const total = d * q + resto;
  const querQuociente = Math.random() < 0.55;
  const txt = querQuociente
    ? fmt.int(total) + ' rifas foram agrupadas em blocos de ' + d + ' rifas. Quantos blocos completos foram formados?'
    : fmt.int(total) + ' balas foram divididas igualmente entre ' + d + ' crianças e o que sobrou ficou na caixa. Quantas balas sobraram na caixa?';
  const r = querQuociente ? q : resto;
  const erradas = querQuociente ? [q + 1, q - 1, resto, d] : [q, resto + 1, d - resto, total - d];
  return opcoes(info(ano, nv, 'numeros', 'Divisão com resto', 'div', txt),
    r, erradas, (v) => fmt.int(v), { inteiro: true, min: 0, max: total });
};

GER.dobro = function (ano, nv) {
  const [, maxT] = faixaDe(ano, nv, 'adicao');
  const pequeno = ano <= 2;
  const modo = pequeno ? ri(0, 1) : ri(0, 3);
  const passo = pequeno ? 2 : 6;
  const limite = pequeno ? maxT / 2 : maxT / 3;
  const a = passo * ri(1, Math.max(2, Math.floor(limite / passo)));
  const r = [2 * a, a / 2, 3 * a, a / 3][modo];
  const rotulo = ['o dobro', 'a metade', 'o triplo', 'a terça parte'][modo];
  const objeto = d1(['bombons', 'figurinhas', 'pacotes de biscoito', 'litros de suco']);
  const txt = 'Uma caixa tem ' + fmt.int(a) + ' ' + objeto + '. Qual é ' + rotulo + ' dessa quantidade?';
  return opcoes(info(ano, nv, 'numeros', 'Dobro, metade, triplo e terça parte', 'dobro', txt),
    r, [2 * a, a / 2, 3 * a, a / 3, a + 1, a - 1],
    (v) => fmt.int(v), { inteiro: true, min: 1, max: 3 * a + 6 });
};

GER.posicional = function (ano, nv) {
  const [, maxT] = faixaDe(ano, nv, 'adicao');
  const n = ri(Math.max(11, Math.floor(maxT * 0.25)), maxT);
  const alg = String(n);
  const idx = ri(0, alg.length - 1);
  const digito = +alg[idx];
  if (digito === 0) return GER.adi(ano, nv);
  const ordem = alg.length - idx;
  const r = digito * Math.pow(10, ordem - 1);
  const nomeOrdem = ['', 'unidades', 'dezenas', 'centenas', 'unidades de milhar'][ordem] || 'ordem';
  const txt = 'No número ' + fmt.int(n) + ', o algarismo ' + digito + ' ocupa a ordem das ' + nomeOrdem +
              '. Qual é o valor que esse algarismo representa?';
  return opcoes(info(ano, nv, 'numeros', 'Valor posicional e decomposição do número', 'posic', txt),
    r, [digito, digito * 10, r * 10, r / 10, n - r], (v) => fmt.int(v), { inteiro: true, min: 1, max: n * 12 });
};

GER.comparar = function (ano, nv) {
  const [, maxT] = faixaDe(ano, nv, 'adicao');
  const a = ri(1, maxT);
  let b = ri(1, maxT);
  while (b === a) b = ri(1, maxT);
  const mais = Math.max(a, b), menos = Math.min(a, b), r = mais - menos;
  const q1 = alguem();
  let q2 = alguem();
  while (q2.n === q1.n) q2 = alguem();
  const objeto = d1([
    { o: 'figurinhas', q: 'Quantas' },
    { o: 'cartões', q: 'Quantos' },
    { o: 'adesivos', q: 'Quantos' },
    { o: 'bolinhas de gude', q: 'Quantas' }
  ]);
  const txt = q1.n + ' tem ' + fmt.int(mais) + ' ' + objeto.o + ' e ' + q2.n + ' tem ' + fmt.int(menos) +
              '. ' + objeto.q + ' ' + objeto.o + ' ' + q1.n + ' tem a mais que ' + q2.n + '?';
  return opcoes(info(ano, nv, 'numeros', 'Comparação entre quantidades', 'comparar', txt),
    r, [mais + menos, menos, r + 1, r - 1], (v) => fmt.int(v), { inteiro: true, min: 1, max: mais + menos + 2 });
};

GER.estimativa = function (ano, nv) {
  const mag = ano <= 2 ? 10 : Math.pow(10, Math.max(1, Math.floor(Math.log10(escala(ano, nv)))));
  const fator = ano <= 2 ? d1([1, 2]) : ri(1, 9);
  const n = fator * mag + ri(1, mag - 1);
  const r = Math.round(n / mag) * mag;
  const txt = 'Arredonde ' + fmt.int(n) + ' para o múltiplo de ' + fmt.int(mag) + ' mais próximo.';
  return opcoes(info(ano, nv, 'numeros', 'Estimativa e arredondamento', 'estim', txt),
    r, [r + mag, r - mag, n, Math.floor(n / mag) * mag], (v) => fmt.int(v), { inteiro: true, min: mag });
};

GER.dinheiro = function (ano, nv) {
  const cen = ano <= 3 ? 0 : d1([0, 0.5, 0.9, 0.99]);
  const preco = (v) => Math.floor(v) + cen;
  const teto = ano <= 3 ? 12 : ano <= 5 ? 40 : 90;
  let a = 0, b = 0, paga = 0;
  for (let t = 0; t < 24; t++) {
    a = preco(rf(3, teto));
    b = preco(rf(2, a * 0.7));
    const total = arred(a + b, 2);
    const notas = [10, 20, 50, 100, 200].filter((n) => n > total);
    if (notas.length) { paga = ano <= 3 ? notas[0] : d1(notas.slice(0, 2)); break; }
  }
  if (!paga) return GER.dinheiro(ano, nv);
  const r = arred(paga - a - b, 2);
  const txt = nome() + ' pagou ' + fmt.moeda(a) + ' em um lanche e ' + fmt.moeda(b) +
              ' em um suco. Entregou uma nota de ' + fmt.moeda(paga) + '. Quanto recebeu de troco?';
  return opcoes(info(ano, nv, 'medidas', 'Sistema monetário: cálculo de troco', 'dinheiro', txt),
    r, [arred(a + b, 2), arred(paga - a, 2), arred(r + 1, 2), arred(Math.abs(r - 2), 2)],
    (v) => fmt.moeda(v), { min: 0, casas: 2 });
};

GER.decAdi = function (ano, nv) {
  const casas = Math.max(1, PERFIS[ano].casas[nv - 1]);
  const lim = ano <= 4 ? 40 : 300;
  const a = arred(rf(1, lim), casas);
  const b = arred(rf(0.5, lim * 0.6), casas);
  const r = arred(a + b, casas);
  const c = d1([
    { u: 'km', n: 'quilômetros',
      s: 'Na primeira etapa de uma viagem o ônibus rodou ' + fmt.un(a, 'km', casas) +
         ' e na segunda, ' + fmt.un(b, 'km', casas) + '.' },
    { u: 'kg', n: 'quilos',
      s: 'Uma saca de farinha pesa ' + fmt.un(a, 'kg', casas) + ' e uma saca de açúcar, ' +
         fmt.un(b, 'kg', casas) + '.' },
    { u: 'L', n: 'litros',
      s: 'Uma cisterna recebeu ' + fmt.un(a, 'L', casas) + ' de água pela manhã e ' +
         fmt.un(b, 'L', casas) + ' à tarde.' },
    { u: 'm', n: 'metros',
      s: 'Ana cortou ' + fmt.un(a, 'm', casas) + ' de fita azul e ' + fmt.un(b, 'm', casas) +
         ' de fita vermelha para enfeitar a sala.' }
  ]);
  const txt = c.s + ' Quantos ' + c.n + ' são ao todo?';
  return opcoes(info(ano, nv, 'numeros', 'Adição com números decimais', 'dec', txt),
    r, [arred(Math.abs(a - b), casas), arred(r + Math.pow(10, -casas), casas), arred(r - Math.pow(10, -casas), casas), arred(a + b + 1, casas)],
    (v) => fmt.un(v, c.u, casas), { casas, min: 0 });
};

GER.decOps = function (ano, nv) {
  const casas = PERFIS[ano].casas[nv - 1] || 2;
  const soma = Math.random() < 0.5;
  const a = arred(rf(2, 60), casas);
  const b = arred(rf(0.5, Math.max(1, a * 0.9)), casas);
  const r = soma ? arred(a + b, casas) : arred(a - b, casas);
  const txt = 'Quanto é ' + fmt.num(a, casas) + (soma ? ' + ' : ' - ') + fmt.num(b, casas) + '?';
  return opcoes(info(ano, nv, 'numeros', 'Adição e subtração com decimais: alinhamento da vírgula', 'dec', txt),
    r, [arred(a + b, casas), arred(a - b, casas), arred(r + Math.pow(10, -casas), casas), arred(r - Math.pow(10, -casas), casas), arred(r * 10, casas), arred(r / 10, casas)],
    (v) => fmt.num(v, casas), { casas, min: -9999 });
};

GER.fracEquiv = function (ano, nv) {
  const d = d1([2, 3, 4, 5, 6, 8, 10]);
  const n = ri(1, d - 1);
  const k = ri(2, 6);
  const certa = fmt.frac(n * k, d * k);
  const txt = 'Qual fração é equivalente a ' + fmt.frac(n, d) + '?';
  return itemTexto(info(ano, nv, 'numeros', 'Frações equivalentes', 'frac', txt),
    certa, [fmt.frac(n * k + k, d * k), fmt.frac(n * (k + 1), d * k), fmt.frac(n * k, d * k + 1),
            fmt.frac(n + k, d + k), fmt.frac(n, d * k), fmt.frac(n * k, d)]);
};

GER.fracQuant = function (ano, nv) {
  const d = d1([2, 3, 4, 5, 6, 8, 10]);
  const n = ri(1, d - 1);
  const total = d * ri(2, Math.max(3, Math.min(30, Math.floor(escala(ano, nv) / d / 5))));
  const r = total / d * n;
  const objetos = d1([
    { intro: 'Uma caixa tem ', o: 'bombons', q: 'Quantos', ref: 'dessa caixa' },
    { intro: 'Um envelope tem ', o: 'figurinhas', q: 'Quantas', ref: 'desse envelope' },
    { intro: 'Um estojo tem ', o: 'lápis', q: 'Quantos', ref: 'desse estojo' },
    { intro: 'Uma garrafa tem ', o: 'litros de suco', q: 'Quantos', ref: 'dessa garrafa' },
    { intro: 'Um caderno tem ', o: 'páginas', q: 'Quantas', ref: 'desse caderno' }
  ]);
  const txt = objetos.intro + fmt.int(total) + ' ' + objetos.o + '. ' + objetos.q + ' ' + objetos.o +
              ' existem em ' + fmt.frac(n, d) + ' ' + objetos.ref + '?';
  return comVisual(opcoes(info(ano, nv, 'numeros', 'Fração de uma quantidade', 'frac', txt),
    r, [total / d, total - r, total / n, r + 1, r * 2], (v) => fmt.int(v), { inteiro: true, min: 1, max: total }),
    { tipo: 'barra', numerador: n, denominador: d, total: total });
};

GER.fracComp = function (ano, nv) {
  const d = d1([4, 5, 6, 8, 10, 12]);
  const n1 = ri(1, d - 1);
  let n2 = ri(1, d - 1);
  while (n2 === n1) n2 = ri(1, d - 1);
  const maior = Math.max(n1, n2);
  const txt = 'Qual é a maior fração?';
  return itemTexto(info(ano, nv, 'numeros', 'Comparação de frações com o mesmo denominador', 'frac', txt),
    fmt.frac(maior, d), [fmt.frac(Math.min(n1, n2), d), fmt.frac(maior, d + 1), fmt.frac(maior + 1, d + 1)]);
};

GER.fracSoma = function (ano, nv) {
  const d = d1([2, 3, 4, 5, 6, 8, 10]);
  const k = ri(0, 2);
  const d2 = d * (k + 1);
  const a = ri(1, d - 1) * (k + 1);
  const b = ri(1, d2 - 1);
  const soma = Math.random() < 0.55;
  let x = a, y = b, num;
  if (soma) {
    num = x + y;
  } else {
    if (y > x) { const t = x; x = y; y = t; }
    if (x === y) x = Math.min(d2, x + 1);
    num = x - y;
  }
  const [ni, di] = irredutivel(num, d2);
  const txt = 'Quanto é ' + fmt.frac(x, d2) + (soma ? ' + ' : ' - ') + fmt.frac(y, d2) + '?';
  return itemTexto(info(ano, nv, 'numeros', 'Adição e subtração de frações de mesmo denominador', 'frac', txt),
    di === 1 ? fmt.int(ni) : fmt.frac(ni, di),
    [fmt.frac(num, d2 + d2), fmt.frac(num + 1, d2), fmt.frac(num, d2 * (k + 2)), fmt.frac(Math.max(1, num - 1), d2),
     fmt.frac(num, d2 + 1), fmt.frac(num + d2, d2), fmt.frac(Math.max(1, num - 2), d2)]);
};

GER.porct = function (ano, nv) {
  const rotas = ano <= 5 ? [10, 25, 50, 75] : [5, 10, 15, 20, 25, 30, 40, 60, 75];
  const p = d1(rotas);
  const total = d1([40, 60, 80, 120, 150, 200, 240, 300, 400, 600]) * (ano >= 7 ? ri(1, 12) : 1);
  const parte = arred(total * p / 100, 2);
  const modo = ri(0, 2);
  let txt, r;
  if (modo === 0) {
    r = parte;
    txt = 'Quanto é ' + p + '% de ' + fmt.int(total) + '?';
  } else if (modo === 1) {
    r = arred(total - parte, 2);
    txt = 'Uma loja deu ' + p + '% de desconto em um produto que custava ' + fmt.moeda(total) +
          '. Quanto o cliente pagou?';
  } else {
    r = parte;
    txt = 'Em uma pesquisa com ' + fmt.int(total) + ' pessoas, ' + p + '% responderam que preferem ônibus a carro.' +
          ' Quantas pessoas escolheram o ônibus?';
  }
  return comVisual(opcoes(info(ano, nv, 'algebra', 'Porcentagem', 'porct', txt),
    r, [parte, arred(total * (p + 5) / 100, 2), arred(parte / 10, 2), arred(parte * 10, 2), arred(total - parte, 2)],
    (v) => (modo === 1 ? fmt.moeda(v) : Number.isInteger(v) ? fmt.int(v) : fmt.num(v, 2)),
    { min: 0, max: total * 2, casas: 2 }),
    { tipo: 'malha', pct: p, total: total, rotulo: modo === 1 ? 'o desconto' : 'a parte pedida' });
};

GER.porctVaria = function (ano, nv) {
  const p = d1([10, 15, 20, 25, 30, 40, 60]);
  const total = d1([50, 80, 120, 150, 240, 320, 450, 600]) * (ano >= 8 ? ri(1, 8) : 1);
  const alta = Math.random() < 0.5;
  const r = arred(total * (alta ? 1 + p / 100 : 1 - p / 100), 2);
  const txt = 'Um artigo custava ' + fmt.moeda(total) + ' e sofreu ' + (alta ? 'um aumento' : 'um desconto') +
              ' de ' + p + '%. Qual passou a ser o preço do artigo?';
  return opcoes(info(ano, nv, 'algebra', 'Acréscimos e decréscimos sucessivos', 'porct', txt),
    r, [arred(total * p / 100, 2), arred(total * (alta ? 1 - p / 100 : 1 + p / 100), 2), arred(total + p, 2), total],
    (v) => fmt.moeda(v), { min: 0, casas: 2 });
};

GER.neg = function (ano, nv) {
  const limite = [8, 15, 30, 50][nv - 1];
  const a = -ri(1, limite);
  const b = Math.random() < 0.5 ? -ri(1, limite) : ri(1, limite);
  const modo = ri(0, 2);
  const r = modo === 0 ? a + b : modo === 1 ? a - b : a * b;
  const sinal = modo === 0 ? '+' : modo === 1 ? '-' : '×';
  const txt = 'Quanto é (' + fmt.int(a) + ') ' + sinal + ' (' + fmt.int(b) + ')?';
  return opcoes(info(ano, nv, 'numeros', 'Operações com números inteiros negativos', 'neg', txt),
    r, [Math.abs(r), -r, a + b, a - b, a * b, r + 1, r - 1],
    (v) => fmt.int(v), { inteiro: true, min: -1e7, max: 1e7 });
};

GER.expr = function (ano, nv) {
  const a = ri(2, 9), b = ri(2, 9), c = ri(2, 9);
  const sorteio = nv >= 3 ? ri(0, 2) : ri(0, 1);
  let txt, r, erro;
  if (sorteio === 0) {
    r = (a + b) * c; erro = a + b * c;
    txt = 'Quanto é (' + a + ' + ' + b + ') × ' + c + '?';
  } else if (sorteio === 1) {
    r = a + b * c; erro = (a + b) * c;
    txt = 'Quanto é ' + a + ' + ' + b + ' × ' + c + '?';
  } else {
    r = Math.round((a * b - c) / 1); erro = a * (b - c);
    txt = 'Quanto é ' + a + ' × ' + b + ' - ' + c + '?';
  }
  return opcoes(info(ano, nv, 'algebra', 'Expressões numéricas e ordem das operações', 'expr', txt),
    r, [erro, r + 1, r - 1, r * 2, Math.round(r / 2)], (v) => fmt.int(v), { inteiro: true });
};

GER.exprAlg = function (ano, nv) {
  const a = ri(2, 6);
  const x = ri(1, [4, 6, 9, 12][nv - 1]);
  const b = ri(1, 12);
  const r = a * a * Math.pow(x, 2) - 2 * a * b * x + Math.pow(b, 2);
  const txt = 'Qual é o valor numérico de (a·x - ' + b + ')² quando a = ' + a + ', x = ' + x + ' e b = ' + b + '?';
  return opcoes(info(ano, nv, 'algebra', 'Valor numérico de expressão algébrica e produtos notáveis', 'func', txt),
    r, [Math.pow(a * x - b, 2) + 1, a * a * x * x - b * b, Math.pow(a * x, 2) - b, r + a * x],
    (v) => fmt.int(v), { inteiro: true, min: 0 });
};

GER.iguald = function (ano, nv) {
  const [, maxT] = faixaDe(ano, nv, 'adicao');
  const a = ri(2, Math.max(3, Math.floor(maxT / 3)));
  const x = ri(2, Math.max(3, Math.floor(maxT / 3)));
  const txt = 'Qual número completa a igualdade para que ela seja verdadeira? ' +
              a + ' + ___ = ' + (a + x);
  return opcoes(info(ano, nv, 'algebra', 'Número desconhecido em uma igualdade', 'iguald', txt),
    x, [a + x, x + 1, a, x - 1], (v) => fmt.int(v), { inteiro: true, min: 1, max: a + x * 2 });
};

GER.eq = function (ano, nv) {
  const a = ri(2, [6, 9, 12, 15][nv - 1]);
  const x = ri(2, [9, 15, 20, 30][nv - 1]);
  const b = ri(1, 30);
  const c = a * x + b;
  const txt = 'Resolva a equação do 1º grau: ' + a + 'x + ' + b + ' = ' + c + '. Qual é o valor de x?';
  return opcoes(info(ano, nv, 'algebra', 'Equação polinomial do 1º grau', 'eq', txt),
    x, [(c + b) / a, Math.abs(b - c) / a, c - b, x + 1], (v) => fmt.num(v, 1), { min: -50, max: 500, casas: 1 });
};

GER.sistema = function (ano, nv) {
  const x = ri(1, 9), y = ri(1, 9);
  const carros = x, motos = y;
  const rodas = 4 * carros + 2 * motos;
  const txt = 'Em um estacionamento há só carros e motos. Ao todo são ' + (carros + motos) +
              ' veículos e ' + rodas + ' rodas. Quantos carros há?';
  return opcoes(info(ano, nv, 'algebra', 'Sistema de equações do 1º grau', 'sistema', txt),
    carros, [motos, carros + motos, Math.abs(rodas / 2 - (carros + motos)), carros + 1],
    (v) => fmt.int(v), { inteiro: true, min: 0, max: carros + motos + 2 });
};

GER.razao = function (ano, nv) {
  const k = ri(2, [4, 6, 8, 12][nv - 1]);
  const modo = ri(0, 2);
  if (modo === 0) {
    const porHora = ri(2, 12) * (ano >= 8 ? 5 : 1);
    const r = porHora * k;
    const txt = 'Uma impressora produz ' + porHora + ' folhetos por hora. Quantos folhetos ela produz em ' +
                k + ' horas, mantendo o mesmo ritmo?';
    return opcoes(info(ano, nv, 'algebra', 'Grandezas diretamente proporcionais', 'razao', txt),
      r, [r + porHora, r - porHora, arred(r / k, 1), porHora + k], (v) => fmt.num(v, 1), { min: 1, casas: 1 });
  }
  if (modo === 1) {
    const kmh = ri(4, 12) * 10;
    const r = kmh * k;
    const txt = 'Um carro mantém velocidade constante de ' + kmh + ' km/h. Quantos quilômetros ele percorre em ' +
                k + ' horas?';
    return opcoes(info(ano, nv, 'algebra', 'Velocidade média e proporcionalidade', 'razao', txt),
      r, [r + kmh, arred(r / k, 1), kmh + k, r * 2], (v) => fmt.int(v), { inteiro: true, min: 1 });
  }
  const unidades = ri(3, 12);
  const precoUn = ri(4, 25);
  const outras = unidades * k;
  const r = outras * precoUn;
  const txt = unidades + ' cadernos iguais custam ' + fmt.moeda(unidades * precoUn) +
              '. Quanto custam ' + outras + ' cadernos nesse mesmo preço?';
  return opcoes(info(ano, nv, 'algebra', 'Regra de três simples', 'razao', txt),
    r, [unidades * precoUn, arred(r / k, 2), r + precoUn, r * k], (v) => fmt.moeda(v), { min: 1, casas: 2 });
};

GER.potencia = function (ano, nv) {
  const b = ri(2, [4, 5, 6, 10][nv - 1]);
  const e = ri(2, [3, 3, 4, 5][nv - 1]);
  const r = Math.pow(b, e);
  const txt = 'Quanto é ' + b + sup(e) + ' (' + b + ' elevado a ' + e + ')?';
  return opcoes(info(ano, nv, 'numeros', 'Potências de expoente inteiro', 'pot', txt),
    r, [b * e, Math.pow(b, e - 1), Math.pow(b, e + 1), r + b], (v) => fmt.int(v), { inteiro: true, min: 1, max: r * 20 });
};

GER.pot10 = function (ano, nv) {
  const e = ri(2, [4, 5, 6, 7][nv - 1]);
  if (Math.random() < 0.5) {
    const r = Math.pow(10, e);
    const txt = 'Quanto é ' + expo10(e) + ' (10 elevado a ' + e + ')?';
    return opcoes(info(ano, nv, 'numeros', 'Potências de base 10', 'pot', txt),
      r, [10 * e, Math.pow(10, e - 1), Math.pow(10, e + 1), r + 10],
      (v) => fmt.int(v), { inteiro: true, min: 1, max: r * 20 });
  }
  const txt = 'Qual potência de base 10 representa o número ' + fmt.int(Math.pow(10, e)) + '?';
  return itemTexto(info(ano, nv, 'numeros', 'Potências de base 10', 'pot', txt),
    expo10(e), [expo10(e + 1), expo10(Math.max(1, e - 1)), '10 × ' + e]);
};

GER.raiz = function (ano, nv) {
  const x = ri(2, [9, 12, 15, 25][nv - 1]);
  const n = x * x;
  const txt = 'Quanto é a raiz quadrada de ' + fmt.int(n) + ' (√' + fmt.int(n) + ')?';
  return opcoes(info(ano, nv, 'numeros', 'Radiciação como operação inversa da potenciação', 'rad', txt),
    x, [x + 1, x - 1, n / 2, Math.pow(x, 3), x + 2], (v) => fmt.num(v, 1), { min: 1, max: n, casas: 1 });
};

GER.notCient = function (ano, nv) {
  const mant = arred(rf(1.2, 9.6), 2);
  const expo = ri(3, [4, 6, 8, 11][nv - 1]);
  const n = Math.round(mant * Math.pow(10, expo));
  const certo = fmt.dec(mant, 2) + ' × ' + expo10(expo);
  const txt = d1([
    'Escreva em notação científica o número ' + fmt.int(n) + '.',
    'O censo contou ' + fmt.int(n) + ' habitantes em um país. Como esse número fica em notação científica?',
    'Um arquivo digital ocupa ' + fmt.int(n) + ' bytes. Qual é a representação em notação científica?'
  ]);
  return itemTexto(info(ano, nv, 'numeros', 'Notação científica', 'cient', txt),
    certo,
    [fmt.dec(mant, 2) + ' × ' + expo10(expo + 1), fmt.dec(mant, 2) + ' × ' + expo10(expo - 1),
     fmt.dec(mant * 10, 1) + ' × ' + expo10(expo - 1), fmt.dec(mant, 2) + ' × ' + expo10(expo + 2)]);
};

GER.primos = function (ano, nv) {
  const certo = d1([17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97]);
  const erradas = embaralhar([15, 21, 25, 27, 33, 35, 39, 45, 49, 51, 55, 57, 63, 65, 77, 91]).slice(0, 3);
  const txt = 'Qual dos números a seguir é um número primo?';
  return itemTexto(info(ano, nv, 'numeros', 'Números primos e compostos', 'primos', txt),
    fmt.int(certo), erradas.map((v) => fmt.int(v)));
};

GER.mdcmmc = function (ano, nv) {
  const par = d1([[2, 3], [3, 4], [4, 5], [5, 6], [3, 5], [2, 5], [4, 7], [5, 8], [6, 7], [3, 8], [5, 9], [8, 9]]);
  const g = ri(2, [6, 12, 18, 24][nv - 1]);
  const a = g * par[0], b = g * par[1];
  const querMdc = Math.random() < 0.5;
  const r = querMdc ? g : g * par[0] * par[1];
  const txt = querMdc
    ? 'Qual é o maior número natural que divide ao mesmo tempo ' + a + ' e ' + b + ' (MDC)?'
    : 'Qual é o menor múltiplo comum de ' + a + ' e ' + b + ' (MMC)?';
  return opcoes(info(ano, nv, 'numeros', 'MDC e MMC', 'mdcmmc', txt),
    r, querMdc ? [b, a, par[0] * par[1], g * par[0] * par[1], g + 1] : [g, a + b, par[0] * par[1], a * b, r + g],
    (v) => fmt.int(v), { inteiro: true, min: 1, max: Math.max(a * b, r) + 10 });
};

GER.perim = function (ano, nv) {
  const topo = escalaMax(ano, nv);
  const a = ri(3, topo), b = ri(3, topo);
  const r = 2 * (a + b);
  const txt = 'Um terreno retangular mede ' + a + ' m de largura por ' + b + ' m de comprimento. Qual é o perímetro desse terreno?';
  return opcoes(info(ano, nv, 'medidas', 'Perímetro de retângulos', 'perim', txt),
    r, [a * b, a + b, 2 * a + b, r - 2], (v) => fmt.un(v, 'm'), { min: 1 });
};

GER.area = function (ano, nv) {
  const a = ri(2, [6, 10, 12, 20][nv - 1]);
  const b = ri(2, [6, 12, 15, 25][nv - 1]);
  const r = a * b;
  const txt = 'Uma sala retangular mede ' + a + ' m por ' + b + ' m. Qual é a área dessa sala?';
  return opcoes(info(ano, nv, 'medidas', 'Área de retângulos', 'area', txt),
    r, [2 * (a + b), a + b, r + a, r - b], (v) => fmt.un(v, 'm²'), { min: 1 });
};

GER.areaTri = function (ano, nv) {
  const b = ri(2, 20) * 2;
  const h = ri(3, [8, 12, 15, 20][nv - 1]);
  const r = b * h / 2;
  const txt = 'Um canteiro tem a forma de um triângulo com base de ' + b + ' cm e altura de ' + h +
              ' cm. Qual é a área desse canteiro?';
  return opcoes(info(ano, nv, 'medidas', 'Área do triângulo', 'area', txt),
    r, [b * h, b + h, r / 2, r * 2], (v) => fmt.un(v, 'cm²'), { min: 1 });
};

GER.vol = function (ano, nv) {
  const a = ri(2, [5, 8, 12, 15][nv - 1]);
  const b = ri(2, [5, 9, 12, 18][nv - 1]);
  const c = ri(2, [4, 6, 10, 12][nv - 1]);
  const r = a * b * c;
  const contar = ano <= 6;
  const txt = contar
    ? 'Uma caixa mede ' + a + ' cm de comprimento, ' + b + ' cm de largura e ' + c +
      ' cm de altura. Quantos cubinhos de 1 cm³ cabem exatamente dentro dela?'
    : 'Um paralelepípedo retângulo tem dimensões ' + a + ' cm × ' + b + ' cm × ' + c + ' cm. Qual é o seu volume?';
  return opcoes(info(ano, nv, 'medidas', 'Volume do bloco retangular', 'vol', txt),
    r, [a * b, (a + b + c) * 4, r * 2, 2 * (a * b + a * c + b * c)],
    contar ? (v) => fmt.int(v) : (v) => fmt.un(v, 'cm³'), { min: 1 });
};

GER.volCilindro = function (ano, nv) {
  const r = ri(2, 6), h = ri(5, 20);
  const txt = 'Um cilindro tem raio de ' + r + ' cm e altura de ' + h +
              ' cm. Usando π = 3,14, qual é o volume aproximado desse cilindro?';
  const comPi = arred(3.14 * r * r * h, 2);
  return opcoes(info(ano, nv, 'medidas', 'Volume do cilindro', 'vol', txt),
    comPi, [arred(2 * Math.PI * r * h, 2), arred(Math.PI * r * r, 2), arred(comPi / 2, 2), arred(comPi * 2, 2)],
    (v) => fmt.un(v, 'cm³', 2), { min: 1, casas: 2 });
};

GER.unid = function (ano, nv) {
  const pares = [
    { de: 'km', para: 'm', fator: 1000 },
    { de: 'm', para: 'cm', fator: 100 },
    { de: 'kg', para: 'g', fator: 1000 },
    { de: 'L', para: 'ml', fator: 1000 },
    { de: 'h', para: 'min', fator: 60 }
  ];
  const p = d1(pares);
  const q = ri(2, [5, 12, 25, 40][nv - 1]);
  const r = q * p.fator;
  const txt = 'Quanto é ' + q + ' ' + p.de + ' convertido em ' + p.para + '?';
  return opcoes(info(ano, nv, 'medidas', 'Conversão entre unidades de medida', 'unid', txt),
    r, [q * (p.fator / 10), q * p.fator * 10, q + p.fator, r / 2], (v) => fmt.un(v, p.para), { min: 1 });
};

GER.tempo = function (ano, nv) {
  const h = ano <= 3 ? ri(1, 2) : ri(1, 5);
  const m = d1(ano <= 3 ? [15, 30, 45] : [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
  const r = h * 60 + m;
  const txt = 'Uma sessão de cinema começou às 15h e durou ' + h + ' h ' + m + ' min. Quanto tempo durou, em minutos?';
  return opcoes(info(ano, nv, 'medidas', 'Medidas de tempo: horas e minutos', 'tempo', txt),
    r, [h * m, h * 60 + (60 - m), h + m, r + 60], (v) => fmt.un(v, 'min'), { min: 1 });
};

GER.temperatura = function (ano, nv) {
  const minima = ano <= 6 ? ri(2, 20) : ri(-8, 18);
  const amplitude = ri(3, 15);
  const maxima = minima + amplitude;
  const txt = 'A temperatura mínima de uma cidade foi de ' + fmt.int(minima) + ' °C e a máxima, de ' +
              fmt.int(maxima) + ' °C. Qual foi a amplitude térmica daquele dia?';
  return opcoes(info(ano, nv, 'medidas', 'Temperatura e amplitude térmica', 'temp', txt),
    amplitude, [maxima, minima, maxima - 2 * amplitude, Math.abs(minima)], (v) => fmt.un(v, '°C'), { min: 1 });
};

GER.angul = function (ano, nv) {
  const modo = nv <= 2 ? ri(0, 1) : ri(0, 2);
  if (modo === 0) {
    const a = ri(25, 89);
    const txt = 'Dois ângulos são complementares, ou seja, juntos formam 90°. Se um deles mede ' + a +
                '°, quanto mede o outro?';
    return opcoes(info(ano, nv, 'geometria', 'Ângulos complementares', 'angul', txt),
      90 - a, [a, 180 - a, 90 + a, 360 - a], (v) => fmt.ang(v), { min: 1 });
  }
  if (modo === 1) {
    const a = ri(95, 170);
    const txt = 'Dois ângulos são suplementares, ou seja, juntos formam 180°. Se um deles mede ' + a +
                '°, quanto mede o outro?';
    return opcoes(info(ano, nv, 'geometria', 'Ângulos suplementares', 'angul', txt),
      180 - a, [a, 90 - a, 360 - a, 180 + a], (v) => fmt.ang(v), { min: 1 });
  }
  const a = ri(30, 78), b = ri(30, 78);
  const txt = 'Em um triângulo, dois ângulos internos medem ' + a + '° e ' + b +
              '°. Quanto mede o terceiro ângulo interno?';
  return opcoes(info(ano, nv, 'geometria', 'Soma dos ângulos internos do triângulo', 'triang', txt),
    180 - a - b, [a + b, 360 - a - b, 180 + a, 90], (v) => fmt.ang(v), { min: 1 });
};

const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
function sup(n) { return String(n).split('').map((c) => SUP[c]).join(''); }
function expo10(e) { return '10' + sup(e); }

GER.tipoAngulo = function (ano, nv) {
  if (Math.random() < 0.55) {
    const a = d1([ri(20, 85), 90, ri(95, 175)]);
    const tipo = a < 90 ? 'Agudo' : a === 90 ? 'Reto' : 'Obtuso';
    const txt = 'Um ângulo mede ' + a + '°. Como ele é classificado quanto à medida?';
    return itemTexto(info(ano, nv, 'geometria', 'Classificação de ângulos: agudo, reto e obtuso', 'angul', txt),
      tipo, ['Agudo', 'Reto', 'Obtuso', 'Raso'].filter((t) => t !== tipo));
  }
  const tipo = d1(['agudo', 'reto', 'obtuso']);
  let certa, erradas;
  if (tipo === 'agudo') { certa = ri(25, 85); erradas = [90, ri(95, 170), 180]; }
  else if (tipo === 'reto') { certa = 90; erradas = [ri(25, 85), ri(95, 170), 180]; }
  else { certa = ri(95, 170); erradas = [ri(25, 85), 90, 180]; }
  const txt = 'Qual das medidas a seguir representa um ângulo ' + tipo + '?';
  return itemTexto(info(ano, nv, 'geometria', 'Classificação de ângulos: agudo, reto e obtuso', 'angul', txt),
    fmt.ang(certa), erradas.map((v) => fmt.ang(v)));
};

GER.triang = function (ano, nv) {
  const t = d1([[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17], [7, 24, 25]]);
  const txt = 'Um triângulo tem lados medindo ' + t[0] + ' cm, ' + t[1] + ' cm e ' + t[2] +
              ' cm. Como ele é classificado quanto aos ângulos?';
  return itemTexto(info(ano, nv, 'geometria', 'Classificação de triângulos', 'triang', txt),
    'Retângulo', ['Acutângulo', 'Obtusângulo', 'Equilátero']);
};

GER.polig = function (ano, nv) {
  const lados = ri(5, 12);
  const r = (lados - 2) * 180;
  const txt = 'Qual é a soma dos ângulos internos de um polígono convexo de ' + lados + ' lados?';
  return opcoes(info(ano, nv, 'geometria', 'Soma dos ângulos internos dos polígonos', 'polig', txt),
    r, [lados * 180, r + 180, r - 180, lados * 360], (v) => fmt.ang(v), { min: 180 });
};

GER.plano = function (ano, nv) {
  const topo = [5, 8, 12, 15][nv - 1];
  const x = ri(0, topo), y = ri(0, topo), dy = ri(1, 4);
  const txt = 'O ponto (' + x + ', ' + y + ') foi deslocado ' + dy + (dy === 1 ? ' unidade' : ' unidades') +
              ' para cima, no plano cartesiano. Quais são as novas coordenadas?';
  return itemTexto(info(ano, nv, 'geometria', 'Plano cartesiano e pares ordenados', 'plano', txt),
    '(' + x + ', ' + (y + dy) + ')',
    ['(' + (x + dy) + ', ' + y + ')', '(' + x + ', ' + Math.max(0, y - dy) + ')', '(' + y + ', ' + (x + dy) + ')',
     '(' + (y + dy) + ', ' + x + ')', '(' + x + ', ' + (y + dy + 1) + ')', '(' + (x + 1) + ', ' + (y + dy) + ')']);
};

GER.media = function (ano, nv) {
  for (let t = 0; t < 24; t++) {
    const alvo = ri(45, 95);                                   // média, em décimos (4,5 a 9,5)
    const v = [alvo + ri(-25, 25), alvo + ri(-25, 25), alvo + ri(-25, 25)];
    if (v.some((x) => x < 30 || x > 100)) continue;
    const quarto = 4 * alvo - v[0] - v[1] - v[2];
    if (quarto < 30 || quarto > 100) continue;
    const notas = embaralhar(v.concat([quarto]));
    const txt = 'As notas de um estudante nas quatro provas do bimestre foram ' +
                notas.map((x) => fmt.num(x / 10, 1)).join('; ') + '. Qual foi a média do bimestre?';
    return opcoes(info(ano, nv, 'dados', 'Média aritmética', 'media', txt),
      alvo / 10,
      [arred(4 * alvo / 50, 2), Math.max.apply(null, notas) / 10, arred(alvo / 10 + 0.5, 2), arred(alvo / 10 - 0.5, 2)],
      (x) => fmt.num(x, 2), { min: 0, casas: 2 });
  }
  return GER.media(ano, nv);
};

GER.mediaMediana = function (ano, nv) {
  const lista = embaralhar([12, 15, 18, 20, 22, 25, 30, 33]).slice(0, 5).sort((a, b) => a - b);
  const txt = 'Os tempos, em minutos, que cinco estudantes levaram para resolver uma lista foram ' +
              lista.join('; ') + '. Qual é a mediana desses tempos?';
  return opcoes(info(ano, nv, 'dados', 'Mediana de um conjunto de dados', 'media', txt),
    lista[2], [arred(lista.reduce((a, b) => a + b, 0) / 5, 1), lista[0], lista[4], lista[1]],
    (v) => fmt.num(v, 1), { min: 1, casas: 1 });
};

GER.moda = function (ano, nv) {
  const alvo = ri(8, 17);
  const extras = embaralhar([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].filter((v) => v !== alvo)).slice(0, 4);
  const lista = [alvo, alvo, alvo, extras[0], extras[0], extras[1], extras[2], extras[3]];
  const txt = 'As idades anotadas em uma pesquisa esportiva foram ' + embaralhar(lista).join('; ') +
              '. Qual é a moda dessas idades?';
  return opcoes(info(ano, nv, 'dados', 'Moda de um conjunto de dados', 'moda', txt),
    alvo, [extras[0], extras[1], lista.length, arred(lista.reduce((a, b) => a + b, 0) / lista.length, 1)],
    (v) => fmt.num(v, 1), { min: 1, casas: 1 });
};

GER.prob = function (ano, nv) {
  const ver = ri(2, 6), bra = ri(2, 5), pre = ri(2, 4);
  const total = ver + bra + pre;
  const [ni, di] = irredutivel(ver, total);
  const txt = 'Em uma urna há ' + ver + ' bolas vermelhas, ' + bra + ' brancas e ' + pre +
              ' pretas. Retirando uma bola sem olhar, qual é a probabilidade de ela ser vermelha?';
  return itemTexto(info(ano, nv, 'dados', 'Probabilidade de um evento', 'prob', txt),
    fmt.frac(ni, di),
    [fmt.frac(ver, total + 1), fmt.frac(bra, total), fmt.frac(total - ver, total), fmt.frac(ni + 1, di),
     fmt.frac(ver + bra, total), fmt.frac(ni, di + 1), fmt.frac(ver + 1, total), fmt.frac(ver, total - 1)]);
};

GER.pitag = function (ano, nv) {
  const t = d1([[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17], [12, 16, 20]]);
  const txt = 'Um triângulo retângulo tem catetos de ' + t[0] + ' cm e ' + t[1] +
              ' cm. Quanto mede a hipotenusa?';
  return opcoes(info(ano, nv, 'geometria', 'Teorema de Pitágoras', 'pitag', txt),
    t[2], [t[0] + t[1], Math.round(Math.sqrt(t[0] * t[0] + t[1] * t[1]) + 2), t[2] + 1, Math.abs(t[1] - t[0])],
    (v) => fmt.un(v, 'cm'), { min: 1 });
};

GER.trig = function (ano, nv) {
  const VAL = {
    30: { sen: 0.5, cos: 0.87, tan: 0.58 },
    45: { sen: 0.71, cos: 0.71, tan: 1 },
    60: { sen: 0.87, cos: 0.5, tan: 1.73 }
  };
  const modo = ri(0, 2);
  const hip = ri(2, 12) * 2;
  if (modo === 0) {
    const ang = d1([30, 45, 60]);
    const v = VAL[ang].sen;
    const r = arred(hip * v, 2);
    const txt = 'Em um triângulo retângulo a hipotenusa mede ' + hip + ' cm e um dos ângulos agudos mede ' +
                ang + '°. Quanto mede o cateto oposto a esse ângulo? (sen ' + ang + '° = ' + fmt.dec(v, 2) + ')';
    return opcoes(info(ano, nv, 'geometria', 'Razões trigonométricas no triângulo retângulo: seno', 'trig', txt),
      r, [arred(hip * VAL[ang].cos, 2), arred(hip * VAL[ang].tan, 2), arred(hip / v, 2), arred(hip - r, 2)],
      (x) => fmt.un(x, 'cm', 2), { min: 1, casas: 2 });
  }
  if (modo === 1) {
    const ang = d1([30, 45, 60]);
    const v = VAL[ang].cos;
    const r = arred(hip * v, 2);
    const txt = 'Uma escada de ' + hip + ' m está apoiada em um muro e forma um ângulo de ' + ang +
                '° com o chão. Qual é a distância da base da escada até o muro? (cos ' +
                ang + '° = ' + fmt.dec(v, 2) + ')';
    return opcoes(info(ano, nv, 'geometria', 'Razões trigonométricas no triângulo retângulo: cosseno', 'trig', txt),
      r, [arred(hip * VAL[ang].sen, 2), arred(hip * VAL[ang].tan, 2), arred(hip / v, 2), arred(hip - r, 2)],
      (x) => fmt.un(x, 'm', 2), { min: 1, casas: 2 });
  }
  const ang = d1([30, 60]);
  const v = VAL[ang].tan;
  const base = ri(2, 12) * 5;
  const r = arred(base * v, 2);
  const txt = 'Uma rampa sobe formando um ângulo de ' + ang + '° com o solo. A distância horizontal, da base até o ' +
              'alto da rampa, é de ' + base + ' m. Qual é a altura atingida? (tan ' + ang + '° = ' + fmt.dec(v, 2) + ')';
  return opcoes(info(ano, nv, 'geometria', 'Razões trigonométricas no triângulo retângulo: tangente', 'trig', txt),
    r, [arred(base * VAL[ang].sen, 2), arred(base * VAL[ang].cos, 2), arred(base / v, 2), arred(r / 2, 2)],
    (x) => fmt.un(x, 'm', 2), { min: 1, casas: 2 });
};

GER.func = function (ano, nv) {
  const a = ri(2, 5);
  let b = ri(-6, 8);
  if (b === 0) b = d1([-5, -3, 4, 7]);
  const x = ri(1, [5, 8, 10, 12][nv - 1]);
  const r = a * x + b;
  const txt = 'Dada a função f(x) = ' + a + 'x ' + (b < 0 ? '- ' + Math.abs(b) : '+ ' + b) +
              ', quanto vale f(' + x + ')?';
  return opcoes(info(ano, nv, 'algebra', 'Função do 1º grau: valor numérico', 'func', txt),
    r, [a * x - b, a + b, r + a, Math.abs(r - b)], (v) => fmt.int(v), { min: -200, max: 200 });
};

GER.dizima = function (ano, nv) {
  const algar = d1([1, 2, 3, 4, 5, 6, 7, 8]);
  const periodo = ri(1, 2) === 1 ? String(algar) : String(algar) + String(algar > 1 ? algar - 1 : algar + 1);
  const den = periodo.length === 1 ? 9 : 99;
  const [ni, di] = irredutivel(parseInt(periodo, 10), den);
  const txt = 'A dízima periódica 0,' + periodo + periodo + periodo + '... equivale a qual fração ordinária (geratriz)?';
  return itemTexto(info(ano, nv, 'numeros', 'Fração geratriz de dízima periódica', 'frac', txt),
    fmt.frac(ni, di), [fmt.frac(parseInt(periodo, 10), 10), fmt.frac(parseInt(periodo, 10), 99),
                       fmt.frac(parseInt(periodo, 10), 100), fmt.frac(parseInt(periodo, 10) + 1, den)]);
};

GER.irr = function (ano, nv) {
  const certa = '√' + d1([2, 3, 5, 6, 7, 10, 11]);
  const txt = 'Qual das raízes a seguir NÃO é um número racional?';
  return itemTexto(info(ano, nv, 'numeros', 'Números irracionais', 'comparar', txt),
    certa, ['√' + d1([4, 9, 16, 25, 36, 49]), '√' + d1([4, 9, 16, 25, 36, 49]), '0,75', '3,14']);
};

// ── sorteio de itens ─────────────────────────────────────
function gerarChave(chave, ano, nv) {
  const fn = GER[chave] || GER.adi;
  let item = null;
  for (let t = 0; t < 8; t++) {
    item = fn(ano, nv);
    if (item && item.alt && item.alt.length === 4 && item.alt[0] !== item.alt[1]) break;
  }
  if (!item || !item.alt || item.alt.length !== 4) item = GER.adi(ano, nv);
  item.ref = 'ger:' + chave;
  return item;
}

function sortear(op) {
  op = op || {};
  const ano = clampAno(op.ano), nv = clampNv(op.nv);
  const usadas = op.usadas || [];
  const banco = (root.BANCO_ITENS || []).filter((i) => i.ano === ano && i.nv === nv && usadas.indexOf(i.id) < 0);
  let geraveis = chavesDo(ano, nv).filter((c) => usadas.indexOf('ger:' + c) < 0 && GER[c]);
  if (!geraveis.length) geraveis = chavesDo(ano, nv).filter((c) => GER[c]);

  let item;
  const peso = banco.length ? (geraveis.length ? (Math.random() < 0.5 ? 'banco' : 'ger') : 'banco') : 'ger';
  if (peso === 'banco') item = d1(banco);
  else item = gerarChave(d1(geraveis.length ? geraveis : ['adi']), ano, nv);
  if (!item) item = gerarChave('adi', ano, nv);

  item = Object.assign({}, item);
  item.ref = item.ref || item.id;
  item.unidade = UNIDADES[item.u] || item.u;
  return item;
}

// ── Verdadeiro ou Falso ──────────────────────────────────
// Cada família devolve uma afirmação curta, se ela é verdadeira e o
// motivo. As falsas nascem de confusões reais da sala de aula:
// somar em vez de multiplicar, ignorar os parênteses, trocar o
// algarismo do quociente pelo divisor, "maior denominador = maior
// fração", 1 hora = 100 minutos.
function limiteAfirmacao(ano, nv) {
  const base = [20, 99, 400, 999, 5000, 20000, 60000, 120000, 200000][ano - 1];
  return Math.max(10, Math.round(base * [0.3, 0.55, 0.78, 1][nv - 1]));
}
function opcaoDiferente(candidatos, certa, min) {
  const boas = candidatos.filter((v) => isFinite(v) && v !== certa && (min == null || v >= min));
  return boas.length ? d1(boas) : certa + 1;
}
function afirma(id, ano, nv, tema, u, o, txt, certa, por) {
  return { id, ano, nv, tema, u, o, txt, certa, por };
}

function afirmaOperacao(ano, nv) {
  const lim = limiteAfirmacao(ano, nv);
  const ops = ano <= 1 ? ['+', '-'] : ano <= 2 ? ['+', '-', '×'] : ['+', '-', '×', '÷'];
  const op = d1(ops);
  let a, b, d, q, certa, errada, o, tema;
  if (op === '+') {
    a = ri(2, Math.max(3, Math.round(lim * 0.5)));
    b = ri(2, Math.max(3, Math.round(lim * 0.4)));
    certa = a + b;
    errada = opcaoDiferente([erroSemLevar(a, b), certa + 1, certa - 1], certa, 1);
    o = 'Sentenças de adição'; tema = 'adi';
  } else if (op === '-') {
    a = ri(8, Math.max(10, lim));
    b = ri(2, Math.max(3, Math.round(a * 0.7)));
    certa = a - b;
    errada = opcaoDiferente([erroMaiorMenor(a, b), certa + 1, certa + 10], certa, 1);
    o = 'Sentenças de subtração'; tema = 'sub';
  } else if (op === '×') {
    a = ri(ano <= 5 ? 2 : 12, ano <= 5 ? 12 : 40);
    b = ri(3, 9);
    certa = a * b;
    errada = opcaoDiferente([certa + b, certa - b, certa - a, a + b], certa, 1);
    o = 'Fatos básicos da multiplicação'; tema = 'mult';
  } else {
    d = ri(2, 12); q = ri(2, ano <= 3 ? 12 : 25);
    a = d * q; b = d; certa = q;
    errada = opcaoDiferente([d, q + 1, q - 1], certa, 1);
    o = 'Relação entre multiplicação e divisão'; tema = 'div';
  }
  const verdadeira = Math.random() < 0.5;
  const exibida = verdadeira ? certa : errada;
  return afirma('op', ano, nv, tema, 'numeros', o,
    fmt.int(a) + ' ' + op + ' ' + fmt.int(b) + ' = ' + fmt.int(exibida) + '.',
    exibida === certa,
    verdadeira ? 'O cálculo está certo.' : 'O resultado correto é ' + fmt.int(certa) + '.');
}

function afirmaValorLugar(ano) {
  const digitos = ano <= 2 ? 2 : ano <= 4 ? 3 : ano <= 6 ? 4 : 5;
  let s = '123';
  for (let t = 0; t < 20; t++) {
    const algs = embaralhar([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, digitos);
    s = embaralhar(algs).join('');
    if (ano > 1 || +s <= 30) break;
  }
  const i = ri(0, s.length - 1);
  const dg = +s[i];
  const pos = s.length - 1 - i;
  const real = dg * Math.pow(10, pos);
  const errada = opcaoDiferente([dg, real * 10, pos > 0 ? real / 10 : real + dg], real, 1);
  const verdadeira = Math.random() < 0.5;
  const exibida = verdadeira ? real : errada;
  const ordens = ['unidades', 'dezenas', 'centenas', 'unidades de milhar', 'dezenas de milhar'];
  return afirma('lugar', ano, 1, 'posic', 'numeros', 'Valor posicional de um algarismo',
    'No número ' + fmt.int(+s) + ', o algarismo ' + dg + ' vale ' + fmt.int(exibida) + '.',
    exibida === real,
    'Ele está na ordem das ' + ordens[pos] + '.');
}

function afirmaMultiplo(ano, nv) {
  const nomes = ano <= 2 ? [[2, 'dobro'], [3, 'triplo']] : [[2, 'dobro'], [3, 'triplo'], [4, 'quádruplo']];
  const p = d1(nomes);
  const x = ri(3, Math.min(30, Math.max(6, Math.round(limiteAfirmacao(ano, nv) / 20))));
  const real = p[0] * x;
  const errada = opcaoDiferente([x + p[0], real + x, real - x], real);
  const verdadeira = Math.random() < 0.5;
  const exibida = verdadeira ? real : errada;
  return afirma('multiplo', ano, nv, 'dobro', 'numeros', 'Dobro, triplo e quádruplo',
    'O ' + p[1] + ' de ' + x + ' é ' + exibida + '.',
    exibida === real,
    'O ' + p[1] + ' é ' + x + ' × ' + p[0] + ' = ' + real + '.');
}

function afirmaPar(ano) {
  const n = ri(ano <= 2 ? 3 : 11, ano <= 2 ? 99 : ano <= 4 ? 999 : 9999);
  const realPar = n % 2 === 0;
  const dizPar = Math.random() < 0.5 ? realPar : !realPar;
  return afirma('par', ano, 1, 'seq', 'numeros', 'Números pares e ímpares',
    'O número ' + fmt.int(n) + ' é ' + (dizPar ? 'par' : 'ímpar') + '.',
    dizPar === realPar,
    'Basta olhar o último algarismo: ' + String(n).slice(-1) + ' ' + (+String(n).slice(-1) % 2 === 0 ? 'forma um número par.' : 'forma um número ímpar.'));
}

function afirmaArredonda(ano) {
  const centena = ano >= 4;
  const base = centena ? 100 : 10;
  let m = ri(1, centena ? 45 : 24) * base + ri(1, base - 1);
  if (m % base === base / 2) m += 1;
  const real = Math.round(m / base) * base;
  const errada = opcaoDiferente([real + base, real - base > 0 ? real - base : real + 2 * base,
    Math.floor(m / base) * base], real, 1);
  const verdadeira = Math.random() < 0.5;
  const exibida = verdadeira ? real : errada;
  return afirma('arred', ano, 1, 'estim', 'numeros', 'Arredondamento e estimativa',
    'Arredondando ' + fmt.int(m) + ' para a ' + (centena ? 'centena' : 'dezena') + ' mais próxima obtemos ' + fmt.int(exibida) + '.',
    exibida === real,
    fmt.int(m) + ' está mais perto de ' + fmt.int(real) + '.');
}

const CONVERSAS_AF = [
  { de: 'km', para: 'm', k: 1000 },
  { de: 'm', para: 'cm', k: 100 },
  { de: 'cm', para: 'mm', k: 10 },
  { de: 'kg', para: 'g', k: 1000 },
  { de: 'L', para: 'mL', k: 1000 }
];
function afirmaConversao(ano) {
  const c = d1(CONVERSAS_AF);
  const x = ri(2, 9);
  const real = x * c.k;
  const errada = opcaoDiferente([real / 10, real * 10, real / 2], real);
  const verdadeira = Math.random() < 0.5;
  const exibida = verdadeira ? real : errada;
  return afirma('unid', ano, 1, 'unid', 'medidas', 'Medidas de comprimento, massa e capacidade',
    x + ' ' + c.de + ' equivalem a ' + fmt.int(exibida) + ' ' + c.para + '.',
    exibida === real,
    '1 ' + c.de + ' tem ' + fmt.int(c.k) + ' ' + c.para + '.');
}

function afirmaTempoFato() {
  const fatos = [
    ['uma hora', 60, 'minutos', 100],
    ['meia hora', 30, 'minutos', 50],
    ['um dia', 24, 'horas', 12],
    ['uma semana', 7, 'dias', 5],
    ['um ano', 12, 'meses', 10],
    ['um minuto', 60, 'segundos', 100],
    ['uma quinzena', 15, 'dias', 10],
    ['uma década', 10, 'anos', 100],
    ['um século', 100, 'anos', 10],
    ['um bimestre', 2, 'meses', 4],
    ['um biênio', 2, 'anos', 4],
    ['um ano', 365, 'dias', 300]
  ];
  const f = d1(fatos);
  const verdadeira = Math.random() < 0.5;
  const exibida = verdadeira ? f[1] : f[3];
  return afirma('tempo', 1, 1, 'tempo', 'medidas', 'Grandezas temporais e unidades usuais',
    'Em ' + f[0] + ' há ' + exibida + ' ' + f[2] + '.',
    exibida === f[1],
    f[0].charAt(0).toUpperCase() + f[0].slice(1) + ' tem ' + f[1] + ' ' + f[2] + '.');
}

function afirmaHoraDecorrida(ano) {
  const iniH = ri(7, 14), iniM = d1([0, 15, 30, 45]);
  const dur = d1([25, 35, 45, 50, 65, 75, 80, 95, 110]);
  const fim = iniH * 60 + iniM + dur;
  const rel = Math.floor(fim / 60), rem = fim % 60;
  const real = dur;
  const errada = opcaoDiferente([real + 10, real - 10, real + 60], real);
  const verdadeira = Math.random() < 0.5;
  const exibida = verdadeira ? real : errada;
  return afirma('hora', ano, 1, 'tempo', 'medidas', 'Intervalos de tempo',
    'Das ' + iniH + 'h' + String(iniM).padStart(2, '0') + ' às ' + rel + 'h' + String(rem).padStart(2, '0') +
    ' se passam ' + exibida + ' minutos.',
    exibida === real,
    'Entre os dois horários decorrem ' + real + ' minutos.');
}

function afirmaAngulo(ano) {
  const graus = d1([ri(5, 85), 90, ri(95, 175), 180]);
  const real = graus < 90 ? 'agudo' : graus === 90 ? 'reto' : graus < 180 ? 'obtuso' : 'raso';
  const outro = d1(['agudo', 'reto', 'obtuso', 'raso'].filter((x) => x !== real));
  const verdadeira = Math.random() < 0.5;
  const exibida = verdadeira ? real : outro;
  return afirma('angulo', ano, 1, 'angul', 'geometria', 'Classificação de ângulos',
    'Um ângulo de ' + graus + '° é ' + exibida + '.',
    exibida === real,
    graus < 90 ? 'Menor que 90° é agudo.' : graus === 90 ? 'Exatamente 90° é reto.' :
    graus < 180 ? 'Entre 90° e 180° é obtuso.' : 'Meia volta, 180°, é ângulo raso.');
}

const NOMES_POLIGONO = {
  3: 'triângulo', 4: 'quadrilátero', 5: 'pentágono', 6: 'hexágono', 7: 'heptágono',
  8: 'octógono', 9: 'eneágono', 10: 'decágono', 12: 'dodecágono'
};
function afirmaPoligono(ano) {
  const lados = d1([3, 4, 5, 6, 8, 10, 12]);
  const real = NOMES_POLIGONO[lados];
  const outro = d1(Object.keys(NOMES_POLIGONO).map(Number).filter((k) => k !== lados));
  const verdadeira = Math.random() < 0.6;
  return afirma('polig', ano, 1, 'polig', 'geometria', 'Polígonos e seus elementos',
    verdadeira ? 'Um ' + real + ' tem ' + lados + ' lados.' : 'Um ' + real + ' tem ' + outro + ' lados.',
    verdadeira,
    real + ': polígono de ' + lados + ' lados.');
}

function afirmaTrianguloAngulos(ano) {
  const a = ri(30, 80), b = ri(30, 80);
  const c = 180 - a - b;
  if (c < 20) return afirmaAngulo(ano);
  const real = [a, b, c];
  const errada = d1([[a + 10, b, c], [a, b + 10, c], [a, b, c - 10]]);
  const verdadeira = Math.random() < 0.5;
  const t = verdadeira ? real : errada;
  return afirma('triang', ano, 1, 'triang', 'geometria', 'Ângulos internos de um triângulo',
    'Um triângulo com ângulos de ' + t[0] + '°, ' + t[1] + '° e ' + t[2] + '° existe.',
    t[0] + t[1] + t[2] === 180,
    'A soma dos ângulos internos de todo triângulo é 180° (aqui ' + (t[0] + t[1] + t[2]) + '°).');
}

function afirmaFracao(ano) {
  const modo = ri(0, 2);
  if (modo === 0) {
    const d = ri(2, 6), n = ri(1, d - 1), k = ri(2, 4);
    const igual = Math.random() < 0.5;
    const outra = igual ? [n * k, d * k] : [n * k + 1, d * k];
    const real = outra[0] * d === n * outra[1];
    return afirma('frac', ano, 1, 'frac', 'numeros', 'Frações equivalentes',
      n + '/' + d + ' e ' + outra[0] + '/' + outra[1] + ' representam a mesma parte do inteiro.',
      real,
      real ? 'Multiplicando os dois termos por ' + k + ', ' + n + '/' + d + ' vira ' + outra[0] + '/' + outra[1] + '.' :
      n + '/' + d + ' equivale a ' + (n * k) + '/' + (d * k) + ', e não a ' + outra[0] + '/' + outra[1] + '.');
  }
  if (modo === 1) {
    const n = ri(1, 4), a = ri(n + 1, 9), b = ri(a + 1, 12);
    const real = n / a > n / b;
    const inv = Math.random() < 0.5;
    const maior = inv ? b : a;
    return afirma('frac2', ano, 1, 'frac', 'numeros', 'Comparação de frações',
      n + '/' + maior + ' é a maior das duas frações, ' + n + '/' + a + ' e ' + n + '/' + b + '.',
      maior === a,
      'Com o mesmo numerador, quem tem o menor denominador representa a parte maior.');
  }
  const d = d1([2, 4, 5, 10]), n = ri(1, d - 1), total = ri(2, 20) * d;
  const real = total / d * n;
  const errada = opcaoDiferente([total / d + n, total - real, real + d], real);
  const verdadeira = Math.random() < 0.5;
  const exibida = verdadeira ? real : errada;
  return afirma('frac3', ano, 1, 'frac', 'numeros', 'Fração de uma quantidade',
    n + '/' + d + ' de ' + fmt.int(total) + ' corresponde a ' + fmt.int(exibida) + '.',
    exibida === real,
    'Divida por ' + d + ' e multiplique por ' + n + ': ' + fmt.int(real) + '.');
}

function afirmaPorcentagem(ano) {
  const p = d1([10, 20, 25, 50]);
  const total = ri(2, 24) * (100 / p);
  const real = total * p / 100;
  const modo = ri(0, 1);
  if (modo === 0) {
    const errada = opcaoDiferente([Number.isInteger(real / 10) ? real / 10 : real + 1, real * 10, total - real], real, 1);
    const verdadeira = Math.random() < 0.5;
    const exibida = verdadeira ? real : errada;
    return afirma('porct', ano, 1, 'porct', 'numeros', 'Porcentagens de uma quantidade',
      p + '% de ' + fmt.int(total) + ' é ' + fmt.int(exibida) + '.',
      exibida === real,
      '1% de ' + fmt.int(total) + ' é ' + fmt.num(total / 100, 2) + '; ' + p + '% é ' + fmt.int(real) + '.');
  }
  const ideia = { 50: 'metade', 25: 'quarta parte', 10: 'décima parte', 20: 'quinta parte' }[p];
  const errada = { 50: 'terça parte', 25: 'metade', 10: 'metade', 20: 'quarta parte' }[p];
  const verdadeira = Math.random() < 0.5;
  return afirma('porct2', ano, 1, 'porct', 'numeros', 'Porcentagem e fração',
    p + '% de um inteiro é o mesmo que ' + (verdadeira ? ideia : errada) + ' desse inteiro.',
    verdadeira,
    p + '% = ' + fmt.frac(1, p === 50 ? 2 : p === 25 ? 4 : p === 20 ? 5 : 10) + ' do inteiro.');
}

function afirmaMedia() {
  const q = ri(3, 4);
  const alvo = ri(3, 9);
  let nums = null;
  for (let t = 0; t < 30 && !nums; t++) {
    const v = [];
    let falta = alvo * q;
    let ok = true;
    for (let i = 0; i < q; i++) {
      const depois = (q - i - 1) * 10;
      const lo = Math.max(0, falta - depois);
      const hi = Math.min(10, falta);
      if (lo > hi) { ok = false; break; }
      const x = ri(lo, hi);
      v.push(x);
      falta -= x;
    }
    if (ok && falta === 0 && new Set(v).size > 1) nums = v;
  }
  if (!nums) return afirmaPorcentagem(5);
  const soma = nums.reduce((x, y) => x + y, 0);
  const errada = opcaoDiferente([Math.max.apply(null, nums), soma, alvo + 1, alvo - 1], alvo, 0);
  const verdadeira = Math.random() < 0.5;
  const exibida = verdadeira ? alvo : errada;
  return afirma('media', 1, 1, 'media', 'dados', 'Média aritmética',
    'A média dos números ' + nums.join(', ') + ' é ' + exibida + '.',
    exibida === alvo,
    'A soma é ' + soma + ' e, dividida por ' + q + ', dá ' + alvo + '.');
}

function afirmaProbabilidade() {
  const cores = [{ pl: 'azuis', sg: 'azul' }, { pl: 'vermelhas', sg: 'vermelha' },
                 { pl: 'verdes', sg: 'verde' }, { pl: 'amarelas', sg: 'amarela' }];
  if (Math.random() < 0.6) {
    const a = ri(2, 10);
    let b = ri(2, 10);
    while (b === a) b = ri(2, 10);
    const c1 = cores[0];
    const c2 = d1(cores.slice(1));
    const mais = a > b ? c1 : c2;
    const menos = mais === c1 ? c2 : c1;
    const verdadeira = Math.random() < 0.5;
    const sorteada = verdadeira ? mais : menos;
    return afirma('prob', 1, 1, 'prob', 'dados', 'Chance e possibilidade',
      'Uma caixa tem ' + a + ' bolinhas ' + c1.pl + ' e ' + b + ' bolinhas ' + c2.pl +
      '. É mais provável tirar uma bolinha ' + sorteada.sg + '.',
      sorteada === mais,
      'Quem tem mais bolinhas tem a maior chance: são ' + Math.max(a, b) + ' ' + mais.pl + '.');
  }
  const fatos = [
    ['Ao lançar um dado comum, é impossível sair o número 7.', true, 'O dado só tem faces de 1 a 6.'],
    ['Ao lançar um dado comum, é certo sair um número menor que 7.', true, 'Todas as faces são menores que 7.'],
    ['Ao lançar um dado comum, é possível sair o número 1.', true, 'O 1 é uma das faces do dado.'],
    ['Ao lançar uma moeda, a chance de sair cara é a mesma de sair coroa.', true, 'São dois resultados igualmente prováveis.'],
    ['Retirar uma bolinha azul de uma caixa com só bolinhas vermelhas é impossível.', true, 'Não há bolinha azul na caixa.'],
    ['Ao lançar um dado comum, é impossível sair um número par.', false, 'Saem 2, 4 e 6, que são pares.'],
    ['Ao lançar um dado comum, é certo sair o número 6.', false, 'O 6 é apenas um dos seis resultados possíveis.']
  ];
  const f = d1(fatos);
  return afirma('prob2', 1, 1, 'prob', 'dados', 'Eventos possíveis, prováveis e impossíveis',
    f[0], f[1], f[2]);
}

function afirmaNegativos(ano) {
  const modo = ri(0, 2);
  if (modo === 0) {
    let a = -ri(4, 30), b = -ri(2, 30);
    while (a === b) b = -ri(2, 30);
    const menor = Math.min(a, b);
    const maiorAbs = Math.abs(a) > Math.abs(b) ? a : b;
    const verdadeira = Math.random() < 0.5;
    const exibida = verdadeira ? menor : maiorAbs === menor ? (a + b - menor) : maiorAbs;
    return afirma('neg', ano, 1, 'neg', 'numeros', 'Números negativos e ordem',
      'Entre ' + fmt.int(a) + ' e ' + fmt.int(b) + ', o menor número é ' + fmt.int(exibida) + '.',
      exibida === menor,
      'Quanto mais longe do zero para a esquerda, menor o número.');
  }
  if (modo === 1) {
    const x = ri(3, 40);
    const verdadeira = Math.random() < 0.5;
    return afirma('neg2', ano, 1, 'neg', 'numeros', 'Opostos na reta numérica',
      'O oposto de ' + fmt.int(-x) + ' é ' + fmt.int(verdadeira ? x : -x) + '.',
      verdadeira,
      'O oposto fica à mesma distância do zero, do outro lado.');
  }
  const x = ri(2, 25);
  const verdadeira = Math.random() < 0.5;
  return afirma('neg3', ano, 1, 'neg', 'numeros', 'Números negativos na reta numérica',
    'Na reta numérica, ' + fmt.int(-x) + ' fica ' + (verdadeira ? 'à esquerda' : 'à direita') + ' do zero.',
    verdadeira,
    'Os negativos estão sempre à esquerda do zero.');
}

function afirmaPotencia(ano) {
  const b = ri(2, 6);
  const e = b <= 3 ? ri(2, 5) : ri(2, 3);
  const real = Math.pow(b, e);
  const errada = opcaoDiferente([b * e, Math.pow(b, e - 1), real * b], real);
  const verdadeira = Math.random() < 0.5;
  const exibida = verdadeira ? real : errada;
  return afirma('pot', ano, 1, 'pot', 'numeros', 'Potências de base inteira',
    b + ' elevado a ' + e + ' é ' + fmt.int(exibida) + '.',
    exibida === real,
    b + ' elevado a ' + e + ' é ' + Array(e).fill(b).join(' × ') + ' = ' + real + '.');
}

function afirmaExpressao(ano) {
  const a = ri(2, 20), b = ri(2, 9), c = ri(2, 9);
  const comParenteses = Math.random() < 0.5;
  const real = comParenteses ? (a + b) * c : a + b * c;
  const errada = comParenteses ? a + b * c : (a + b) * c;
  const verdadeira = Math.random() < 0.5;
  const exibida = verdadeira ? real : errada;
  const expressao = comParenteses ? '(' + a + ' + ' + b + ') × ' + c : a + ' + ' + b + ' × ' + c;
  return afirma('expr', ano, 1, 'expr', 'numeros', 'Ordem das operações',
    expressao + ' = ' + exibida + '.',
    exibida === real,
    comParenteses ? 'Primeiro o que está entre parênteses.' : 'A multiplicação vem antes da adição.');
}

const AFIRMA_FAM = [
  { min: 1, max: 9, f: afirmaOperacao },
  { min: 1, max: 6, f: afirmaValorLugar },
  { min: 2, max: 9, f: afirmaMultiplo },
  { min: 2, max: 9, f: afirmaPar },
  { min: 2, max: 9, f: afirmaConversao },
  { min: 2, max: 9, f: afirmaTempoFato },
  { min: 3, max: 9, f: afirmaArredonda },
  { min: 4, max: 9, f: afirmaHoraDecorrida },
  { min: 4, max: 9, f: afirmaAngulo },
  { min: 4, max: 9, f: afirmaFracao },
  { min: 5, max: 9, f: afirmaPoligono },
  { min: 5, max: 9, f: afirmaPorcentagem },
  { min: 5, max: 9, f: afirmaMedia },
  { min: 5, max: 9, f: afirmaProbabilidade },
  { min: 5, max: 9, f: afirmaExpressao },
  { min: 6, max: 9, f: afirmaNegativos },
  { min: 6, max: 9, f: afirmaPotencia },
  { min: 7, max: 9, f: afirmaTrianguloAngulos }
];

function afirmacao(ano, nv, usadas) {
  ano = clampAno(ano); nv = clampNv(nv);
  const banco = (root.BANCO_AFIRMACOES || []).filter(
    (a) => a.ano === ano && a.nv === nv && (usadas || []).indexOf(a.id) < 0
  );
  if (banco.length && Math.random() < 0.6) {
    const a = d1(banco);
    return Object.assign({
      tipo: 'afirmacao', unidade: UNIDADES[a.u] || a.u, ano, nv, explicacao: a.why || ''
    }, a, { ano, nv });
  }
  const disponiveis = AFIRMA_FAM.filter((x) => ano >= x.min && ano <= x.max);
  const g = d1(disponiveis.length ? disponiveis : [AFIRMA_FAM[0]]).f(ano, nv);
  return {
    tipo: 'afirmacao',
    ano, nv,
    u: g.u,
    unidade: UNIDADES[g.u],
    o: g.o,
    bncc: cod(g.tema, ano),
    txt: g.txt,
    certa: g.certa,
    explicacao: g.por,
    id: 'af:' + g.id + ':' + g.txt
  };
}

// ── Sequência ────────────────────────────────────────────
function sequencia(ano, nv) {
  ano = clampAno(ano); nv = clampNv(nv);
  const tipos = [];
  if (ano <= 3) { tipos.push('pa', 'pa', 'rep', 'mult'); }
  else if (ano <= 5) { tipos.push('pa', 'pg', 'mult', 'quad', 'dec'); }
  else if (ano <= 7) { tipos.push('pa', 'paNeg', 'pg', 'fib', 'pot', 'dec', 'frac'); }
  else { tipos.push('pa2', 'pot', 'fib', 'paNeg', 'frac', 'quad'); }
  const tipo = d1(tipos);
  const passoMax = [3, 6, 10, 14][nv - 1];
  let seq = [], resposta, regra;

  if (tipo === 'pa') {
    const p = ri(1, passoMax), ini = ri(0, 25);
    seq = [ini, ini + p, ini + 2 * p, ini + 3 * p];
    resposta = ini + 4 * p;
    regra = 'cresce de ' + p + ' em ' + p;
  } else if (tipo === 'paNeg') {
    const p = ri(2, passoMax), ini = ri(20, 60);
    seq = [ini, ini - p, ini - 2 * p, ini - 3 * p];
    resposta = ini - 4 * p;
    regra = 'diminui de ' + p + ' em ' + p;
  } else if (tipo === 'pg') {
    const r = ri(2, 3), ini = ri(1, 5);
    seq = [ini, ini * r, ini * r * r, ini * Math.pow(r, 3)];
    resposta = ini * Math.pow(r, 4);
    regra = 'multiplica por ' + r;
  } else if (tipo === 'rep') {
    const bloco = embaralhar([1, 2, 3, 4, 5, 6]).slice(0, 3);
    seq = [];
    for (let i = 0; i < 5; i++) seq.push(bloco[i % 3]);
    resposta = bloco[seq.length % 3];
    regra = 'repete o bloco ' + bloco.join(', ');
  } else if (tipo === 'mult') {
    const p = ri(2, 9);
    seq = [p, p * 2, p * 3, p * 4];
    resposta = p * 5;
    regra = 'múltiplos de ' + p;
  } else if (tipo === 'fib') {
    const a = ri(1, 5), b = ri(a + 1, a + 6);
    seq = [a, b, a + b, a + 2 * b];
    resposta = 2 * a + 3 * b;
    regra = 'cada termo soma os dois anteriores';
  } else if (tipo === 'quad') {
    const ini = ri(1, 5);
    seq = [ini * ini, (ini + 1) * (ini + 1), (ini + 2) * (ini + 2), (ini + 3) * (ini + 3)];
    resposta = (ini + 4) * (ini + 4);
    regra = 'quadrados perfeitos seguidos';
  } else if (tipo === 'pot') {
    const ini = ri(2, 4);
    seq = [ini, ini * ini, Math.pow(ini, 3), Math.pow(ini, 4)];
    resposta = Math.pow(ini, 5);
    regra = 'potências de ' + ini;
  } else if (tipo === 'dec') {
    const p = d1([0.1, 0.25, 0.5, 1.5, 2.5]);
    const ini = arred(rf(0.5, 6), 2);
    seq = [ini, arred(ini + p, 2), arred(ini + 2 * p, 2), arred(ini + 3 * p, 2)];
    resposta = arred(ini + 4 * p, 2);
    regra = 'cresce de ' + fmt.num(p, 2) + ' em ' + fmt.num(p, 2);
  } else if (tipo === 'pa2') {
    const c1 = ri(1, 4), inc = ri(1, 3);
    let atual = ri(1, 8);
    seq = [];
    for (let i = 0; i < 4; i++) { seq.push(atual); atual += c1 + i * inc; }
    resposta = atual;
    regra = 'o passo aumenta de ' + inc + ' em ' + inc;
  } else {
    const den = d1([2, 4, 5, 10]);
    const ini = ri(1, Math.max(2, den - 3));
    seq = [ini, ini + 1, ini + 2, ini + 3];
    resposta = ini + 4;
    regra = 'frações com denominador ' + den;
    const texto = (v) => fmt.frac(v, den);
    const erradas = embaralhar([resposta + 2, resposta - 2, resposta + 1, resposta - 1, den, resposta * 2])
      .filter((v, i, arr) => v !== resposta && v > 0 && arr.indexOf(v) === i).slice(0, 3);
    let extra = resposta + 3;
    while (erradas.length < 3) {
      if (erradas.indexOf(extra) < 0) erradas.push(extra);
      extra++;
    }
    return {
      tipo: 'sequencia',
      seq: seq.map(texto), resposta: texto(resposta),
      erradas: erradas.map(texto), regra, ano, nv,
      o: 'Sequência de frações com mesmo denominador', bncc: cod('frac', ano), unidade: UNIDADES.numeros
    };
  }

  const texto = (v) => (Number.isInteger(v) ? fmt.int(v) : fmt.num(v, 2));
  const salto = Math.abs(seq[1] - seq[0]) || 1;
  let erradas = embaralhar([
    arred(resposta + salto, 2), arred(resposta - salto, 2),
    arred(resposta + 1, 2), arred(resposta - 1, 2),
    arred(resposta * 2, 2), arred(resposta + salto / 2, 2)
  ]).filter((v, i, arr) => Math.abs(v - resposta) > 1e-9 && arr.indexOf(v) === i).slice(0, 3);
  let novo = arred(resposta + salto + 1, 2);
  while (erradas.length < 3) {
    if (erradas.indexOf(novo) < 0) erradas.push(novo);
    novo = arred(novo + 1, 2);
  }
  return {
    tipo: 'sequencia',
    seq: seq.map(texto), resposta: texto(resposta),
    erradas: erradas.map(texto), regra, ano, nv,
    o: 'Sequências numéricas e regularidade', bncc: cod('seq', ano), unidade: UNIDADES.numeros
  };
}

// ── Ordenar ──────────────────────────────────────────────
const MEDIDAS_OPM = [
  { txt: '3/4', v: 0.75 }, { txt: '1/2', v: 0.5 }, { txt: '1/4', v: 0.25 },
  { txt: '2/5', v: 0.4 }, { txt: '3/5', v: 0.6 }, { txt: '7/10', v: 0.7 },
  { txt: '1/8', v: 0.125 }, { txt: '5/8', v: 0.625 }, { txt: '4/5', v: 0.8 }, { txt: '1/3', v: 1 / 3 }
];

function ordenar(ano, nv) {
  ano = clampAno(ano); nv = clampNv(nv);
  const crescente = Math.random() < 0.6;
  let tipo;
  if (ano <= 2) tipo = 'intPeq';
  else if (ano <= 4) tipo = d1(['int', 'dec']);
  else if (ano <= 6) tipo = d1(['int', 'dec', 'frac', 'porct']);
  else tipo = d1(['neg', 'dec', 'frac', 'porct', 'pot']);
  const qtd = nv <= 2 ? 4 : nv === 3 ? 5 : 6;
  const valores = [];
  let guard = 0;
  while (valores.length < qtd && guard < 400) {
    guard++;
    let v, txt;
    if (tipo === 'intPeq') { v = ri(1, 45); txt = fmt.int(v); }
    else if (tipo === 'int') { v = ri(10, escala(ano, nv)); txt = fmt.int(v); }
    else if (tipo === 'dec') { v = arred(rf(0.4, ano <= 4 ? 40 : 400), 2); txt = fmt.dec(v, 2); }
    else if (tipo === 'neg') { v = ri(-45, 45); txt = fmt.int(v); }
    else if (tipo === 'porct') { v = ri(5, 95); txt = fmt.pct(v); }
    else if (tipo === 'pot') { v = ri(1, 9) * Math.pow(10, ri(2, 5)); txt = fmt.int(v); }
    else { const m = d1(MEDIDAS_OPM); v = m.v; txt = m.txt; }
    if (valores.some((x) => Math.abs(x.v - v) < 1e-9)) continue;
    valores.push({ v, txt });
  }
  const certa = valores.slice().sort((a, b) => (crescente ? a.v - b.v : b.v - a.v));
  let embar = embaralhar(valores);
  let tries = 0;
  while (embar.map((p) => p.txt).join('|') === certa.map((p) => p.txt).join('|') && tries < 12) {
    embar = embaralhar(valores); tries++;
  }
  return {
    tipo: 'ordenar',
    ordem: crescente ? 'crescente' : 'decrescente',
    pecas: embar, correta: certa, ano, nv,
    o: tipo === 'neg' ? 'Comparação e ordenação de números inteiros'
      : tipo === 'porct' ? 'Comparação de porcentagens'
      : tipo === 'dec' || tipo === 'frac' ? 'Comparação e ordenação de números racionais'
      : 'Comparação e ordenação de números naturais',
    bncc: tipo === 'neg' ? cod('neg', ano) : cod('ordem', ano),
    unidade: UNIDADES.numeros
  };
}

// ── Memória Doce: pares expressão ↔ valor ────────────────
function memoria(ano, nv) {
  ano = clampAno(ano); nv = clampNv(nv);
  const candidatas = [];
  const fa = faixaDe(ano, nv, 'adicao');
  const fs = faixaDe(ano, nv, 'subtracao');
  const fm = faixaDe(ano, nv, 'mult');
  const fd = faixaDe(ano, nv, 'divis');
  for (let t = 0; t < 20; t++) {
    const a = ri(Math.max(1, fa[0]), Math.max(2, fa[1] - 2));
    const b = ri(1, Math.max(2, fa[1] - a));
    candidatas.push({ expressao: a + ' + ' + b, valor: a + b });
    const c = ri(Math.max(2, fs[0]), Math.max(3, fs[1]));
    const d = ri(1, Math.max(1, Math.floor(c * 0.7)));
    candidatas.push({ expressao: c + ' - ' + d, valor: c - d });
    if (ano >= 2 && fm) {
      const x = ri(fm[0][0], fm[0][1]), y = ri(fm[1][0], fm[1][1]);
      candidatas.push({ expressao: x + ' × ' + y, valor: x * y });
    }
    if (fd) {
      const q = ri(fd[0][0], fd[0][1]), r = ri(fd[1][0], fd[1][1]);
      candidatas.push({ expressao: (q * r) + ' ÷ ' + q, valor: r });
    }
  }
  const pares = [], vistos = [];
  for (const c of embaralhar(candidatas)) {
    if (pares.length === 6) break;
    if (c.valor <= 0 || vistos.indexOf(c.valor) >= 0) continue;
    vistos.push(c.valor);
    pares.push({ expressao: c.expressao, valor: fmt.num(c.valor, 2), v: c.valor });
  }
  for (let v = 1; pares.length < 6 && v <= 12; v++) {
    if (vistos.indexOf(v) >= 0) continue;
    vistos.push(v);
    pares.push({ expressao: (v + 1) + ' - 1', valor: fmt.num(v, 2), v: v });
  }
  return { tipo: 'memoria', pares, ano, nv, o: 'Fatos básicos e cálculo mental', bncc: cod('memoria', ano), unidade: UNIDADES.numeros };
}

// ── Cruzadinha: grade gerada com somas sempre coerentes ───
function cruzadinha(ano, nv) {
  ano = clampAno(ano); nv = clampNv(nv);
  const tamanho = ano >= 7 || (ano >= 4 && nv >= 3) ? 4 : 3;
  const mi = ano <= 2 ? 1 : ano <= 4 ? 2 : 3;
  const ma = ano <= 1 ? 9 : ano <= 3 ? 12 : ano <= 5 ? 18 : nv <= 2 ? 20 : 28;
  const grid = [];
  for (let r = 0; r < tamanho; r++) {
    const linha = [];
    for (let c = 0; c < tamanho; c++) linha.push(ri(mi, ma));
    grid.push(linha);
  }
  const rowSums = grid.map((l) => l.reduce((a, b) => a + b, 0));
  const colSums = [];
  for (let c = 0; c < tamanho; c++) {
    let s = 0;
    for (let r = 0; r < tamanho; r++) s += grid[r][c];
    colSums.push(s);
  }
  const lacunas = nv <= 1 ? 2 : nv === 2 ? 3 : nv === 3 ? 4 : Math.min(6, tamanho * tamanho - 3);
  const posicoes = [];
  for (let r = 0; r < tamanho; r++) for (let c = 0; c < tamanho; c++) posicoes.push(r + '-' + c);
  const respostas = {};
  embaralhar(posicoes).slice(0, lacunas).forEach((p) => {
    const parts = p.split('-');
    respostas[p] = grid[+parts[0]][+parts[1]];
  });
  return {
    tipo: 'cruzadinha', size: tamanho, grid, rowSums, colSums, respostas,
    lacunas: Object.keys(respostas).length, ano, nv,
    o: 'Adição e igualdade em grade numérica', bncc: cod('cruz', ano), unidade: UNIDADES.numeros
  };
}

// ── Balança da igualdade: termo que falta ────────────────
function balanca(ano, nv) {
  ano = clampAno(ano); nv = clampNv(nv);
  const modo = nv <= 2 ? ri(0, 1) : ri(0, 2);
  const f = faixaDe(ano, nv, 'adicao');
  // o jogo é sobre a relação de igualdade: os números ficam na faixa
  // que dá para conferir de cabeça, em qualquer ano
  const topos = [20, 60, 300, 999];
  const topo = Math.min(topos[nv - 1], f[1]);
  let frase, certa, erradas, tema;
  if (modo === 0) {
    const a = ri(Math.max(2, Math.floor(topo * 0.15)), Math.max(3, Math.floor(topo * 0.7)));
    const x = ri(2, Math.max(3, topo - a));
    certa = x; erradas = [a + x, x + 1, a, x - 1];
    frase = fmt.int(a) + ' + ___ = ' + fmt.int(a + x);
    tema = 'iguald';
  } else if (modo === 1) {
    const faixa = [[8, 5], [12, 9], [20, 12], [30, 25]][nv - 1];
    const a = ri(2, faixa[1]);
    const x = ri(2, faixa[0]);
    certa = x; erradas = [a * x, x + 1, a, x - 1];
    frase = a + ' × ___ = ' + (a * x);
    tema = 'mult';
  } else {
    const a = ri(2, 9), x = ri(2, [12, 20, 30, 40][nv - 1]), b = ri(2, 30);
    certa = x; erradas = [(a * x + b + b) / a, x + a, x - 1, b];
    frase = a + 'x + ' + b + ' = ' + (a * x + b);
    tema = 'eq';
  }
  const unicas = erradas.filter((v, i, arr) => Math.abs(v - certa) > 1e-9 && arr.indexOf(v) === i && isFinite(v));
  while (unicas.length < 3) unicas.push(certa + unicas.length + 1);
  return {
    tipo: 'balanca', frase, valor: certa,
    resposta: fmt.num(certa, 1),
    erradas: embaralhar(unicas.slice(0, 3).map((v) => fmt.num(v, 1))),
    alternativas: [fmt.num(certa, 1)].concat(embaralhar(unicas.slice(0, 3).map((v) => fmt.num(v, 1)))),
    ano, nv,
    o: modo === 2 ? 'Equação do 1º grau' : 'Relação de igualdade com termo desconhecido',
    bncc: cod(tema, ano), unidade: UNIDADES.algebra
  };
}

// Roleta: cada segmento tem prêmio fixo e conhecido
const ROLETA = [
  { rotulo: '10', estrelas: 10 },
  { rotulo: '15', estrelas: 15 },
  { rotulo: '20', estrelas: 20 },
  { rotulo: '25', estrelas: 25 },
  { rotulo: '30', estrelas: 30 },
  { rotulo: '40', estrelas: 40 }
];

// ── API ──────────────────────────────────────────────────
const CM = {
  fmt, PERFIS, NIVEIS, UNIDADES, COD, GER, ROLETA, NOMES, MEDIDAS_OPM,
  ri, rf, d1, embaralhar, arred, mdc, mmc, divisores, irredutivel,
  clampAno, clampNv, faixaDe, chavesDo, escala, escalaMax, cod,
  sortear, gerarChave, afirmacao,
  sequencia, ordenar, memoria, cruzadinha, balanca,
  nome, alguem, sup, expo10,
  valorOpcao, mesmaOpcao
};

if (typeof module !== 'undefined' && module.exports) module.exports = CM;
root.CM = CM;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
