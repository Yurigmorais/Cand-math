#!/usr/bin/env node
/* Guarda-chuva do CSS fluido: procura o que costuma quebrar em janela pequena
   (tamanho de letra fora da escala fluida, largura fixa que estoura, variável
   usada sem definição e regras duplicadas que se desarmam entre si).
   Rodar: node testes/validar-css.js  */
'use strict';
const fs = require('fs');
const path = require('path');

const { RAIZ } = require('./_raiz.js');
const css = fs.readFileSync(path.join(RAIZ, 'style.css'), 'utf8');
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');

// ---- varredura por "seletor { corpo }", com o número da linha ----
const R = varrer(css, 0);

function varrer(texto, deslocamentoLinha) {
  const achadas = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(texto)) !== null) {
    const sel = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
    const corpo = m[2];
    if (!sel || sel.startsWith('@')) continue;
    /* Antes do seletor: retira comentários e conta chaves para saber se a regra
       está dentro de um @media. Override de media query é intencional, não é
       regra desarmada — por isso o contexto viaja junto. */
    const antes = texto.slice(0, m.index).replace(/\/\*[\s\S]*?\*\//g, ' ');
    const profundidade = (antes.match(/\{/g) || []).length - (antes.match(/\}/g) || []).length;
    const env = /@[^{}]*\{\s*$/.exec(antes.slice(-500));
    const media = profundidade > 0 && env ? env[0].replace(/\{\s*$/, '').trim() : '';
    const ate = texto.slice(0, m.index).split('\n').length + deslocamentoLinha - 1;
    achadas.push({ sel, corpo, linha: ate, media });
  }
  return achadas;
}

// ---- 1. variáveis usadas sem definição ----
// As variáveis do enfeite do splash (--x, --d) vêm inline no HTML, por isso
// entram na conta das definidas.
const definidas = new Set();
R.forEach(r => {
  const re = /(--[\w-]+)\s*:/g;
  let m;
  while ((m = re.exec(r.corpo)) !== null) definidas.add(m[1]);
});
let mHtml;
const reInline = /(--[\w-]+)\s*:/g;
while ((mHtml = reInline.exec(html)) !== null) definidas.add(mHtml[1]);
const usos = new Set();
let mu;
/* Uma variável que só o JavaScript põe (--barra-altura é medida na hora) não é
   buraco: é buraco apenas se o CSS não deixou valor de reserva. Por isso usa com
   vírgula dentro do var() estão fora da conta. */
const reUso = /var\(\s*(--[\w-]+)([^)]*)/g;
while ((mu = reUso.exec(css)) !== null) { if (mu[2].indexOf(',') < 0) usos.add(mu[1]); }
const faltando = [...usos].filter(v => !definidas.has(v));

// ---- 2. fonte fixa fora da escala fluida ----
const fonteFixa = [];
R.forEach(r => {
  const m = /(?:^|[;\s])font-size\s*:\s*(\d+(?:\.\d+)?)px/.exec(r.corpo);
  if (m && !/clamp|calc|var|min\(|max\(/.test(m[0])) {
    const px = parseFloat(m[1]);
    if (px < 11.5) fonteFixa.push({ sel: r.sel, px, linha: r.linha, por: 'menor que 11,5 px' });
    else if (px > 15) fonteFixa.push({ sel: r.sel, px, linha: r.linha, por: 'não escala com a janela' });
  }
});

// ---- 3. largura fixa que pode estourar em 320 px ----
const estreita = 320;
const larguraFixa = [];
R.forEach(r => {
  const corpo = r.corpo;
  const m = /(?:^|[;\s])(min-width|width)\s*:\s*(\d+(?:\.\d+)?)px/.exec(corpo);
  if (!m) return;
  const px = parseFloat(m[2]);
  if (px < 200) return;
  const temFreio = /max-width\s*:\s*(100%|min\(|clamp\(|var\()/.test(corpo) ||
                   /width\s*:\s*(100%|min\(|clamp\(|calc\(|var\()/.test(corpo) ||
                   /grid-template-columns\s*:/.test(corpo) ||
                   /flex\s*:/.test(corpo) || /margin\s*:\s*0 auto/.test(corpo);
  if (!temFreio) larguraFixa.push({ sel: r.sel, prop: m[1], px, linha: r.linha });
});

// ---- 4. altura fixa grande (corta em janela baixa) ----
const alturaFixa = [];
R.forEach(r => {
  const m = /(?:^|[;\s])(height|min-height)\s*:\s*(\d+(?:\.\d+)?)px/.exec(r.corpo);
  if (!m) return;
  const px = parseFloat(m[2]);
  if (px > 300 && !/clamp|vh|min\(|max\(/.test(m[0])) alturaFixa.push({ sel: r.sel, px, linha: r.linha });
});

// ---- 5. mesmo seletor declarado duas vezes com valores que brigam ----
const porSeletor = new Map();
let ajustesDeMedia = 0;
R.forEach(r => {
  /* Regra dentro de @media é ajuste deliberado de janela, não duplicata: fica
     fora desta briga e é contada só para dar a dimensão da passada responsiva. */
  if (r.media) { ajustesDeMedia++; return; }
  const chaves = r.sel.split(',').map(s => s.trim()).filter(Boolean);
  chaves.forEach(s => {
    if (!porSeletor.has(s)) porSeletor.set(s, []);
    porSeletor.get(s).push(r);
  });
});
const duplicados = [];
porSeletor.forEach((lista, sel) => {
  if (lista.length < 2) return;
  const props = new Map();
  lista.forEach(r => {
    const re = /([-\w]+)\s*:\s*([^;]+)/g;
    let m;
    while ((m = re.exec(r.corpo)) !== null) {
      const p = m[1];
      if (!props.has(p)) props.set(p, []);
      props.get(p).push(m[2].trim());
    }
  });
  props.forEach((vals, p) => {
    const unicos = [...new Set(vals)];
    if (unicos.length > 1 && /^(font-size|width|height|min-width|min-height|padding|grid-template-columns)$/.test(p)) {
      duplicados.push({ sel, prop: p, valores: unicos.slice(0, 3).join(' | ') });
    }
  });
});

// ---- 6. ids de tela e modal usados no JS e que não existem no HTML ----
const js = fs.readFileSync(path.join(RAIZ, 'script.js'), 'utf8');
const idsHtml = new Set((html.match(/id="([\w-]+)"/g) || []).map(s => s.slice(4, -1)));
const refs = new Set();
let m2;
const reId = /(?:\$\(|getElementById\()['"]([\w-]+)['"]\)|showScreen\(['"]([\w-]+)['"]\)|openModal\(['"]([\w-]+)['"]\)/g;
while ((m2 = reId.exec(js)) !== null) refs.add(m2[1] || m2[2] || m2[3]);
const idsSumindo = [...refs].filter(id => !idsHtml.has(id));

// ---- 7. classes usadas no JS e que não têm regra nenhuma no CSS ----
const classesJs = new Set();
let m3;
const reCls = /class(?:List)?(?:Name)?\s*=\s*['"]([\w -]+)['"]|className:\s*['"]([\w -]+)['"]|classList\.(?:add|remove|toggle)\(\s*['"]([\w-]+)['"](?:\s*,\s*['"]([\w-]+)['"])?/g;
while ((m3 = reCls.exec(js)) !== null) {
  const t = m3[1] || m3[2] || '';
  t.split(/\s+/).filter(Boolean).forEach(c => classesJs.add(c));
  for (let k = 3; k <= 4; k++) if (m3[k]) classesJs.add(m3[k]);
}
// As classes do Font Awesome (fa-*) vêm da folha externa e as que só servem de
// marca para o JS não precisam de regra própria: ficam na lista de toleradas.
const TOLERADAS = /^(fa-|is-marked|js-)/;
const semRegra = [...classesJs].filter(c => c && !TOLERADAS.test(c) && css.indexOf('.' + c) < 0);

console.log('regras lidas: ' + R.length + ' (sendo ' + ajustesDeMedia + ' ajustes por janela @media)');
console.log('variáveis usadas sem definição: ' + (faltando.length ? faltando.join(', ') : 'nenhuma'));
console.log('fontes fora da escala fluida: ' + (fonteFixa.length ? '' : 'nenhuma'));
fonteFixa.forEach(f => console.log('   linha ' + f.linha + ' | ' + f.sel.slice(0, 46) + ' -> ' + f.px + 'px (' + f.por + ')'));
console.log('larguras fixas sem freio (podem estourar em ' + estreita + ' px): ' + (larguraFixa.length ? '' : 'nenhuma'));
larguraFixa.forEach(l => console.log('   linha ' + l.linha + ' | ' + l.sel.slice(0, 46) + ' -> ' + l.prop + ': ' + l.px + 'px'));
console.log('alturas fixas acima de 300 px: ' + (alturaFixa.length ? '' : 'nenhuma'));
alturaFixa.forEach(l => console.log('   linha ' + l.linha + ' | ' + l.sel.slice(0, 46) + ' -> ' + l.px + 'px'));
console.log('seletores duplicados com conflito: ' + (duplicados.length ? '' : 'nenhum'));
duplicados.forEach(d => console.log('   ' + d.sel.slice(0, 40) + ' | ' + d.prop + ' | ' + d.valores));
console.log('ids citados no JS e ausentes no HTML: ' + (idsSumindo.length ? idsSumindo.join(', ') : 'nenhum'));
console.log('classes criadas no JS sem regra no CSS: ' + (semRegra.length ? semRegra.join(', ') : 'nenhuma'));

const erros = faltando.length + fonteFixa.length + larguraFixa.length + alturaFixa.length +
  duplicados.length + idsSumindo.length + semRegra.length;
console.log('\n=== resultado ===');
console.log(erros ? 'problemas a olhar: ' + erros : 'css revisado sem pendências');
process.exitCode = erros ? 1 : 0;
